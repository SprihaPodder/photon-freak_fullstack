# Solar forecast backend

FastAPI backend around your three LightGBM quantile models (q05/q50/q95),
matching the feature engineering in `solar_photonfreak_v2.py`.

## Why this isn't a single stateless endpoint

The model needs 58 engineered features per prediction, and many of them
depend on history: `GL1...GL48` (GHI lags, hourly), `PL1...PL24` (production
lags), rolling means, EWM smoothing, and 6 VMD decomposition modes. A single
"current reading" from the frontend cannot produce these on its own — the
backend has to remember the past. That's what this project adds:

- **SQLite** (`solar_forecast.db`) stores every reading per site.
- **`feature_engineering.py`** reproduces `engineer_features()` from your
  training script exactly (same lags, same rolling windows, same order).
- **`vmd_service.py`** handles the VMD modes. VMD decomposes a whole
  signal window at once — it is not a per-row calculation — so it is
  **not** recomputed on every request. It refreshes on a schedule
  (`VMD_REFRESH_EVERY_HOURS` in `config.py`, default every 6h) and caches
  the latest mode values, which are reused for predictions until the next
  refresh.

## Setup

```bash
pip install -r requirements.txt
cp /path/to/your/models.pkl .        # must sit next to app/ (see config.py)
```

## Seed with historical data

Either via CLI:
```bash
python data_loader.py Data_Kraljevo.csv
```
or via the API:
```bash
curl -X POST http://localhost:8000/bootstrap \
  -F "file=@Data_Kraljevo.csv"
```

## Run the server

```bash
uvicorn app.main:app --reload
```

## Submit a new hourly reading and get a forecast

```bash
curl -X POST http://localhost:8000/readings \
  -H "Content-Type: application/json" \
  -d '{
        "datetime": "2024-06-15T13:00:00",
        "GHI": 720.5, "DNI": 640.2, "DHI": 110.3, "EBH": 55.1,
        "AirTemperature": 28.4, "CloudOpacity": 12.0,
        "Production": 0
      }'
```

Response:
```json
{
  "datetime": "2024-06-15T13:00:00",
  "q05": 410.2,
  "q50": 512.7,
  "q95": 601.9,
  "vmd_best_k": 5
}
```

`q50` is the point forecast; `q05`/`q95` form the 90% prediction interval —
exactly the shape your training script outputs.

`Production` in the request is what you know so far (0 or the actual
metered value if this is a backfill) — it becomes tomorrow's lag feature,
so keep submitting readings as they arrive rather than only at prediction
time.

## Single site, built to extend later

This deployment is single-site: there's no `site_id` anywhere in the API,
so the frontend just calls `/readings` and `/bootstrap` directly — nothing
to configure or pass around. Internally, storage and VMD caching are still
keyed by a constant `DEFAULT_SITE_ID` (in `app/config.py`), so if a second
site ever comes up, it's a matter of re-introducing that one parameter
through the endpoints — not a rewrite.

## Frontend integration

Point your new grid at `POST /readings`: send the raw weather + time
reading the user enters, display `q50` as the forecast and `q05`-`q95` as
a shaded confidence band (this mirrors Fig 7 in your training script's
plots).

## Known limitation to be aware of

VMD, by construction, was applied to the *entire* historical signal during
training (which is a form of look-ahead within that batch — you saw future
values while decomposing). This backend instead computes VMD periodically
on a trailing window (`VMD_WINDOW_HOURS`, default 720h/30 days) and reuses
the latest cached mode values between refreshes. This is the standard
practical compromise for deploying VMD-based models, but it means the VMD
features are slightly stale between refreshes and not identical to what
training saw. If you notice prediction quality drift over time, shortening
`VMD_REFRESH_EVERY_HOURS` is the first thing to try.
