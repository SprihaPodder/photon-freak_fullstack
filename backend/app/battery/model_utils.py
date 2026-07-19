"""
model_utils.py
==============
Loads the DVG-BiLSTM battery model + scalers exactly as trained in
novel_battery_model_NASA_v7_test1.py.

IMPORTANT: the shipped .keras file cannot be loaded with a plain
tf.keras.models.load_model() on current TensorFlow/Keras — the custom
MCDropout layer and the Lambda layers (dvg gate mechanism) don't
deserialize cleanly on newer Keras (3.x) because of stricter Lambda
safety rules and the missing custom_object registration in the artifact.

Fix used here (verified working): rebuild the exact architecture in code
(copied 1:1 from the training script's build_model()) and load only the
WEIGHTS from the .keras file via model.load_weights(). Since layer names
match exactly, this loads correctly.
"""
import os
import numpy as np
import joblib
import tensorflow as tf
from tensorflow.keras.layers import (
    LSTM, Bidirectional, GaussianNoise, Dropout, Dense, Input,
    MultiHeadAttention, LayerNormalization, Concatenate, Add,
    GlobalAveragePooling1D, Lambda,
)
from tensorflow.keras.regularizers import l2
from tensorflow.keras.models import Model

ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "artifacts")

# ── Config — must match training script exactly ─────────────────────────
TIME_STEPS = 15
L2_REG = 5e-5
DROPOUT_RATE = 0.15
NOISE_STD = 0.007
N_FEAT = 18
EOL_THRESHOLD = 70.0        # RUL denominator threshold (paper section 4.5)
EOL_WARN_THRESHOLD = 80.0   # Early-warning / second-life threshold

# Exact feature order the model & scaler_X were fit on
PROFILE_COLS = [
    "chI", "chV", "chT", "disI", "disV", "disT", "BCt",
    "disV_min", "disV_max", "disV_range", "dis_energy", "Re", "Rct",
]
ENGINEERED_COLS = ["deg_rate", "deg_anomaly", "cum_deg", "ic_proxy", "cap_rolling_std"]
ALL_FEAT_COLS = PROFILE_COLS + ENGINEERED_COLS  # 13 + 5 = 18
DEG_ANOM_IDX = ALL_FEAT_COLS.index("deg_anomaly")

MC_SAMPLES_API = 60  # fewer than the paper's 150 (which is used offline) to keep API latency reasonable


class MCDropout(Dropout):
    """Dropout that respects the training flag — ON for MC passes, OFF for deterministic eval."""
    def call(self, inputs, training=None):
        return super().call(inputs, training=training)


def build_model(ts=TIME_STEPS, n_feat=N_FEAT, n_heads=4, key_dim=32):
    """Exact copy of build_model() from novel_battery_model_NASA_v7_test1.py"""
    reg = l2(L2_REG)
    inp = Input(shape=(ts, n_feat), name="sequence_input")
    vel_inp = Input(shape=(3,), name="dvg_velocity_input")

    x = GaussianNoise(NOISE_STD)(inp)

    lstm1_out = Bidirectional(
        LSTM(96, return_sequences=True, kernel_regularizer=reg, recurrent_regularizer=reg),
        name="bilstm_1")(x)
    lstm1_out = MCDropout(DROPOUT_RATE, name="mc_dropout_1")(lstm1_out)

    attn = MultiHeadAttention(num_heads=n_heads, key_dim=key_dim, name="mha")(lstm1_out, lstm1_out)
    x_attended = LayerNormalization(name="ln_1")(lstm1_out + attn)

    vel_proj = Dense(192, activation="tanh", name="dvg_proj", kernel_regularizer=reg)(vel_inp)
    gate_alpha = Dense(1, activation="sigmoid", name="dvg_gate", kernel_regularizer=reg)(vel_inp)
    vel_t = Lambda(lambda v: tf.expand_dims(v, 1), name="vel_expand",
                    output_shape=lambda s: (s[0], 1, s[1]))(vel_proj)
    gate_t = Lambda(lambda g: tf.expand_dims(g, 1), name="gate_reshape",
                     output_shape=lambda s: (s[0], 1, s[1]))(gate_alpha)
    vel_res = Lambda(lambda t: t[0] * t[1], name="dvg_multiply",
                      output_shape=lambda s: s[0])([vel_t, gate_t])
    x_gated = Add(name="dvg_add")([x_attended, vel_res])

    lstm2_out = Bidirectional(
        LSTM(48, return_sequences=False, kernel_regularizer=reg, recurrent_regularizer=reg),
        name="bilstm_2")(x_gated)
    lstm2_out = MCDropout(DROPOUT_RATE, name="mc_dropout_2")(lstm2_out)

    lstm1_pool = GlobalAveragePooling1D(name="lstm1_pool")(lstm1_out)
    lstm1_skip = Dense(96, activation="relu", name="skip_proj", kernel_regularizer=reg)(lstm1_pool)
    x2 = Add(name="skip_add")([lstm2_out, lstm1_skip])

    fused = Concatenate(name="fused")([x2, vel_inp])
    shared = Dense(128, activation="relu", name="shared_dense", kernel_regularizer=reg)(fused)
    shared = MCDropout(0.10, name="mc_dropout_3")(shared)
    shared = Dense(64, activation="relu", name="shared_dense2", kernel_regularizer=reg)(shared)
    shared = Dense(32, activation="relu", name="shared_dense3", kernel_regularizer=reg)(shared)

    soh_out = Dense(1, activation="sigmoid", name="soh_output", kernel_regularizer=reg)(shared)
    rul_out = Dense(1, activation="sigmoid", name="rul_output", kernel_regularizer=reg)(shared)
    rue_out = Dense(1, activation="sigmoid", name="rue_output", kernel_regularizer=reg)(shared)

    return Model(inputs=[inp, vel_inp], outputs=[soh_out, rul_out, rue_out])


class BatteryModelBundle:
    """Loads model + scalers once at API startup and serves inference."""

    def __init__(self, artifact_dir: str = ARTIFACT_DIR):
        keras_path = os.path.join(artifact_dir, "novel_battery_model_NASA_v9.keras")
        scaler_x_path = os.path.join(artifact_dir, "scaler_X.pkl")
        scaler_soh_path = os.path.join(artifact_dir, "scaler_soh.pkl")
        rul_max_path = os.path.join(artifact_dir, "rul_max_per_bat.pkl")

        self.model = build_model()
        self.model.load_weights(keras_path)

        self.scaler_X = joblib.load(scaler_x_path)
        self.scaler_soh = joblib.load(scaler_soh_path)
        self.rul_max_per_bat = joblib.load(rul_max_path)

        # Reference context only (NOT used to denormalize a new/unseen battery —
        # see README: rue_max_per_bat.pkl was never saved by the training script,
        # and rul_max_per_bat indices only correspond to the 7 training batteries).
        # Indices 0-3 are the NASA batteries B0005/B0006/B0007/B0018 (alphabetical
        # category encoding), 4-6 are DS2 augmentation batteries.
        nasa_vals = [self.rul_max_per_bat[k] for k in sorted(self.rul_max_per_bat)[:4]]
        self.rul_reference_range = (min(nasa_vals), max(nasa_vals))

    # ── MC-Dropout stochastic forward pass ───────────────────────────
    def _mc_forward(self, x_seq: np.ndarray, x_vel: np.ndarray):
        return self.model([x_seq, x_vel], training=True)

    def predict(self, x_seq: np.ndarray, x_vel: np.ndarray, mc_samples: int = MC_SAMPLES_API):
        """
        x_seq: (1, TIME_STEPS, N_FEAT) already scaled with scaler_X
        x_vel: (1, 3) RAW (unscaled) degradation-velocity vector
        Returns dict with SOH point estimate + 95% CI, RUL/RUE relative %,
        health class, and MC-Dropout calibration info.
        """
        x_seq_t = tf.constant(x_seq, dtype=tf.float32)
        x_vel_t = tf.constant(x_vel, dtype=tf.float32)

        mc_soh, mc_rul, mc_rue = [], [], []
        for _ in range(mc_samples):
            s, r, e = self._mc_forward(x_seq_t, x_vel_t)
            mc_soh.append(float(s.numpy().flatten()[0]))
            mc_rul.append(float(r.numpy().flatten()[0]))
            mc_rue.append(float(e.numpy().flatten()[0]))

        mc_soh = np.array(mc_soh)
        mc_soh_real = self.scaler_soh.inverse_transform(mc_soh.reshape(-1, 1)).flatten()
        mc_soh_real = np.clip(mc_soh_real, 0.0, 100.0)

        soh_mean = float(mc_soh_real.mean())
        soh_std = float(mc_soh_real.std())
        ci_low = float(np.clip(soh_mean - 2 * soh_std, 0.0, 100.0))
        ci_high = float(np.clip(soh_mean + 2 * soh_std, 0.0, 100.0))

        rul_pct = float(np.mean(mc_rul) * 100.0)   # relative % — see RUL note in README
        rue_pct = float(np.mean(mc_rue) * 100.0)   # relative % — see RUE note in README

        return {
            "soh_mean": soh_mean,
            "soh_std": soh_std,
            "soh_ci_95": [ci_low, ci_high],
            "rul_relative_pct": rul_pct,
            "rue_relative_pct": rue_pct,
            "health_class": self.classify(soh_mean),
            "mc_samples": mc_samples,
        }

    @staticmethod
    def classify(soh: float) -> str:
        """Healthy >=90%, Degraded 70-90%, Critical <70% — thresholds from the paper."""
        if soh >= 90:
            return "Healthy"
        if soh >= 70:
            return "Degraded"
        return "Critical"
