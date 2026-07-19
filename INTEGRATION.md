# PhotonFreak Fullstack Integration Guide

## Overview
This backend now integrates three major subsystems:

1. **Fault Detection & Charging Optimization** (Original)
   - Solar panel fault prediction from images
   - Charging schedule optimization

2. **Solar Forecasting** (Integrated)
   - Probabilistic solar production forecasts
   - 58-feature engineering pipeline
   - Variational Mode Decomposition (VMD)
   - EV charging recommendations

3. **Battery Health Optimization** (Integrated)
   - DVG-BiLSTM neural network for SOH/RUL/RUE prediction
   - MC-Dropout uncertainty quantification
   - Out-of-distribution warnings
   - Trend-based early warning system

## API Endpoints

### Health & Status
- `GET /api/health` - Combined health check for all backends

### Fault Prediction (Original)
- `POST /api/faults/predict` - Upload solar panel image for fault detection

### Charging Optimization (Original)
- `POST /api/charging/optimise` - Optimize charging schedule

### Solar Forecasting (NEW)
- `POST /api/solar/bootstrap` - Upload historical CSV to seed site history
- `POST /api/solar/readings` - Submit hourly reading, get forecast
- `GET /api/solar/history` - Get recent readings (debugging)

### Battery Health (NEW)
- `GET /api/battery/health` - Battery health check
- `GET /api/battery/csv-template` - Download CSV template
- `POST /api/battery/predict` - Upload discharge cycle CSV, get SOH/RUL/RUE
- `POST /api/battery/explain` - Generate plain-English explanation

## Installation & Setup

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
cp backend/.env.example backend/.env
# Edit .env and add your GROQ_API_KEY for explanations (optional)
```

### 3. Prepare Model Artifacts

#### Solar Forecasting
- Place `models.pkl` (LightGBM quantile models) in `backend/`
- Database will auto-initialize as `solar_forecast.db`

#### Battery Health
- Model artifacts already included in `backend/app/battery/artifacts/`:
  - `novel_battery_model_NASA_v9.keras` ✓
  - `scaler_X.pkl` ✓
  - `scaler_soh.pkl` ✓
  - `rul_max_per_bat.pkl` ✓

### 4. Run the Backend
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Architecture

```
backend/app/
├── main.py                    # Unified FastAPI app with all routes
├── model.py                   # Fault prediction model
├── optimizer.py               # Charging optimization
├── solar/                     # Solar forecasting subsystem
│   ├── config.py             # Configuration (paths, windows, etc.)
│   ├── db.py                 # SQLite storage
│   ├── model_service.py      # LightGBM quantile models
│   ├── feature_engineering.py # 58-feature pipeline
│   ├── vmd_service.py        # Variational Mode Decomposition
│   └── explain_service.py    # Groq LLM explanations
├── battery/                   # Battery health subsystem
│   ├── model_utils.py        # DVG-BiLSTM model loading
│   ├── feature_engineering.py # Degradation features
│   ├── explainability.py     # Groq LLM explanations
│   ├── schemas.py            # Pydantic response models
│   └── artifacts/            # Pre-trained models
│       ├── novel_battery_model_NASA_v9.keras
│       ├── scaler_X.pkl
│       ├── scaler_soh.pkl
│       └── rul_max_per_bat.pkl
```

## Key Features

### Solar Forecasting
- **Probabilistic forecasts**: q0.025, q0.50, q0.975 (95% prediction interval)
- **Relative uncertainty** (rho): helps assess forecast confidence
- **EV charging signal**: 1.0 (full), 0.5 (partial), 0.0 (none)
- **Adaptive VMD**: Automatically selects decomposition modes
- **Lag features**: Up to 72-hour historical context
- **Rolling windows** & **exponential decay**: Capture recent trends

### Battery Health
- **MC-Dropout**: 60 stochastic forward passes for uncertainty
- **Multi-head attention**: Captures degradation patterns
- **Degradation velocity**: 3D velocity vector (recent trend, volatility, latest)
- **Trend crossing**: Linear extrapolation to EOL/warning thresholds
- **Out-of-distribution detection**: Warns when battery is outside training range
- **Health classification**: Healthy (≥90%), Degraded (70-90%), Critical (<70%)

## Data Formats

### Solar Forecasting - Bootstrap CSV
```csv
Datetime,GHI,DNI,DHI,EBH,AirTemperature,CloudOpacity,Production
2024-01-01 00:00,0,0,0,0,15.0,0.0,0.0
2024-01-01 01:00,0,0,0,0,14.5,0.0,0.0
...
```

### Battery Health - Discharge Cycle CSV
```csv
cycle,Capacity,chI,chV,chT,disI,disV,disT,BCt,disV_min,disV_max,disV_range,dis_energy,Re,Rct
1,2.0,1.5,4.2,24.0,-2.0,3.6,25.0,3200,3.3,4.2,0.9,7.1,0.045,0.08
2,1.98,1.5,4.2,24.0,-2.0,3.6,25.0,3200,3.3,4.2,0.9,7.0,0.046,0.09
...
```

## Troubleshooting

### Solar Models Not Loading
- Ensure `models.pkl` exists in `backend/`
- Check logs for pickle compatibility errors

### Battery Model Not Loading
- Verify artifacts exist in `backend/app/battery/artifacts/`
- Ensure TensorFlow/Keras versions match training environment

### Explanations Failing (Optional)
- Set `GROQ_API_KEY` in `.env` for LLM explanations
- If not set, API returns template-based explanations (still functional)

### Database Issues
- Solar: Delete `solar_forecast.db` to reset
- Battery: Uses only in-memory model (no database)

## Performance Notes

- **Solar**: ~50-100ms per prediction (after bootstrapping)
- **Battery**: ~2-5s per prediction (60 MC-Dropout samples)
- **Fault**: Depends on image size (typically <1s)

## Future Enhancements

- [ ] Multi-site support for solar forecasting
- [ ] Postgres backend for solar storage (instead of SQLite)
- [ ] Real-time streaming predictions
- [ ] Advanced explainability (SHAP, attention visualization)
- [ ] A/B testing framework for model updates
