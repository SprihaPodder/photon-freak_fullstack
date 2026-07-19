from typing import Optional, List
from pydantic import BaseModel, Field


class TrendCrossing(BaseModel):
    already_crossed: bool
    cycles_remaining: float
    projected_cycle: float


class PredictionResponse(BaseModel):
    battery_id: Optional[str] = None
    n_cycles_received: int
    latest_cycle: int

    # Primary, absolute, trustworthy output
    soh_percent: float = Field(..., description="MC-Dropout mean SOH estimate, 0-100%")
    soh_std: float = Field(..., description="Epistemic uncertainty (std dev) from MC-Dropout")
    soh_ci_95: List[float] = Field(..., description="[low, high] 95% confidence interval, %")
    health_class: str = Field(..., description="Healthy (>=90%) / Degraded (70-90%) / Critical (<70%)")

    # Relative outputs (see README — cannot be denormalized to exact cycles/Wh
    # for a battery unseen during training; shown as % of the model's learned
    # relative-remaining-life / relative-remaining-energy scale)
    rul_relative_pct: float = Field(..., description="Relative remaining-life score, 0-100%")
    rue_relative_pct: float = Field(..., description="Relative remaining-energy score, 0-100%")
    rul_reference_range_cycles: List[float] = Field(
        ..., description="Min/max RUL (cycles) observed across the 4 NASA training batteries, for context only"
    )

    # Physically-grounded trend extrapolation from the uploaded data itself
    eol_70_estimate: Optional[TrendCrossing] = Field(
        None, description="Extrapolated cycles until SOH crosses 70% (end-of-life), from recent degradation trend"
    )
    early_warning_80: Optional[TrendCrossing] = Field(
        None, description="Extrapolated cycles until SOH crosses 80% (second-life / maintenance trigger)"
    )

    mc_samples: int
    warnings: List[str] = []
