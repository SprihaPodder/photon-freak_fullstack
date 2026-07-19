"""
One-off CLI to seed the site's history from a local CSV (e.g.
Data_Kraljevo.csv) without going through the HTTP API. Useful for initial
setup or backfills.

Usage:
    python data_loader.py path/to/Data_Kraljevo.csv
"""
import sys
import pandas as pd

from app import db
from app.config import DEFAULT_SITE_ID


def main(csv_path: str):
    df = pd.read_csv(csv_path)
    df.columns = [c.strip() for c in df.columns]
    if "Production" not in df.columns:
        prod_cols = [c for c in df.columns if "production" in c.lower()]
        if prod_cols:
            df = df.rename(columns={prod_cols[0]: "Production"})

    required = ["Datetime", "GHI", "DNI", "DHI", "EBH", "AirTemperature", "CloudOpacity", "Production"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise SystemExit(f"CSV missing required columns: {missing}")

    df["Datetime"] = pd.to_datetime(df["Datetime"], format="mixed")
    df = df.sort_values("Datetime").reset_index(drop=True)
    df["EBH"] = df["EBH"].clip(lower=0)

    db.init_db()
    db.bulk_insert_readings(DEFAULT_SITE_ID, df[required])
    db.set_meta(DEFAULT_SITE_ID, "bootstrap_end", df["Datetime"].max().isoformat())
    print(f"Loaded {len(df):,} rows")
    print(f"Date range: {df['Datetime'].min()} -> {df['Datetime'].max()}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python data_loader.py <csv_path>")
    main(sys.argv[1])
