"""Daily cost for Model A/B: Cost Explorer API or CUR 2.0 / Data Exports files."""
from __future__ import annotations
import logging
from pathlib import Path
import numpy as np, pandas as pd
log = logging.getLogger("cloudsense.collect.cost")
METRICS = ("UnblendedCost", "NetUnblendedCost", "AmortizedCost", "NetAmortizedCost", "BlendedCost")
CE_REQUEST_USD = 0.01          # Cost Explorer API price per request (verify on the AWS pricing page)

def fetch_daily_cost(session=None, start: str = None, end: str = None, metric: str = "NetUnblendedCost", group_by: str | tuple | None = None, drop_last_days: int = 2, ce=None) -> pd.DataFrame:
    """Daily cost via Cost Explorer get_cost_and_usage. Returns ds, y [, group]. `end` is exclusive (AWS convention).
    group_by: None | 'SERVICE' (dimension) | ('TAG','service') (cost-allocation tag, must be activated in Billing). Last `drop_last_days` days are dropped because they can still change/be incomplete.
    Each paginated request is billed by AWS (~$0.01), so keep ranges small and cache the results."""
    if metric not in METRICS: raise ValueError(f"metric must be one of {METRICS}")
    ce = ce or session.client("ce", region_name="us-east-1"); kw = dict(TimePeriod=dict(Start=start, End=end), Granularity="DAILY", Metrics=[metric])
    if group_by: kw["GroupBy"] = [dict(Type="DIMENSION", Key=group_by)] if isinstance(group_by, str) else [dict(Type=group_by[0], Key=group_by[1])]
    rows, n_req, token = [], 0, None
    while True:
        if token: kw["NextPageToken"] = token
        r = ce.get_cost_and_usage(**kw); n_req += 1
        for t in r["ResultsByTime"]:
            ds = t["TimePeriod"]["Start"]
            if group_by:
                for g in t["Groups"]: rows.append(dict(ds=ds, group=g["Keys"][0].split("$", 1)[-1] if g["Keys"] else "", y=float(g["Metrics"][metric]["Amount"]), estimated=t.get("Estimated", False)))
            else: rows.append(dict(ds=ds, y=float(t["Total"][metric]["Amount"]), estimated=t.get("Estimated", False)))
        token = r.get("NextPageToken")
        if not token: break
    log.info("Cost Explorer: %d request(s), approx. API charge $%.2f", n_req, n_req * CE_REQUEST_USD)
    d = pd.DataFrame(rows); d["ds"] = pd.to_datetime(d["ds"])
    if drop_last_days and len(d): d = d[d.ds <= d.ds.max() - pd.Timedelta(days=drop_last_days)]
    return d.reset_index(drop=True)

def _pick(df, cands):
    for c in cands:
        if c in df.columns: return c
    raise KeyError(f"none of {cands} in columns {list(df.columns)[:20]}...")

def read_cur2(path, basis: str = "unblended", by_service: bool = False, exclude_types=("Tax",)) -> pd.DataFrame:
    """Aggregate CUR 2.0 / Data Exports parquet or csv (file or folder) to daily cost: ds, y [, service]. basis: unblended | net_unblended."""
    p = Path(path); files = sorted(p.rglob("*.parquet")) + sorted(p.rglob("*.csv*")) if p.is_dir() else [p]
    if not files: raise FileNotFoundError(f"no parquet/csv files under {p}")
    frames = [pd.read_parquet(f) if f.suffix == ".parquet" else pd.read_csv(f) for f in files]; d = pd.concat(frames, ignore_index=True)
    ts = _pick(d, ["line_item_usage_start_date", "lineItem/UsageStartDate"]); prod = _pick(d, ["line_item_product_code", "lineItem/ProductCode"])
    cost = _pick(d, ["line_item_net_unblended_cost", "lineItem/NetUnblendedCost"] if basis == "net_unblended" else ["line_item_unblended_cost", "lineItem/UnblendedCost"])
    typ = next((c for c in ["line_item_line_item_type", "lineItem/LineItemType"] if c in d.columns), None)
    if typ and exclude_types: d = d[~d[typ].isin(exclude_types)]
    d = d.assign(ds=pd.to_datetime(d[ts]).dt.tz_localize(None).dt.floor("D")); keys = ["ds"] + ([prod] if by_service else [])
    out = d.groupby(keys)[cost].sum().reset_index().rename(columns={cost: "y", prod: "service"}); return out
