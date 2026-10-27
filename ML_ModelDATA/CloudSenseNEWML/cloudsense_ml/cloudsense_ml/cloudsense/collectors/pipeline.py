"""Pipelines that turn AWS (read-only) + your own KPI data into the EXACT input frames of Models A, B and C."""
from __future__ import annotations
import numpy as np, pandas as pd
from ..unit_economics import CORE_B
from ..anomaly import CORE_C
from .cost import fetch_daily_cost
from .cloudwatch import get_metric_data, ec2_asg_queries, alb_queries, asg_size_queries, collect_core_metrics
from .events import launches_cloudtrail, launches_asg
from .cost_estimate import PriceTable, estimate_window_cost, reconcile_to_daily

def build_model_a_frame(start: str, end: str, metric: str = "NetUnblendedCost", regressors: pd.DataFrame | None = None, drop_last_days: int = 2, session=None, ce=None) -> pd.DataFrame:
    """Model A input: ds, y (+ optional regressor columns joined on ds, e.g. api_requests, active_users, workload_index). Cost basis = `metric` (keep it constant!)."""
    d = fetch_daily_cost(session, start, end, metric=metric, drop_last_days=drop_last_days, ce=ce)[["ds", "y"]]
    if regressors is not None: d = d.merge(regressors.assign(ds=pd.to_datetime(regressors.ds)), on="ds", how="left")
    return d

def build_model_c_frame(cw, start, end, asg_names=(), load_balancers=(), functions=(), ct=None, asg=None, prices: PriceTable | None = None, daily_cost: pd.DataFrame | None = None,
                        storage_gb: float | pd.Series = 0.0, extra: pd.DataFrame | None = None, calendar: pd.DataFrame | None = None, group_metrics: bool = True) -> pd.DataFrame:
    """Model C telemetry on a 5-minute grid: CloudWatch metrics + launches + ESTIMATED cost (reconciled to real daily cost when given) + optional log-derived/calendar columns.
    storage_used_gb: pass real disk usage if you publish it (CloudWatch agent); a provisioned-size constant only works as a proxy (growth feature will be ~0)."""
    m = collect_core_metrics(cw, asg_names, load_balancers, functions, start, end, group_metrics=group_metrics)
    if ct is not None: l = launches_cloudtrail(ct, start, end)
    elif asg is not None: l = launches_asg(asg, asg_names, start, end)
    else: l = pd.Series(dtype="float64")
    m["instances_launched"] = m.window_start.map(l).fillna(0).astype(int) if len(l) else 0
    m["storage_used_gb"] = storage_gb if not isinstance(storage_gb, pd.Series) else m.window_start.map(storage_gb)
    if "instance_count" not in m: m["instance_count"] = np.nan
    est = estimate_window_cost(m.assign(instance_count=m.instance_count.fillna(0)), prices or PriceTable())
    m["cost_usd"] = reconcile_to_daily(est, m.window_start, daily_cost) if daily_cost is not None else est.values
    if extra is not None: m = m.merge(extra, on="window_start", how="left")
    if calendar is not None: m = m.merge(calendar, on="window_start", how="left")
    for c in CORE_C:
        if c not in m: raise ValueError(f"column {c} could not be built; check the collector inputs")
    return m

def build_model_b_frame(ce, cw, asg, services: list[dict], start: str, end: str, kpi: pd.DataFrame, cost_tag_key: str = "service", metric: str = "NetUnblendedCost", group_metrics: bool = False) -> pd.DataFrame:
    """Model B input: one row per (date, service) with the spec columns. services: [{name, asg_name, load_balancer, instance_family, region, resource_tag, cost_tag_value(optional)}].
    KPI frame (YOUR app): date, service, active_users, transactions. api_requests = ALB RequestCount."""
    cost = fetch_daily_cost(ce=ce, start=start, end=end, metric=metric, group_by=("TAG", cost_tag_key), drop_last_days=2); rows = []
    for s in services:
        q = ec2_asg_queries([s["asg_name"]]) + alb_queries([s["load_balancer"]]) + (asg_size_queries([s["asg_name"]]) if group_metrics else [])
        m = get_metric_data(cw, q, start, end, period=86400); m.index = m.index.normalize()
        g = cost[cost.group == s.get("cost_tag_value", s["name"])].set_index("ds").y; launches = launches_asg(asg, [s["asg_name"]], start, end)
        daily_launch = (launches.groupby(launches.index.normalize()).sum() if len(launches) else pd.Series(dtype="float64")).reindex(g.index).fillna(0) / 24.0
        d = pd.DataFrame({"date": g.index, "service": s["name"], "cost_usd": g.values, "api_requests": m["req_0"].reindex(g.index).fillna(0).values, "cpu_avg": m["cpu_0"].reindex(g.index).values,
                          "network_bytes": (m["netin_0"].reindex(g.index).fillna(0) + m["netout_0"].reindex(g.index).fillna(0)).values, "provisioning_frequency": daily_launch.values,
                          "instance_family": s["instance_family"], "region": s["region"], "resource_tag": s["resource_tag"]})
        if group_metrics and "inst_0" in m: d["instance_count_avg"] = m["inst_0"].reindex(g.index).values
        rows.append(d)
    out = pd.concat(rows, ignore_index=True).merge(kpi.assign(date=pd.to_datetime(kpi.date)), on=["date", "service"], how="left")
    miss = out[["active_users", "transactions"]].isna().sum().to_dict()
    if any(miss.values()): raise ValueError(f"KPI data missing for some (date, service) rows: {miss}. Provide active_users and transactions for every day.")
    return out[CORE_B + [c for c in out.columns if c not in CORE_B]]
