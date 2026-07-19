"""
Feature engineering — ported from solar_photonfreak_v2.py's engineer_features().

IMPORTANT: this must stay byte-for-byte consistent with the training script.
If you change LAGS, rolling windows, or the feature list there, mirror the
change here too, or predictions will silently drift from training behaviour.

Everything here is causal (uses .shift / .rolling / .ewm which only look
backwards), so it is safe to run once per new reading as long as you pass in
enough trailing history (see config.HISTORY_WINDOW_HOURS).
"""
import numpy as np
import pandas as pd

from .config import LAGS, K_MAX

# Exact column order the models were trained on.
FEATURE_COLS = [
    "GHI", "DNI", "DHI", "EBH", "AirTemperature", "CloudOpacity", "is_day",
    "hs", "hc", "mos", "moc", "dys", "dyc",
    "csi", "ramp", "ghi_sq", "ebh_ghi", "dni_dhi_ratio", "ghi_csi",
    "temp_sq", "cloud_sq", "season", "is_morn", "is_noon", "is_aftn",
    "GL1", "GL2", "GL3", "GL6", "GL12", "GL24", "GL48",
    "PL1", "PL2", "PL3", "PL6", "PL24", "PL2d", "PL3d", "GL2d",
    "vmd_res", "vmd_recon",
    "GHI_r3", "GHI_r6", "GHI_r12", "Pr3", "Pr6", "Pr24",
    "GHI_s6", "GHI_s24", "Prod_ewm", "GHI_ewm",
] + [f"V{i+1}" for i in range(K_MAX)]


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    df must be sorted ascending by Datetime and contain:
    Datetime, GHI, DNI, DHI, EBH, AirTemperature, CloudOpacity, Production

    Returns the same dataframe with every engineered column (everything
    except vmd_res/vmd_recon/V1..V6, which are added separately by
    vmd_service since they come from the cached VMD decomposition).
    """
    df = df.copy()
    df["is_day"] = (df["GHI"] > 5).astype(float)
    df["h"] = df["Datetime"].dt.hour
    df["mo"] = df["Datetime"].dt.month
    df["dy"] = df["Datetime"].dt.dayofyear

    for col, period in [("h", 24), ("mo", 12), ("dy", 365)]:
        df[f"{col}s"] = np.sin(2 * np.pi * df[col] / period)
        df[f"{col}c"] = np.cos(2 * np.pi * df[col] / period)

    df["csi"] = np.where(df["DNI"] > 5, (df["GHI"] / df["DNI"]).clip(0, 2), 0)
    df["ramp"] = df["GHI"].diff().fillna(0).clip(-200, 200)
    df["ghi_sq"] = (df["GHI"] ** 2) / 1e6
    df["ebh_ghi"] = df["EBH"] * df["GHI"] / 1e5
    df["dni_dhi_ratio"] = np.where(df["DHI"] > 1, (df["DNI"] / df["DHI"]).clip(0, 20), 0)
    df["ghi_csi"] = df["GHI"] * df["csi"] / 100
    df["temp_sq"] = df["AirTemperature"] ** 2 / 100
    df["cloud_sq"] = df["CloudOpacity"] ** 2 / 100
    df["season"] = ((df["mo"] - 1) // 3).astype(float)
    df["is_morn"] = df["h"].between(6, 10).astype(float)
    df["is_noon"] = df["h"].between(11, 14).astype(float)
    df["is_aftn"] = df["h"].between(15, 18).astype(float)

    for L in LAGS:
        df[f"GL{L}"] = df["GHI"].shift(L).fillna(0)
        df[f"PL{L}"] = df["Production"].shift(L).fillna(0)
    df["PL2d"] = df["Production"].shift(48).fillna(0)
    df["PL3d"] = df["Production"].shift(72).fillna(0)
    df["GL2d"] = df["GHI"].shift(48).fillna(0)

    for w in [3, 6, 12]:
        df[f"GHI_r{w}"] = df["GHI"].rolling(w, min_periods=1).mean()
    for w in [3, 6, 24]:
        df[f"Pr{w}"] = df["Production"].rolling(w, min_periods=1).mean()
    df["GHI_s6"] = df["GHI"].rolling(6, min_periods=1).std().fillna(0)
    df["GHI_s24"] = df["GHI"].rolling(24, min_periods=1).std().fillna(0)

    df["Prod_ewm"] = df["Production"].ewm(span=6).mean()
    df["GHI_ewm"] = df["GHI"].ewm(span=12).mean()

    return df


def build_feature_row(history_df: pd.DataFrame, vmd_values: dict) -> pd.DataFrame:
    """
    history_df: raw history INCLUDING the newest reading as the last row,
                sorted ascending, with Datetime/GHI/DNI/DHI/EBH/
                AirTemperature/CloudOpacity/Production columns.
    vmd_values: dict with keys vmd_res, vmd_recon, V1..V6 for the latest
                timestamp (from vmd_service's cache).

    Returns a single-row DataFrame with columns in FEATURE_COLS order,
    ready for model.predict().
    """
    engineered = engineer_features(history_df)
    latest = engineered.iloc[[-1]].copy()
    for k, v in vmd_values.items():
        latest[k] = v
    missing = [c for c in FEATURE_COLS if c not in latest.columns]
    if missing:
        raise ValueError(f"Missing engineered columns before predict: {missing}")
    return latest[FEATURE_COLS]
