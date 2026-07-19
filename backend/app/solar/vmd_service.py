"""
Adaptive-K VMD — ported from solar_photonfreak_v2.py.

VMD decomposes a whole signal window at once; it is NOT something you
recompute per-request. This module refreshes the decomposition on a
schedule (see config.VMD_REFRESH_EVERY_HOURS) and caches the most recent
mode values. Between refreshes, new readings reuse the last cached mode
values (forward-fill) — a standard practical compromise for deploying
VMD-based forecasts.
"""
import numpy as np
import pandas as pd
from scipy.stats import entropy as sp_entropy

from .config import K_MAX, VMD_WINDOW_HOURS, VMD_REFRESH_EVERY_HOURS
from . import db

try:
    from vmdpy import VMD
except ImportError:
    VMD = None  # raised clearly at call time if someone forgot `pip install vmdpy`


def _signal_entropy(sig, bins=50):
    hist, _ = np.histogram(sig, bins=bins, density=True)
    return sp_entropy(hist + 1e-12)


def _adaptive_k_vmd(signal: np.ndarray):
    if VMD is None:
        raise ImportError("vmdpy is not installed. Run: pip install vmdpy")
    gc = np.where(signal <= 0, 0.001, signal)
    gn = (gc - gc.mean()) / gc.std()
    best_k, best_modes = 3, None
    prev_ent = _signal_entropy(gn)
    for K in range(2, K_MAX + 1):
        try:
            u, _, _ = VMD(gn, 2000, 0, K, 0, 1, 1e-7)
            nrmse = np.sqrt(np.mean((gn - u.sum(0)) ** 2)) / (gn.max() - gn.min() + 1e-9)
            if nrmse > 0.05:
                continue
            new_ent = _signal_entropy(u[-1])
            best_k = K
            best_modes = u * gc.std() + gc.mean() / K
            prev_ent = new_ent
            if new_ent / (prev_ent + 1e-9) < 0.05:
                break
        except Exception:
            continue
    if best_modes is None:
        best_k = 3
        best_modes = np.tile(gc / 3, (3, 1))
    return best_k, best_modes


def _utc_now_naive() -> pd.Timestamp:
    return pd.Timestamp.now(tz="UTC").tz_localize(None)


def _is_stale(cache: dict) -> bool:
    if cache is None:
        return True
    computed_at = pd.Timestamp(cache["computed_at"])
    if computed_at.tzinfo is not None:
        computed_at = computed_at.tz_localize(None)
    age_hours = (_utc_now_naive() - computed_at).total_seconds() / 3600
    return age_hours >= VMD_REFRESH_EVERY_HOURS


def refresh_vmd_cache(site_id: str, force: bool = False) -> dict:
    """Recomputes VMD on the trailing VMD_WINDOW_HOURS of history for a site
    if the cache is missing or stale, and stores the latest mode values."""
    cache = db.get_vmd_cache(site_id)
    if not force and not _is_stale(cache):
        return cache

    hist = db.fetch_history(site_id, VMD_WINDOW_HOURS)
    if len(hist) < 50:
        # Not enough history yet to run a meaningful decomposition —
        # fall back to zeros, matching add_vmd_features' behaviour for
        # unfilled mode slots in the training script.
        zeros = {f"V{i+1}": 0.0 for i in range(K_MAX)}
        db.save_vmd_cache(site_id, best_k=3, computed_at=_utc_now_naive(),
                           window_start=hist["Datetime"].min() if len(hist) else _utc_now_naive(),
                           window_end=hist["Datetime"].max() if len(hist) else _utc_now_naive(),
                           last_modes=zeros, last_vmd_res=0.0, last_vmd_recon=0.0)
        return db.get_vmd_cache(site_id)

    signal = hist["GHI"].values.astype(float)
    best_k, modes = _adaptive_k_vmd(signal)

    recon = modes.sum(0)
    vmd_res_series = np.abs(signal - recon)
    last_vmd_res = float(vmd_res_series[-1])
    last_vmd_recon = float(recon[-1])
    last_modes = {}
    for i in range(K_MAX):
        last_modes[f"V{i+1}"] = float(modes[i, -1]) if i < best_k else 0.0

    db.save_vmd_cache(
        site_id, best_k=best_k, computed_at=_utc_now_naive(),
        window_start=hist["Datetime"].min(), window_end=hist["Datetime"].max(),
        last_modes=last_modes, last_vmd_res=last_vmd_res, last_vmd_recon=last_vmd_recon,
    )
    return db.get_vmd_cache(site_id)


def get_vmd_values_for_prediction(site_id: str) -> dict:
    """Returns the vmd_res/vmd_recon/V1..V6 values to attach to the newest
    reading's feature row, refreshing the cache first if it's stale."""
    cache = refresh_vmd_cache(site_id)
    return {
        "vmd_res": cache["last_vmd_res"] or 0.0,
        "vmd_recon": cache["last_vmd_recon"] or 0.0,
        "V1": cache["last_v1"] or 0.0, "V2": cache["last_v2"] or 0.0,
        "V3": cache["last_v3"] or 0.0, "V4": cache["last_v4"] or 0.0,
        "V5": cache["last_v5"] or 0.0, "V6": cache["last_v6"] or 0.0,
    }
