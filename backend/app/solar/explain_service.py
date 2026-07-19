"""
Generates a plain-English explanation of the forecast for non-technical
users. Uses Groq's free API (https://console.groq.com) if GROQ_API_KEY is
set in the environment; otherwise (or if the call fails for any reason —
missing key, network issue, rate limit) falls back to a solid
template-based explanation so a demo never breaks because of this.
"""
import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()  # reads a .env file in the current working directory, if present

GROQ_API_KEY = os.environ.get("SOLAR_GROQ_API_KEY") or os.environ.get("GROQ_API_KEY")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")


def _fallback_explanation(payload: dict) -> str:
    q50, q025, q975, rho, signal = (
        payload["q50"], payload["q025"], payload["q975"], payload["rho"], payload["ev_signal"],
    )
    confidence = "high-confidence" if rho < 0.4 else "moderate-confidence" if rho < 1 else "low-confidence"
    charge_text = {
        1.0: "the system recommends full solar charging right now",
        0.5: "the system recommends partial solar charging right now",
        0.0: "solar charging isn't recommended at this hour",
    }[signal]
    return (
        f"Based on current sunlight and weather conditions, we expect around {q50:.1f} kW of solar "
        f"production this hour. There's a 95% chance the real output falls between {q025:.1f} kW and "
        f"{q975:.1f} kW — a {confidence} forecast. Given that, {charge_text}."
    )


def generate_explanation(payload: dict, weather: dict) -> str:
    if not GROQ_API_KEY:
        print("[explain] No GROQ_API_KEY set — using fallback template.")
        return _fallback_explanation(payload)
    try:
        prompt = (
            "You are an expert energy analyst explaining a solar power forecast to a plant operator "
            "who is not a data scientist. Write 4-6 sentences, plain English but substantive — not a "
            "generic summary. Specifically:\n"
            "1) State the expected production and what's driving it (mention the actual GHI/cloud/temp "
            "values, e.g. whether cloud cover or low irradiance is limiting output).\n"
            "2) Explain the 95% prediction interval in concrete terms — how wide is it relative to the "
            "forecast, and what does that width imply about confidence.\n"
            "3) Give the EV charging recommendation AND explain the reasoning behind the threshold "
            "(the rho/uncertainty ratio and the kW cutoffs), not just the verdict.\n"
            "4) Add one practical, forward-looking suggestion for the operator (e.g. what to watch for "
            "next, or how this compares to a typical hour).\n"
            "No bullet points, no headers — flowing prose. Do not just restate the numbers back; "
            "interpret them.\n\n"
            f"Weather inputs: {json.dumps(weather)}\n"
            f"Forecast (kW): lower bound (q0.025)={payload['q025']:.1f}, "
            f"median forecast (q0.50)={payload['q50']:.1f}, upper bound (q0.975)={payload['q975']:.1f}\n"
            f"Relative uncertainty (rho) = {payload['rho']:.2f}  [rho<0.4 tight/confident, 0.4-1.0 moderate, >1.0 wide/uncertain]\n"
            f"EV charging code: {payload['ev_signal']} (1.0=full solar charge [q50>100kW & rho<0.4], "
            f"0.5=partial [q50>50kW & 0.4<=rho<1.0], 0.0=none)"
        )
        resp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_MODEL,
                "max_tokens": 400,
                "temperature": 0.6,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=10.0,
        )
        if resp.status_code != 200:
            print(f"[explain] Groq API returned {resp.status_code}: {resp.text[:300]}")
        resp.raise_for_status()
        data = resp.json()
        text = data["choices"][0]["message"]["content"]
        print(f"[explain] Groq call succeeded ({len(text)} chars).")
        return text.strip() or _fallback_explanation(payload)
    except Exception as e:
        print(f"[explain] Groq call failed ({type(e).__name__}: {e}) — using fallback template.")
        return _fallback_explanation(payload)
