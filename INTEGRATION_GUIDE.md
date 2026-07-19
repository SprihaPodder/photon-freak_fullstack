# PhotonFreak full-stack integration

This folder contains your original frontend with only two additions:

- `/faults`: a small top button that smoothly scrolls to a panel-image upload and SolarGuard-Net result.
- `/charging`: a small top button that smoothly scrolls to a user-input PSO-GA optimiser with **Quick preview** and **Refine schedule** actions.

Everything already displayed on both pages is unchanged.

## Important: no model retraining is needed

`solarguard_best_seed0.pth` (and the other `best` / `swa` `.pth` files) are PyTorch `state_dict` checkpoints. A `.pkl` or `.h5` file is neither required nor preferable here. The backend rebuilds the same `SolarGuardNet` architecture and loads your saved weights. Use `solarguard_best_seed0.pth` first; optionally put several checkpoint paths in `SOLARGUARD_CHECKPOINT`, comma-separated, to average their probabilities.

The EV work is an optimiser, not a trained model. It must run again for each new input. The quick path uses 20 candidates / 18 PSO steps / 18 GA generations; Refine uses 40 / 60 / 60, matching the research-scale budget more closely. The returned result is therefore new for the submitted values.

## 1. Start the backend

Run these commands in Terminal from `backend`:

```bash
python3 -m venv .venv
source .venv/bin/activate             # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` and set the saved checkpoint path, for example:

```env
SOLARGUARD_CHECKPOINT=/Users/sprihapodder/Desktop/Projects/PhotonFreakNew/ml/solarguard/outputs/solarguard_best_seed0.pth
ALLOWED_ORIGINS=http://localhost:3000
```

Then load the environment and run FastAPI:

```bash
set -a; source .env; set +a
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs` to test the API. The first fault prediction can take a few seconds because the checkpoint is loaded once when the server starts.

## 2. Start the frontend

In a second Terminal, from this project root:

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

Visit `http://localhost:3000/faults` and `http://localhost:3000/charging`.

## Production notes

- Do not commit `.env` or checkpoint files. They are already valuable binary artifacts and `solarguard_best_seed0.pth` is about 79 MB.
- For deployment, set `NEXT_PUBLIC_API_URL` to the deployed HTTPS API URL and add the deployed frontend URL to `ALLOWED_ORIGINS`.
- The browser sends only the selected image or form data to FastAPI. The checkpoint stays on the server.
- The supplied charging UI accepts comma-separated hourly solar and price arrays. A single value repeats over the selected horizon; shorter arrays repeat to fill it. This keeps the initial UI compact while allowing real profile data.
