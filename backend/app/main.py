import io
import os

os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

import logging
import pandas as pd
from datetime import datetime as dt
from fastapi import FastAPI, File, HTTPException, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from PIL import Image, UnidentifiedImageError
from typing import Optional

from dotenv import load_dotenv
load_dotenv(override=True)  # .env always wins, even if GROQ_API_KEY already exists (possibly empty) in the OS environment

# Fault prediction & charging optimization
from .model import Predictor
from .optimizer import optimise

# Solar forecasting
from .solar import db as solar_db
from .solar import model_service as solar_model_service
from .solar.config import DEFAULT_SITE_ID as SOLAR_DEFAULT_SITE_ID, HISTORY_WINDOW_HOURS as SOLAR_HISTORY_WINDOW_HOURS
from .solar.feature_engineering import build_feature_row as solar_build_feature_row
from .solar.vmd_service import get_vmd_values_for_prediction as solar_get_vmd_values
from .solar.explain_service import generate_explanation as solar_generate_explanation

# Battery health (optional - gracefully degrade if TensorFlow not available)
battery_bundle = None
try:
    from .battery.model_utils import BatteryModelBundle, EOL_THRESHOLD, EOL_WARN_THRESHOLD
    from .battery.feature_engineering import (
        parse_csv as battery_parse_csv, engineer_features as battery_engineer_features,
        build_model_inputs as battery_build_model_inputs, estimate_trend_crossing as battery_estimate_trend_crossing,
        check_out_of_range as battery_check_out_of_range, FeatureEngineeringError as BatteryFeatureEngineeringError, REQUIRED_COLS as BATTERY_REQUIRED_COLS
    )
    from .battery.schemas import PredictionResponse as BatteryPredictionResponse, TrendCrossing
    from .battery.explainability import generate_explanation as battery_generate_explanation, ExplainabilityError
    BATTERY_AVAILABLE = True
except (ImportError, ModuleNotFoundError) as e:
    logging.warning(f"Battery health module not available: {e}")
    BATTERY_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("photonfreak-api")

app = FastAPI(title="PhotonFreak API - Unified Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
predictor = None


class ChargingRequest(BaseModel):
    battery_capacity_kwh: float = Field(40, gt=1, le=500)
    max_power_kw: float = Field(7.2, gt=0, le=100)
    initial_soc_pct: float = Field(20, ge=0, le=100)
    target_soc_pct: float = Field(80, gt=0, le=100)
    soh_pct: float = Field(90, ge=50, le=100)
    horizon_hours: int = Field(24, ge=2, le=72)
    solar_kw: list[float] = [0,0,0,0,0,0,0,1,2,3,4,4,3,2,1,0,0,0,0,0,0,0,0,0]
    grid_price_inr: list[float] = [6.5]*24
    quality: str = "quick"

@app.on_event("startup")
def startup_event():
    """Initialize all backends on startup"""
    logger.info("========== STARTUP BEGIN ==========")

    # Solar forecasting
    try:
        logger.info("[1] Before solar_db.init_db()")
        solar_db.init_db()
        logger.info("[2] After solar_db.init_db()")

        logger.info("[3] Before solar_model_service.load_models()")
        solar_model_service.load_models()
        logger.info("[4] After solar_model_service.load_models()")

        logger.info("✓ Solar forecasting backend loaded")
    except Exception as e:
        logger.exception("Solar forecasting backend initialization failed")

    # Battery health
    global battery_bundle
    if BATTERY_AVAILABLE:
        try:
            logger.info("[5] Before BatteryModelBundle()")
            battery_bundle = BatteryModelBundle()
            logger.info("[6] After BatteryModelBundle()")

            logger.info(
                "✓ Battery health backend loaded. RUL reference range (NASA batteries): %s cycles",
                battery_bundle.rul_reference_range,
            )

        except Exception:
            logger.exception("Battery health backend initialization failed")
    else:
        logger.info("Battery health module not available")

    logger.info("[7] Checking GROQ key")

    groq_key = os.environ.get("GROQ_API_KEY")
    if groq_key:
        logger.info(
            "GROQ_API_KEY found (length=%d, starts with '%s...')",
            len(groq_key),
            groq_key[:4],
        )
    else:
        logger.warning("GROQ_API_KEY not found")

    logger.info("========== STARTUP COMPLETE ==========")


@app.get("/api/health")
def health():
    """Health check endpoint"""
    return {
        "ok": True,
        "fault_model_ready": predictor is not None,
        "solar_models_ready": True,
        "battery_model_ready": battery_bundle is not None if BATTERY_AVAILABLE else False,
        "battery_module_available": BATTERY_AVAILABLE,
        "groq_key_loaded": bool(os.environ.get("GROQ_API_KEY")),
    }


# ─────────────────────────────────────────────────────────────────────────────
# FAULT PREDICTION
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/faults/predict")
async def predict(image: UploadFile = File(...)):
    """Predict solar panel faults from an image"""
    global predictor

    # Lazy-load the model only on the first request
    if predictor is None:
        logger.info("Loading SolarGuard model...")
        predictor = Predictor()
        logger.info("SolarGuard model loaded.")

    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(415, "Upload a JPG, PNG, or WebP panel photo.")

    try:
        image_obj = Image.open(io.BytesIO(await image.read()))
        return predictor.predict(image_obj)

    except UnidentifiedImageError:
        raise HTTPException(400, "The uploaded file is not a valid image.")

    except RuntimeError as e:
        raise HTTPException(503, str(e))

# ─────────────────────────────────────────────────────────────────────────────
# CHARGING OPTIMIZATION
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/charging/optimise")
def charging(request: ChargingRequest):
    """Optimize charging schedule"""
    if request.target_soc_pct <= request.initial_soc_pct:
        raise HTTPException(422, "Target SoC must exceed initial SoC.")
    if not request.solar_kw or not request.grid_price_inr or min(request.solar_kw) < 0 or min(request.grid_price_inr) < 0:
        raise HTTPException(422, "Solar and price values must be non-negative.")
    return optimise(request.model_dump())


# ─────────────────────────────────────────────────────────────────────────────
# SOLAR FORECASTING
# ─────────────────────────────────────────────────────────────────────────────

class SolarReadingIn(BaseModel):
    datetime: dt = Field(..., description="Timestamp of this reading (hourly)")
    GHI: float
    DNI: float
    DHI: float
    EBH: float
    AirTemperature: float
    CloudOpacity: float
    Production: float = Field(0.0, description="Actual production for this timestamp if known, else 0")


class SolarPredictionOut(BaseModel):
    datetime: dt
    q025: float = Field(..., description="Lower bound of the 95% PI")
    q50: float = Field(..., description="Median forecast")
    q975: float = Field(..., description="Upper bound of the 95% PI")
    vmd_best_k: int
    rho: float = Field(..., description="Relative uncertainty")
    ev_signal: float = Field(..., description="EV charging signal: 1.0/0.5/0.0")
    explanation: str = Field(..., description="Plain-English explanation")


def compute_ev_signal(q025: float, q50: float, q975: float) -> tuple[float, float]:
    """Convert forecast to charging signal"""
    rho = (q975 - q025) / q50 if q50 > 0 else float("inf")
    if q50 > 100 and rho < 0.4:
        signal = 1.0
    elif q50 > 50 and 0.4 <= rho < 1.0:
        signal = 0.5
    else:
        signal = 0.0
    return rho, signal


@app.post("/api/solar/bootstrap")
async def solar_bootstrap(file: UploadFile = File(...)):
    """Upload historical CSV to seed the site's history"""
    raw = await file.read()
    df = pd.read_csv(io.BytesIO(raw))
    df.columns = [c.strip() for c in df.columns]
    if "Production" not in df.columns:
        prod_cols = [c for c in df.columns if "production" in c.lower()]
        if prod_cols:
            df = df.rename(columns={prod_cols[0]: "Production"})
    required = ["Datetime", "GHI", "DNI", "DHI", "EBH", "AirTemperature", "CloudOpacity", "Production"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(400, f"CSV missing required columns: {missing}")

    df["Datetime"] = pd.to_datetime(df["Datetime"], format="mixed")
    df = df.sort_values("Datetime").reset_index(drop=True)
    df["EBH"] = df["EBH"].clip(lower=0)

    solar_db.bulk_insert_readings(SOLAR_DEFAULT_SITE_ID, df[required])
    solar_db.set_meta(SOLAR_DEFAULT_SITE_ID, "bootstrap_end", df["Datetime"].max().isoformat())
    return {"rows_loaded": len(df)}


@app.post("/api/solar/readings", response_model=SolarPredictionOut)
def solar_submit_reading(reading: SolarReadingIn):
    """Submit hourly reading and get forecast"""
    row = {
        "Datetime": reading.datetime,
        "GHI": reading.GHI, "DNI": reading.DNI, "DHI": reading.DHI, "EBH": reading.EBH,
        "AirTemperature": reading.AirTemperature, "CloudOpacity": reading.CloudOpacity,
        "Production": reading.Production,
    }

    # Check continuity BEFORE inserting: lag features (GL1, PL1, ...) are
    # computed by shifting rows, not by actual elapsed time. If there's a
    # gap since the last stored reading, "1 row back" silently becomes
    # "N hours back", quietly corrupting every lag/rolling/EWM feature.
    existing = solar_db.fetch_history(SOLAR_DEFAULT_SITE_ID, 1)
    if len(existing):
        last_ts = existing["Datetime"].iloc[-1]
        bootstrap_end = solar_db.get_meta(SOLAR_DEFAULT_SITE_ID, "bootstrap_end")
        # If the last stored reading IS the bootstrap boundary, no round
        # readings have been added since the last reset/fresh start — this
        # is the first reading of a new round, so it may use ANY timestamp
        # (nothing to be continuous with yet). Only readings after this
        # one, within the same round, must follow on hourly.
        is_fresh_round_start = bootstrap_end is not None and last_ts == pd.Timestamp(bootstrap_end)
        if not is_fresh_round_start:
            gap_hours = (reading.datetime - last_ts.to_pydatetime()).total_seconds() / 3600
            if gap_hours <= 0:
                raise HTTPException(
                    422,
                    f"This reading's timestamp ({reading.datetime}) is not after the last "
                    f"stored reading ({last_ts}). Readings must arrive in increasing time order.",
                )
            if gap_hours > 2:
                raise HTTPException(
                    400,
                    f"Invalid timestamp sequence. The last recorded reading is from {last_ts} "
                    f"and the current reading is {reading.datetime}, creating a gap of approximately "
                    f"{gap_hours:.0f} hours.\n\n"
                    f"This forecasting system is intentionally designed for sequential "
                    f"time-series prediction and expects readings at regular hourly intervals. "
                    f"The next expected timestamp is approximately {last_ts + pd.Timedelta(hours=1)}.\n\n"
                    f"Please continue by submitting the next hourly reading, or start a new "
                    f"forecasting session by uploading a new bootstrap dataset."
                )

    solar_db.insert_reading(SOLAR_DEFAULT_SITE_ID, row)

    history = solar_db.fetch_history(SOLAR_DEFAULT_SITE_ID, SOLAR_HISTORY_WINDOW_HOURS)
    if len(history) < 2:
        raise HTTPException(
            422,
            "Not enough history yet to compute lag/rolling features. "
            "Bootstrap with historical data first via /api/solar/bootstrap.",
        )

    vmd_values = solar_get_vmd_values(SOLAR_DEFAULT_SITE_ID)
    feature_row = solar_build_feature_row(history, vmd_values)
    prediction = solar_model_service.predict_quantiles(feature_row)

    # We don't have real metered production yet (that's what we just
    # forecasted), so backfill this reading's Production with our own q50
    # estimate instead of leaving it at 0. Keeps future lag/EWM features
    # self-consistent with what the model saw in training. If you later
    # get the true metered value for this timestamp, overwrite it via
    # solar_db.update_production() with the real number.
    solar_db.update_production(SOLAR_DEFAULT_SITE_ID, reading.datetime, prediction["q50"])

    vmd_cache = solar_db.get_vmd_cache(SOLAR_DEFAULT_SITE_ID)
    rho, ev_signal = compute_ev_signal(prediction["q05"], prediction["q50"], prediction["q95"])
    result_payload = {
        "q025": prediction["q05"], "q50": prediction["q50"], "q975": prediction["q95"],
        "rho": rho, "ev_signal": ev_signal,
    }
    weather = {
        "GHI": reading.GHI, "DNI": reading.DNI, "DHI": reading.DHI, "EBH": reading.EBH,
        "AirTemperature": reading.AirTemperature, "CloudOpacity": reading.CloudOpacity,
    }
    explanation = solar_generate_explanation(result_payload, weather)
    return SolarPredictionOut(
        datetime=reading.datetime,
        q025=prediction["q05"],
        q50=prediction["q50"],
        q975=prediction["q95"],
        vmd_best_k=vmd_cache["best_k"] if vmd_cache else 0,
        rho=rho,
        ev_signal=ev_signal,
        explanation=explanation,
    )


@app.get("/api/solar/history")
def solar_get_history(hours: int = 48):
    """Get recent solar readings"""
    df = solar_db.fetch_history(SOLAR_DEFAULT_SITE_ID, hours)
    return df.to_dict(orient="records")


@app.post("/api/solar/rounds/reset")
def solar_reset_round():
    """Discards every reading added during the current round, restoring
    the site back to the clean bootstrap CSV baseline. Use this to start
    a fresh round without hitting timestamp-continuity errors."""
    boundary = solar_db.reset_round(SOLAR_DEFAULT_SITE_ID)
    if not boundary:
        raise HTTPException(
            400, "No bootstrap baseline found. Load historical data via /api/solar/bootstrap first."
        )
    return {"reset_to": boundary}


# ─────────────────────────────────────────────────────────────────────────────
# BATTERY HEALTH
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/battery/health")
def battery_health():
    """Battery API health check"""
    if not BATTERY_AVAILABLE:
        raise HTTPException(status_code=503, detail="Battery module not available - Python 3.14 requires TensorFlow compatibility update")
    return {
        "status": "ok",
        "model_loaded": battery_bundle is not None,
        "groq_key_loaded": bool(os.environ.get("GROQ_API_KEY")),
    }


@app.get("/api/battery/csv-template")
def battery_csv_template():
    """Returns an example CSV with the required columns"""
    if not BATTERY_AVAILABLE:
        raise HTTPException(status_code=503, detail="Battery module not available")
    header = ",".join(BATTERY_REQUIRED_COLS)
    example_rows = []
    cap = 2.0
    for cycle in range(1, 21):
        cap -= 0.01
        example_rows.append(
            f"{cycle},{cap:.4f},1.5,4.2,24.0,-2.0,3.6,25.0,3200,3.3,4.2,0.9,7.1,0.045,0.08"
        )
    csv_text = header + "\n" + "\n".join(example_rows)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="battery_template.csv"'},
    )


def _run_battery_prediction(df, battery_id: Optional[str] = None):
    """Shared prediction logic for battery health"""
    if not BATTERY_AVAILABLE or battery_bundle is None:
        raise HTTPException(status_code=503, detail="Battery module not available")
    df_eng = battery_engineer_features(df)
    x_seq, x_vel, latest_soh, latest_cycle, recent_deg_rate, X_raw = battery_build_model_inputs(df_eng, battery_bundle.scaler_X)

    warnings = battery_check_out_of_range(X_raw, battery_bundle.scaler_X)  # OOD warnings come first — most important
    is_ood = len(warnings) > 0
    if len(df) < 20:
        warnings.append(
            f"Only {len(df)} cycles supplied — rolling/degradation-trend features are more reliable with 20-25+."
        )

    result = battery_bundle.predict(x_seq, x_vel)
    eol_70 = battery_estimate_trend_crossing(latest_soh, latest_cycle, recent_deg_rate, EOL_THRESHOLD)
    early_warn_80 = battery_estimate_trend_crossing(latest_soh, latest_cycle, recent_deg_rate, EOL_WARN_THRESHOLD)

    return BatteryPredictionResponse(
        battery_id=battery_id,
        n_cycles_received=len(df),
        latest_cycle=latest_cycle,
        soh_percent=round(result["soh_mean"], 3),
        soh_std=round(result["soh_std"], 4),
        soh_ci_95=[round(v, 3) for v in result["soh_ci_95"]],
        health_class=result["health_class"],
        rul_relative_pct=round(result["rul_relative_pct"], 2),
        rue_relative_pct=round(result["rue_relative_pct"], 2),
        rul_reference_range_cycles=list(battery_bundle.rul_reference_range),
        eol_70_estimate=TrendCrossing(**eol_70) if eol_70 else None,
        early_warning_80=TrendCrossing(**early_warn_80) if early_warn_80 else None,
        mc_samples=result["mc_samples"],
        out_of_distribution=is_ood,
        warnings=warnings,
    )


@app.post("/api/battery/predict")
async def battery_predict(file: UploadFile = File(...), battery_id: Optional[str] = Form(None)):
    """Upload CSV of discharge cycles and get battery health prediction"""
    if not BATTERY_AVAILABLE:
        raise HTTPException(status_code=503, detail="Battery module not available - Python 3.14 requires TensorFlow compatibility update")
    if battery_bundle is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet, try again shortly.")

    raw_bytes = await file.read()
    try:
        df = battery_parse_csv(raw_bytes)
    except BatteryFeatureEngineeringError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return _run_battery_prediction(df, battery_id=battery_id)


class BatteryExplainRequest(BaseModel):
    prediction: dict  # dict avoids a conditional/optional pydantic type when the battery module is unavailable


class BatteryExplainResponse(BaseModel):
    explanation: str


@app.post("/api/battery/explain", response_model=BatteryExplainResponse)
async def battery_explain(req: BatteryExplainRequest):
    """Generate plain-English explanation for a battery prediction (requires GROQ_API_KEY)"""
    if not BATTERY_AVAILABLE:
        raise HTTPException(status_code=503, detail="Battery module not available")
    try:
        text = battery_generate_explanation(req.prediction)
    except ExplainabilityError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return BatteryExplainResponse(explanation=text)