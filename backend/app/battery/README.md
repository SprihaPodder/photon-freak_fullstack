# Battery Health Optimizer — Backend

FastAPI service wrapping the DVG-BiLSTM model from `novel_battery_model_NASA_v9.keras`
(paper: *DVG-BiLSTM: Cross-Battery Contrastive Regularisation with Degradation-Velocity
Gated Attention for Multi-Output Battery State Estimation under Uncertainty*).

## Setup

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Then open `http://localhost:8000/docs` for the interactive API docs.

## Endpoints

- `GET  /health` — liveness check
- `GET  /csv-template` — downloads an example CSV in the exact required schema
- `POST /predict` — multipart form: `file` (CSV, required), `battery_id` (string, optional)

## CSV input contract

One row per discharge cycle, **oldest cycle first**, minimum 15 rows (20–25+
recommended so the rolling degradation features are meaningful):

```
cycle, Capacity, chI, chV, chT, disI, disV, disT, BCt,
disV_min, disV_max, disV_range, dis_energy, Re, Rct
```

| Column | Meaning |
|---|---|
| `cycle` | cycle index |
| `Capacity` | discharge capacity for that cycle, Ah. SOH is computed relative to the **first row's** capacity in the file — so the first row in your CSV should be that battery's healthiest/earliest known cycle. |
| `chI, chV, chT` | mean charge current/voltage/temperature |
| `disI, disV, disT` | mean discharge current/voltage/temperature |
| `disV_min, disV_max, disV_range` | discharge voltage extremes |
| `BCt` | charge operation duration, seconds |
| `dis_energy` | energy discharged that cycle, Wh |
| `Re, Rct` | EIS impedance (ohmic / charge-transfer resistance). Use `0` if you don't measure this — the training pipeline also defaults to 0 when unavailable. |

The backend derives the 5 remaining model features (`deg_rate`, `deg_anomaly`,
`cum_deg`, `ic_proxy`, `cap_rolling_std`) from this history automatically,
using the identical logic from the training script (`feature_engineering.py`).

## What the response means (and why)

- **`soh_percent` / `soh_ci_95` / `health_class`** — the trustworthy, primary
  output. State of Health as an absolute 0–100% value, from a 60-pass
  MC-Dropout ensemble (mean ± 2σ = 95% CI), classified Healthy (≥90%) /
  Degraded (70–90%) / Critical (<70%) exactly as in the paper.

- **`rul_relative_pct` / `rue_relative_pct`** — **not** absolute cycles or Wh.
  ⚠️ Read this carefully before wiring these into anything decision-critical:

  The model's RUL/RUE output heads are trained on a **per-battery normalized
  scale** — during training, each battery's RUL/RUE targets were divided by
  that specific battery's own maximum observed RUL/RUE
  (`rul_max_per_bat[battery_id]`). That scale factor only exists for the 7
  batteries seen during training (4 NASA cells + 3 augmentation cells) — it's
  saved in `rul_max_per_bat.pkl`, keyed by an internal integer battery index,
  **not** by any identifier a new battery would have. **`rue_max_per_bat.pkl`
  was never saved by the training script at all** — it's absent even for the
  training batteries.

  So for a battery uploaded through this API (which, by definition, wasn't
  one of the 7 training batteries), there is no correct denormalization
  factor. Multiplying the model's raw [0,1] output by an arbitrary reference
  battery's max would silently fabricate a specific-looking cycle count.

  Given that, this API reports the model's raw output as a **relative
  percentage (0–100%) of that per-battery-normalized scale**, alongside the
  `rul_reference_range_cycles` context (the min/max RUL, in cycles, observed
  across the 4 NASA training batteries) purely so a human can sanity-check
  the number, without ever presenting a false-precision absolute figure.

- **`eol_70_estimate` / `early_warning_80`** — a straightforward linear
  extrapolation of *your uploaded battery's own recent degradation trend*
  (mean SOH-loss/cycle over the last 5 cycles) to the 70% (end-of-life) and
  80% (second-life/maintenance) thresholds, mirroring the paper's Early
  Warning System (§4.5). This is **not** a model output — it's a transparent
  trend calculation directly on your data, and is a more honest way to give
  cycle-denominated guidance for any battery, seen during training or not.

## A note on the `.keras` file

`tf.keras.models.load_model()` will fail on current TensorFlow/Keras versions
for this file — it uses a custom `MCDropout` layer and `Lambda` layers that
don't survive Keras 3's stricter deserialization rules. `model_utils.py`
works around this by rebuilding the exact architecture in code (copied from
the training script) and loading only the **weights** via
`model.load_weights()`, which works because the layer names match exactly.
If you retrain and re-save the model, keep this loading strategy, or migrate
to `model.save_weights(...)` + a versioned architecture file going forward
to avoid the fragility of full-model serialization with custom layers.

## Files

```
backend/
  main.py                 FastAPI app, /predict endpoint
  model_utils.py           model architecture + weight loading + MC-Dropout inference
  feature_engineering.py   CSV parsing + exact feature replication from training script
  schemas.py                Pydantic response schema
  requirements.txt
  artifacts/                novel_battery_model_NASA_v9.keras, scaler_X.pkl, scaler_soh.pkl, rul_max_per_bat.pkl
```
