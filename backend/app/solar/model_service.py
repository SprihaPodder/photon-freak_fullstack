"""
Loads the three LightGBM quantile models from models.pkl once at startup
and exposes a single predict function.
"""
import pickle
import numpy as np
import pandas as pd

from .config import MODEL_PATH

_models = None


def load_models():
    global _models
    if _models is None:
        with open(MODEL_PATH, "rb") as f:
            payload = pickle.load(f)
        _models = payload["models"]
    return _models


def predict_quantiles(feature_row: pd.DataFrame) -> dict:
    """feature_row: single-row DataFrame in FEATURE_COLS order."""
    models = load_models()
    raw_q50 = float(models["q50"].predict(feature_row.values)[0])
    raw_q05 = float(models["q05"].predict(feature_row.values)[0])
    raw_q95 = float(models["q95"].predict(feature_row.values)[0])
    print(f"[DEBUG raw quantiles] q05={raw_q05:.2f} q50={raw_q50:.2f} q95={raw_q95:.2f} "
          f"crossing={'YES' if raw_q05 > raw_q50 else 'no'}")

    q50 = float(np.clip(raw_q50, 0, None))
    q05 = float(np.clip(raw_q05, 0, None))
    q95 = float(np.clip(raw_q95, 0, None))
    q05, q50, q95 = sorted([q05, q50, q95])
    return {"q05": q05, "q50": q50, "q95": q95}
    # keep bounds sane in case quantile crossing happens near zero output
    q05, q95 = min(q05, q50), max(q95, q50)
    return {"q05": q05, "q50": q50, "q95": q95}
