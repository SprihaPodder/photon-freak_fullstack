"""
feature_engineering.py
=======================
Replicates the exact feature-engineering steps of
novel_battery_model_NASA_v7_test1.py (section 2, "FEATURE ENGINEERING")
so that features computed here are numerically identical in meaning/order
to what scaler_X.pkl and the model were fit on.

Input contract (CSV uploaded from the frontend grid), one row per
discharge cycle, oldest cycle first:

    cycle, Capacity, chI, chV, chT, disI, disV, disT, BCt,
    disV_min, disV_max, disV_range, dis_energy, Re, Rct

- `Capacity` is the discharge capacity in Ah for that cycle (used to
  derive SOH relative to the FIRST row's capacity in the uploaded file,
  exactly as the training script normalises SOH per-battery).
- `Re` / `Rct` (impedance) may be left as 0 if not measured — the
  training script also defaults to 0 when EIS data is unavailable.
- Minimum 15 rows required (one full TIME_STEPS window). 20-25+ rows
  recommended so the rolling/Savitzky-Golay features are meaningful
  (the training script uses rolling windows of 5 and 10, and a 7-point
  Savitzky-Golay filter).
"""
from io import StringIO
import numpy as np
import pandas as pd
from scipy.signal import savgol_filter

from .model_utils import (
    PROFILE_COLS,
    ALL_FEAT_COLS,
    DEG_ANOM_IDX,
    TIME_STEPS,
)

REQUIRED_COLS = ["cycle", "Capacity"] + PROFILE_COLS

# Accepts common naming variants (case-insensitive, underscores/spaces interchangeable)
# and maps them onto the canonical column names the model expects. This does NOT
# fix fundamentally different/raw data (e.g. raw per-timestep NASA operation files) —
# it only helps when the same aggregated per-cycle data was exported with different
# column names.
COLUMN_ALIASES = {
    "cycle": "cycle", "cycle_number": "cycle", "cyclenum": "cycle", "cycle_index": "cycle",
    "capacity": "Capacity", "cap": "Capacity", "capacity_ah": "Capacity", "discharge_capacity": "Capacity",
    "chi": "chI", "charge_current": "chI", "charge_i": "chI",
    "chv": "chV", "charge_voltage": "chV", "charge_v": "chV",
    "cht": "chT", "charge_temp": "chT", "charge_temperature": "chT", "ambient_temp": "chT",
    "disi": "disI", "discharge_current": "disI", "discharge_i": "disI",
    "disv": "disV", "discharge_voltage": "disV", "discharge_v": "disV",
    "dist": "disT", "discharge_temp": "disT", "discharge_temperature": "disT",
    "bct": "BCt", "charge_time": "BCt", "operation_duration": "BCt", "duration": "BCt",
    "disv_min": "disV_min", "discharge_v_min": "disV_min", "voltage_min": "disV_min",
    "disv_max": "disV_max", "discharge_v_max": "disV_max", "voltage_max": "disV_max",
    "disv_range": "disV_range", "voltage_range": "disV_range",
    "dis_energy": "dis_energy", "discharge_energy": "dis_energy", "energy_wh": "dis_energy",
    "re": "Re", "resistance_re": "Re", "ohmic_resistance": "Re",
    "rct": "Rct", "resistance_rct": "Rct", "charge_transfer_resistance": "Rct",
}


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Renames recognized column-name variants onto the canonical schema."""
    rename_map = {}
    for col in df.columns:
        key = col.strip().lower().replace(" ", "_").replace("-", "_")
        if key in COLUMN_ALIASES:
            rename_map[col] = COLUMN_ALIASES[key]
    return df.rename(columns=rename_map)


class FeatureEngineeringError(ValueError):
    pass


def parse_csv(file_bytes: bytes) -> pd.DataFrame:
    try:
        df = pd.read_csv(StringIO(file_bytes.decode("utf-8")))
    except Exception as e:
        raise FeatureEngineeringError(f"Could not parse CSV: {e}")

    df.columns = df.columns.str.strip()
    df = normalize_columns(df)
    missing = [c for c in REQUIRED_COLS if c not in df.columns]
    if missing:
        raise FeatureEngineeringError(
            f"CSV is missing required columns: {missing}. "
            f"Required columns: {REQUIRED_COLS}. "
            f"(Common name variants are auto-detected, but this file appears to be missing "
            f"the underlying data, not just using different names — e.g. a raw per-timestep "
            f"sensor file rather than an aggregated per-cycle summary.)"
        )

    df = df[REQUIRED_COLS].dropna()
    if len(df) < TIME_STEPS:
        raise FeatureEngineeringError(
            f"Need at least {TIME_STEPS} discharge-cycle rows, got {len(df)}. "
            f"20-25+ rows recommended for stable rolling features."
        )

    df = df.sort_values("cycle").reset_index(drop=True)
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Adds SOH + the 5 engineered degradation columns, matching the training script."""
    df = df.copy()

    initial_cap = df["Capacity"].iloc[0]
    if initial_cap <= 0:
        raise FeatureEngineeringError("First row's Capacity must be > 0 (used as SOH=100% baseline).")
    df["SOH"] = (df["Capacity"] / initial_cap * 100.0).clip(0, 100)

    # Degradation velocity features — identical logic to the training script
    df["deg_rate"] = df["SOH"].diff().fillna(0)
    expected = df["deg_rate"].rolling(10, min_periods=3).mean().fillna(df["deg_rate"])
    df["deg_anomaly"] = df["deg_rate"] - expected
    df["cum_deg"] = df["SOH"].iloc[0] - df["SOH"]

    v_range = (df["disV_max"] - df["disV_min"]).clip(lower=0.01)
    df["ic_proxy"] = df["deg_rate"].abs() / v_range
    if len(df) >= 7:
        df["ic_proxy"] = savgol_filter(df["ic_proxy"].fillna(0), window_length=7, polyorder=2)

    df["cap_rolling_std"] = df["SOH"].rolling(5, min_periods=2).std().fillna(0)

    return df


def check_out_of_range(X_raw: np.ndarray, scaler_X) -> list:
    """
    Compares the uploaded battery's raw feature values against the actual
    min/max range the model was TRAINED on (only 7 batteries total — 4 NASA
    18650 cells + 3 augmentation cells). A MinMaxScaler silently extrapolates
    for anything outside that range — the model will still output a
    confident-looking number, but it's no longer interpolating within
    anything it has real training signal for.

    Returns a list of human-readable warnings, one per feature that's
    meaningfully out of range (empty list if everything looks in-distribution).
    """
    warnings = []
    data_min = scaler_X.data_min_
    data_max = scaler_X.data_max_
    span = np.maximum(data_max - data_min, 1e-6)
    TOLERANCE = 0.05  # allow 5% of the training span as slack before flagging

    # X_raw: (TIME_STEPS, N_FEAT) — check the most recent (latest) cycle's values,
    # since that's what matters most for the current health estimate.
    latest = X_raw[-1]
    for i, name in enumerate(ALL_FEAT_COLS):
        lo = data_min[i] - TOLERANCE * span[i]
        hi = data_max[i] + TOLERANCE * span[i]
        if latest[i] < lo or latest[i] > hi:
            warnings.append(
                f"'{name}' = {latest[i]:.4f} is outside the model's training range "
                f"[{data_min[i]:.4f}, {data_max[i]:.4f}] (seen across only 7 training batteries). "
                f"The prediction for this cycle is an extrapolation, not an interpolation — treat it with reduced confidence."
            )
    return warnings


def build_model_inputs(df_eng: pd.DataFrame, scaler_X):
    """
    Takes the last TIME_STEPS rows of the engineered dataframe and builds
    (x_seq_scaled, x_vel_raw) ready for BatteryModelBundle.predict().
    """
    window = df_eng.iloc[-TIME_STEPS:]
    X_raw = window[ALL_FEAT_COLS].values.astype(np.float32)          # (15, 18) raw
    X_scaled = scaler_X.transform(X_raw).astype(np.float32)          # (15, 18) scaled

    # Velocity vector is computed from RAW (unscaled) deg_anomaly — matches
    # `Xr[i:i+ts, deg_anom_idx]` in the training script, which indexes into the
    # raw feature matrix X, not the scaled X_sc.
    raw_anom = X_raw[:, DEG_ANOM_IDX]
    vel = np.array([
        raw_anom[-3:].mean(),
        raw_anom.std() + 1e-8,
        raw_anom[-1],
    ], dtype=np.float32)

    x_seq = X_scaled.reshape(1, TIME_STEPS, len(ALL_FEAT_COLS))
    x_vel = vel.reshape(1, 3)

    latest_soh = float(window["SOH"].iloc[-1])
    latest_cycle = int(window["cycle"].iloc[-1])
    recent_deg_rate = float(window["deg_rate"].tail(5).mean())  # avg SOH-loss/cycle, recent trend

    return x_seq, x_vel, latest_soh, latest_cycle, recent_deg_rate, X_raw


def estimate_trend_crossing(latest_soh: float, latest_cycle: int, recent_deg_rate: float, threshold: float):
    """
    Simple linear extrapolation of the observed recent degradation trend to a
    given SOH threshold — this is a physically-grounded estimate from the
    actual uploaded data (paper section 4.5, Early Warning System), independent
    of the model's RUL head (which cannot be denormalized for an unseen battery
    — see README). Returns None if the battery isn't currently degrading.
    """
    if recent_deg_rate >= -1e-6:  # flat or improving — no crossing predictable
        return None
    cycles_to_cross = (latest_soh - threshold) / abs(recent_deg_rate)
    if cycles_to_cross < 0:
        return {"already_crossed": True, "cycles_remaining": 0, "projected_cycle": latest_cycle}
    return {
        "already_crossed": False,
        "cycles_remaining": round(cycles_to_cross, 1),
        "projected_cycle": round(latest_cycle + cycles_to_cross, 1),
    }
