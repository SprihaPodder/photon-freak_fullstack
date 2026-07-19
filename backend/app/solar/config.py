"""
Central configuration for the solar forecast backend.
Adjust these values to match your deployment.
"""
import os

# --- Paths -------------------------------------------------------------
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH     = os.path.join(BASE_DIR, "solar_forecast.db")
MODEL_PATH  = os.path.join(BASE_DIR, "models.pkl")   # copy your models.pkl next to this file

# --- Feature engineering (must match training script exactly) ----------
LAGS  = [1, 2, 3, 6, 12, 24, 48]   # hours
K_MAX = 6                          # max VMD modes (from training script)

# How many past hourly rows to pull when building features for one prediction.
# Needs to comfortably cover the longest lag (48h / PL3d=72h) plus enough
# history for rolling/EWM windows to have converged (EWM span=12 forgets
# old data exponentially, so ~500h of context is plenty).
HISTORY_WINDOW_HOURS = 500

# --- VMD caching ---------------------------------------------------------
# VMD decomposes an entire signal window at once (expensive, non-causal
# within that window) so we do NOT recompute it on every request.
# Instead we refresh the cached decomposition periodically.
VMD_WINDOW_HOURS       = 720   # 30 days of hourly data used to fit VMD
VMD_REFRESH_EVERY_HOURS = 6    # re-run adaptive-K VMD at most this often per site

# --- Raw columns expected from the frontend / ingestion ------------------
RAW_INPUT_COLUMNS = [
    "GHI", "DNI", "DHI", "EBH", "AirTemperature", "CloudOpacity",
]

# --- Single-site deployment ------------------------------------------------
# Everything internally is still keyed by site_id (readings table, VMD
# cache), so switching to multiple sites later is a small change rather
# than a rewrite — but the API itself doesn't expose site_id at all.
DEFAULT_SITE_ID = "default"
