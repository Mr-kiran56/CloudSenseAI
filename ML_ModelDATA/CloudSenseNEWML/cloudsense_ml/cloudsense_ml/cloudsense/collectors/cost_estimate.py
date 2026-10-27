"""AWS billing is NOT available per 5 minutes. Estimate window cost from usage x price, then reconcile each day to the real Cost Explorer/CUR daily total."""
from __future__ import annotations
from dataclasses import dataclass
import numpy as np, pandas as pd

@dataclass
class PriceTable:
    """ALL values are inputs you must set from your own price list / AWS Pricing API. Defaults are illustrative placeholders."""
    ec2_hourly_per_instance: float = 0.10
    lambda_per_million_requests: float = 0.20
    lambda_gb_second: float = 0.0000166667
    lambda_memory_gb: float = 0.5
    data_transfer_out_per_gb: float = 0.09
    ebs_gb_month: float = 0.08
    other_per_request: float = 2.4e-6

def estimate_window_cost(df: pd.DataFrame, prices: PriceTable, instance_col: str = "instance_count") -> pd.Series:
    """Per-window USD estimate. Needs instance count (instance_col), invocation_count, avg_function_duration_ms (optional), network_out_bytes, storage_used_gb, request_count."""
    inst = df[instance_col].astype(float) if instance_col in df else pd.Series(0.0, index=df.index)
    dur = df["avg_function_duration_ms"] if "avg_function_duration_ms" in df else pd.Series(200.0, index=df.index)
    ec2 = inst * prices.ec2_hourly_per_instance / 12.0
    lam = df.invocation_count * (prices.lambda_per_million_requests / 1e6 + dur / 1000.0 * prices.lambda_memory_gb * prices.lambda_gb_second)
    net = df.network_out_bytes / 1e9 * prices.data_transfer_out_per_gb; ebs = df.storage_used_gb * prices.ebs_gb_month / 30.4 / 288.0
    return (ec2 + lam + net + ebs + df.request_count * prices.other_per_request).rename("cost_usd")

def reconcile_to_daily(window_cost: pd.Series, window_start: pd.Series, daily_actual: pd.DataFrame) -> pd.Series:
    """Scale each day's estimated windows so the day's total equals the real daily cost (keeps the intraday shape). daily_actual: columns ds, y. Days without actuals keep the raw estimate."""
    d = pd.DataFrame({"c": window_cost.values, "day": pd.to_datetime(window_start).dt.floor("D").values}); act = daily_actual.assign(ds=pd.to_datetime(daily_actual.ds)).set_index("ds").y
    est = d.groupby("day").c.sum(); k = (act.reindex(est.index) / est).replace([np.inf, -np.inf], np.nan).fillna(1.0)
    return pd.Series(d.c.values * d.day.map(k).values, name="cost_usd")
