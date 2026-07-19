"""
SQLite storage. One file, no server to run — swap for Postgres later by
changing only the connection string if this grows past a single box.
"""
import sqlite3
import pandas as pd
from contextlib import contextmanager

from .config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS readings (
    site_id         TEXT    NOT NULL,
    datetime        TEXT    NOT NULL,
    ghi             REAL,
    dni             REAL,
    dhi             REAL,
    ebh             REAL,
    air_temperature REAL,
    cloud_opacity   REAL,
    production      REAL,
    PRIMARY KEY (site_id, datetime)
);

CREATE TABLE IF NOT EXISTS vmd_cache (
    site_id       TEXT PRIMARY KEY,
    best_k        INTEGER,
    computed_at   TEXT,
    window_start  TEXT,
    window_end    TEXT,
    -- last known mode values, forward-filled for new timestamps until
    -- the next refresh (see vmd_service.py)
    last_v1 REAL, last_v2 REAL, last_v3 REAL,
    last_v4 REAL, last_v5 REAL, last_v6 REAL,
    last_vmd_res REAL, last_vmd_recon REAL
);

CREATE TABLE IF NOT EXISTS meta (
    site_id TEXT NOT NULL,
    key     TEXT NOT NULL,
    value   TEXT,
    PRIMARY KEY (site_id, key)
);
"""


def set_meta(site_id: str, key: str, value: str):
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO meta (site_id, key, value) VALUES (?,?,?)",
            (site_id, key, value),
        )


def get_meta(site_id: str, key: str):
    with get_conn() as conn:
        cur = conn.execute("SELECT value FROM meta WHERE site_id=? AND key=?", (site_id, key))
        row = cur.fetchone()
    return row["value"] if row else None


def reset_round(site_id: str):
    """Deletes every reading added AFTER the real bootstrap CSV's data ends,
    restoring the site back to its clean, known-good baseline. Also clears
    the VMD cache so it gets recomputed fresh from the clean baseline on
    the next prediction, instead of reflecting round data that's now gone."""
    boundary = get_meta(site_id, "bootstrap_end")
    with get_conn() as conn:
        if boundary:
            conn.execute(
                "DELETE FROM readings WHERE site_id=? AND datetime > ?", (site_id, boundary)
            )
        conn.execute("DELETE FROM vmd_cache WHERE site_id=?", (site_id,))
    return boundary


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        conn.executescript(SCHEMA)


def insert_reading(site_id: str, row: dict):
    """row keys: Datetime, GHI, DNI, DHI, EBH, AirTemperature, CloudOpacity, Production"""
    with get_conn() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO readings
               (site_id, datetime, ghi, dni, dhi, ebh, air_temperature, cloud_opacity, production)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (
                site_id,
                pd.Timestamp(row["Datetime"]).isoformat(),
                row.get("GHI"), row.get("DNI"), row.get("DHI"), row.get("EBH"),
                row.get("AirTemperature"), row.get("CloudOpacity"), row.get("Production"),
            ),
        )


def bulk_insert_readings(site_id: str, df: pd.DataFrame):
    """df must have Datetime, GHI, DNI, DHI, EBH, AirTemperature, CloudOpacity, Production"""
    with get_conn() as conn:
        rows = [
            (
                site_id, pd.Timestamp(r.Datetime).isoformat(),
                r.GHI, r.DNI, r.DHI, r.EBH, r.AirTemperature, r.CloudOpacity, r.Production,
            )
            for r in df.itertuples(index=False)
        ]
        conn.executemany(
            """INSERT OR REPLACE INTO readings
               (site_id, datetime, ghi, dni, dhi, ebh, air_temperature, cloud_opacity, production)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            rows,
        )


def fetch_history(site_id: str, hours: int) -> pd.DataFrame:
    """Returns the last `hours` rows for a site, ascending by time."""
    with get_conn() as conn:
        cur = conn.execute(
            """SELECT datetime, ghi, dni, dhi, ebh, air_temperature, cloud_opacity, production
               FROM readings WHERE site_id=? ORDER BY datetime DESC LIMIT ?""",
            (site_id, hours),
        )
        rows = cur.fetchall()
    if not rows:
        return pd.DataFrame(columns=[
            "Datetime", "GHI", "DNI", "DHI", "EBH",
            "AirTemperature", "CloudOpacity", "Production",
        ])
    df = pd.DataFrame(rows, columns=[
        "datetime", "ghi", "dni", "dhi", "ebh",
        "air_temperature", "cloud_opacity", "production",
    ])
    df = df.rename(columns={
        "datetime": "Datetime", "ghi": "GHI", "dni": "DNI", "dhi": "DHI",
        "ebh": "EBH", "air_temperature": "AirTemperature",
        "cloud_opacity": "CloudOpacity", "production": "Production",
    })
    df["Datetime"] = pd.to_datetime(df["Datetime"])
    return df.sort_values("Datetime").reset_index(drop=True)


def update_production(site_id: str, timestamp, production: float):
    """Overwrite the Production value for an already-stored reading.
    Used to feed the model's own q50 forecast back into history when real
    metered production isn't known yet (keeps lag/rolling/EWM features
    self-consistent instead of artificially zero), and later to backfill
    the true metered value once it's known."""
    with get_conn() as conn:
        conn.execute(
            "UPDATE readings SET production=? WHERE site_id=? AND datetime=?",
            (production, site_id, pd.Timestamp(timestamp).isoformat()),
        )


def get_vmd_cache(site_id: str):
    with get_conn() as conn:
        cur = conn.execute("SELECT * FROM vmd_cache WHERE site_id=?", (site_id,))
        row = cur.fetchone()
    return dict(row) if row else None


def save_vmd_cache(site_id: str, best_k: int, computed_at, window_start, window_end,
                    last_modes: dict, last_vmd_res: float, last_vmd_recon: float):
    with get_conn() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO vmd_cache
               (site_id, best_k, computed_at, window_start, window_end,
                last_v1, last_v2, last_v3, last_v4, last_v5, last_v6,
                last_vmd_res, last_vmd_recon)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                site_id, best_k,
                pd.Timestamp(computed_at).isoformat(),
                pd.Timestamp(window_start).isoformat(),
                pd.Timestamp(window_end).isoformat(),
                last_modes.get("V1", 0.0), last_modes.get("V2", 0.0),
                last_modes.get("V3", 0.0), last_modes.get("V4", 0.0),
                last_modes.get("V5", 0.0), last_modes.get("V6", 0.0),
                last_vmd_res, last_vmd_recon,
            ),
        )
