"""Savings estimation: a SEPARATE calculation from SHAP (spec: SHAP importance alone does not establish savings).
Every estimate returns baseline vs optimised monthly cost, a low/expected/high range, the assumptions and validation checks. Prices are INPUTS (use your own price list / AWS Pricing API)."""
from __future__ import annotations
import math
from dataclasses import dataclass, field, asdict
import numpy as np, pandas as pd

HOURS_PER_MONTH = 730.0

@dataclass
class SavingsEstimate:
    action: str
    baseline_monthly_usd: float
    optimized_monthly_usd: float
    savings_monthly_expected: float
    savings_monthly_low: float
    savings_monthly_high: float
    savings_annual_expected: float
    roi: float | None
    assumptions: list = field(default_factory=list)
    checks: list = field(default_factory=list)
    def to_dict(self): return asdict(self)

def _combine(rel_uncertainties) -> float:
    return float(math.sqrt(sum(u ** 2 for u in rel_uncertainties)))

def _finish(action, baseline, optimized, assumptions, rel_unc, checks, one_time_cost=0.0, observation_days=None, min_days=14):
    if observation_days is not None:
        checks.append(dict(check=f"observed >= {min_days} days of utilisation", passed=observation_days >= min_days, note=f"{observation_days} days"))
        if observation_days < min_days: rel_unc = rel_unc + 0.25      # widen the range when evidence is thin
    checks.append(dict(check="optimised cost <= baseline cost", passed=optimized <= baseline + 1e-9, note=""))
    exp = max(0.0, baseline - optimized); u = min(rel_unc, 0.95)
    roi = None if one_time_cost <= 0 else float((exp * 12 - one_time_cost) / one_time_cost)
    return SavingsEstimate(action, float(baseline), float(optimized), float(exp), float(exp * (1 - u)), float(exp * (1 + u)), float(exp * 12), roi, assumptions, checks)

def idle_instances(hourly_price: float, n_idle: float, discount: float = 0.0, price_unc: float = 0.05, idle_unc: float = 0.20, one_time_cost: float = 0.0, observation_days: int | None = None) -> SavingsEstimate:
    """Stop/terminate instances that stay idle. `discount` = Savings Plan/RI discount already applied to the price (0..1)."""
    checks = [dict(check="price > 0", passed=hourly_price > 0, note=""), dict(check="0 <= discount < 1", passed=0 <= discount < 1, note=""), dict(check="n_idle >= 0", passed=n_idle >= 0, note="")]
    if not all(c["passed"] for c in checks): raise ValueError(f"invalid inputs: {checks}")
    base = n_idle * hourly_price * (1 - discount) * HOURS_PER_MONTH
    return _finish("stop_or_terminate_idle_instances", base, 0.0, [f"{n_idle:g} instance(s) idle all month ({HOURS_PER_MONTH:g} h)", "price already net of discounts", "no replacement capacity needed"], _combine([price_unc, idle_unc]), checks, one_time_cost, observation_days)

def rightsizing(current_hourly: float, target_hourly: float, n_instances: float, discount: float = 0.0, price_unc: float = 0.05, perf_unc: float = 0.25, one_time_cost: float = 0.0, observation_days: int | None = None,
                observed_p95_cpu: float | None = None, max_safe_p95_cpu: float = 60.0) -> SavingsEstimate:
    """Move to a cheaper instance type. If observed p95 CPU is given, the check flags a downsize that could push p95 above `max_safe_p95_cpu` (assuming CPU scales with the capacity ratio)."""
    checks = [dict(check="current price > target price > 0", passed=current_hourly > target_hourly > 0, note="")]
    if not checks[0]["passed"]: raise ValueError("rightsizing needs current_hourly > target_hourly > 0")
    if observed_p95_cpu is not None:
        proj = observed_p95_cpu * current_hourly / target_hourly; checks.append(dict(check=f"projected p95 CPU <= {max_safe_p95_cpu}%", passed=proj <= max_safe_p95_cpu, note=f"projected {proj:.0f}% (assumes CPU scales with price ratio)"))
    base = n_instances * current_hourly * (1 - discount) * HOURS_PER_MONTH; opt = n_instances * target_hourly * (1 - discount) * HOURS_PER_MONTH
    return _finish("rightsize_instances", base, opt, [f"{n_instances:g} instances; price ratio used as a proxy for capacity", "same discount rate on the target type"], _combine([price_unc, perf_unc]), checks, one_time_cost, observation_days)

def scheduled_shutdown(hourly_price: float, n_instances: float, hours_off_per_week: float, discount: float = 0.0, one_time_cost: float = 0.0, observation_days: int | None = None) -> SavingsEstimate:
    checks = [dict(check="0 <= hours_off_per_week <= 168", passed=0 <= hours_off_per_week <= 168, note="")]
    if not checks[0]["passed"]: raise ValueError("hours_off_per_week must be within [0, 168]")
    base = n_instances * hourly_price * (1 - discount) * HOURS_PER_MONTH; opt = base * (1 - hours_off_per_week / 168.0)
    return _finish("scheduled_shutdown", base, opt, [f"{hours_off_per_week:g} h/week switched off for {n_instances:g} instances", "no on-demand charges while stopped (EBS storage still billed)"], 0.15, checks, one_time_cost, observation_days)

def unattached_ebs(gb: float, price_per_gb_month: float, snapshot_gb: float = 0.0, snapshot_price: float = 0.05) -> SavingsEstimate:
    base = gb * price_per_gb_month + snapshot_gb * snapshot_price; return _finish("delete_unattached_volumes_and_old_snapshots", base, 0.0, ["volumes confirmed unattached and backed up", "price per GB-month supplied by you"], 0.05,
        [dict(check="gb >= 0", passed=gb >= 0, note="")])

def detect_idle_capacity(df: pd.DataFrame, price_per_hour: dict, window: int = 14, cpu_factor: float = 0.85, excess_factor: float = 1.15) -> pd.DataFrame:
    """From Model-B style daily data (needs instance_count_avg, cpu_avg, instance_family): services whose fleet is persistently larger than their 28-day median while CPU is below normal."""
    need = {"date", "service", "instance_count_avg", "cpu_avg", "instance_family"}
    if not need <= set(df.columns): raise ValueError(f"needs columns {sorted(need)}")
    d = df.sort_values(["service", "date"]).copy(); rows = []
    for svc, g in d.groupby("service"):
        g = g.copy(); g["inst_med"] = g.instance_count_avg.rolling(28, min_periods=14).median(); g["cpu_med"] = g.cpu_avg.rolling(28, min_periods=14).median(); last = g.tail(window)
        flag = (last.instance_count_avg > last.inst_med * excess_factor) & (last.cpu_avg < last.cpu_med * cpu_factor)
        if flag.mean() >= 0.6:
            excess = float((last.instance_count_avg - last.inst_med).clip(lower=0).mean()); fam = last.instance_family.iloc[-1]; price = price_per_hour.get(fam)
            if price is None: continue
            est = idle_instances(price, excess, observation_days=len(last)); rows.append(dict(service=svc, instance_family=fam, excess_instances=round(excess, 2), flagged_days=int(flag.sum()), **{k: v for k, v in est.to_dict().items() if k.startswith("savings") or k.endswith("monthly_usd")}))
    return pd.DataFrame(rows)
