"""
explainability.py
==================
Turns a /predict response into a plain-English explanation a non-technical
user can actually understand, using Groq's fast LLM inference.

Requires GROQ_API_KEY to be set as an environment variable (see .env.example).
Never hardcode the key in source — load it from the environment only.
"""
import os
import requests

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"  # fast + cheap; swap to openai/gpt-oss-120b for higher quality if needed

SYSTEM_PROMPT = """You are explaining a lithium-ion battery health report to a non-technical user \
who has no background in electrochemistry or machine learning. Be clear, warm, and concrete. \
Avoid jargon; when you must use a technical term (like "SOH" or "confidence interval"), briefly \
define it in plain words the first time. Keep it to 3-5 short paragraphs. Do not invent numbers \
that weren't given to you — only explain the numbers you're given. If out_of_distribution is true, \
clearly and prominently warn the user that this specific prediction is less trustworthy, in plain \
language, before explaining the numbers."""


class ExplainabilityError(Exception):
    pass


def _build_user_prompt(result: dict) -> str:
    lines = [
        f"Battery ID: {result.get('battery_id') or 'not provided'}",
        f"Cycles analyzed: {result.get('n_cycles_received')} (up to cycle {result.get('latest_cycle')})",
        f"State of Health (SOH): {result.get('soh_percent')}%",
        f"95% confidence interval: {result.get('soh_ci_95')}",
        f"Health classification: {result.get('health_class')}",
        f"Relative Remaining Useful Life (RUL): {result.get('rul_relative_pct')}% "
        f"(reference range across training batteries: {result.get('rul_reference_range_cycles')} cycles)",
        f"Relative Remaining Useful Energy (RUE): {result.get('rue_relative_pct')}%",
        f"Trend-based 80% SOH (second-life) projection: {result.get('early_warning_80')}",
        f"Trend-based 70% SOH (end-of-life) projection: {result.get('eol_70_estimate')}",
        f"Out of the model's trained data range: {result.get('out_of_distribution')}",
        f"System warnings: {result.get('warnings')}",
    ]
    return "Explain this battery health report to the user:\n\n" + "\n".join(lines)


def generate_explanation(result: dict, timeout: float = 20.0) -> str:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ExplainabilityError(
            "GROQ_API_KEY is not set on the server. Add it to backend/.env (see .env.example) and restart the backend."
        )

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(result)},
        ],
        "temperature": 0.4,
        "max_tokens": 500,
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    try:
        resp = requests.post(GROQ_API_URL, json=payload, headers=headers, timeout=timeout)
    except requests.RequestException as e:
        raise ExplainabilityError(f"Could not reach Groq API: {e}")

    if resp.status_code != 200:
        raise ExplainabilityError(f"Groq API error ({resp.status_code}): {resp.text[:300]}")

    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError):
        raise ExplainabilityError(f"Unexpected Groq API response shape: {data}")
