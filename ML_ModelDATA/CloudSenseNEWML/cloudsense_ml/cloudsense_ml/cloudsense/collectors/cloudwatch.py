"""CloudWatch GetMetricData collector (500 queries / 100,800 datapoints per call; 5-minute data is retained ~63 days, so store your own history)."""
from __future__ import annotations
import math, re
from dataclasses import dataclass, field
import numpy as np, pandas as pd

MAX_QUERIES, MAX_POINTS = 500, 100_800
_ID = re.compile(r"^[a-z][A-Za-z0-9_]*$")

@dataclass
class MetricQuery:
    id: str; namespace: str; metric: str; dimensions: dict = field(default_factory=dict); stat: str = "Average"
    def __post_init__(self):
        if not _ID.match(self.id): raise ValueError(f"query id {self.id!r} must start with a lowercase letter and contain only letters, digits, underscore")
    def to_api(self, period: int) -> dict:
        return {"Id": self.id, "MetricStat": {"Metric": {"Namespace": self.namespace, "MetricName": self.metric, "Dimensions": [{"Name": k, "Value": v} for k, v in self.dimensions.items()]},
                                              "Period": period, "Stat": self.stat}, "ReturnData": True}

def _utc(t): 
    t = pd.Timestamp(t); return t.tz_localize("UTC") if t.tzinfo is None else t.tz_convert("UTC")

def get_metric_data(cw, queries: list[MetricQuery], start, end, period: int = 300) -> pd.DataFrame:
    """Wide frame indexed by UTC timestamp (tz-naive), one column per query id. Batches queries (<=500) and splits long ranges so a call never exceeds 100,800 datapoints; follows NextToken."""
    start, end = _utc(start), _utc(end); total_pts = max(1, math.ceil((end - start).total_seconds() / period)); batch = max(1, min(MAX_QUERIES, MAX_POINTS // min(total_pts, MAX_POINTS)))
    span = pd.Timedelta(seconds=period * max(1, MAX_POINTS // min(batch, len(queries) or 1))); series: dict[str, list] = {q.id: [] for q in queries}; t0 = start
    while t0 < end:
        t1 = min(end, t0 + span)
        for i in range(0, len(queries), batch):
            chunk = queries[i:i + batch]; token = None
            while True:
                kw = dict(MetricDataQueries=[q.to_api(period) for q in chunk], StartTime=t0.to_pydatetime(), EndTime=t1.to_pydatetime(), ScanBy="TimestampAscending")
                if token: kw["NextToken"] = token
                r = cw.get_metric_data(**kw)
                for res in r.get("MetricDataResults", []):
                    series[res["Id"]].append(pd.Series(res.get("Values", []), index=pd.to_datetime(res.get("Timestamps", [])), dtype="float64"))
                token = r.get("NextToken")
                if not token: break
        t0 = t1
    cols = {k: (pd.concat(v) if v else pd.Series(dtype="float64")) for k, v in series.items()}
    df = pd.DataFrame(cols); df.index = pd.DatetimeIndex(df.index).tz_convert("UTC").tz_localize(None) if df.index.tz is not None else df.index
    return df[~df.index.duplicated()].sort_index()

# ---- query builders (one per data source)
def ec2_asg_queries(asg_names): 
    q = []
    for i, a in enumerate(asg_names):
        d = {"AutoScalingGroupName": a}
        q += [MetricQuery(f"cpu_{i}", "AWS/EC2", "CPUUtilization", d, "Average"), MetricQuery(f"netin_{i}", "AWS/EC2", "NetworkIn", d, "Sum"), MetricQuery(f"netout_{i}", "AWS/EC2", "NetworkOut", d, "Sum")]
    return q
def asg_size_queries(asg_names):   # needs Auto Scaling group metrics collection enabled
    return [MetricQuery(f"inst_{i}", "AWS/AutoScaling", "GroupInServiceInstances", {"AutoScalingGroupName": a}, "Average") for i, a in enumerate(asg_names)]
def alb_queries(load_balancers):
    q = []
    for i, lb in enumerate(load_balancers):
        d = {"LoadBalancer": lb}
        q += [MetricQuery(f"req_{i}", "AWS/ApplicationELB", "RequestCount", d, "Sum"), MetricQuery(f"e5xx_{i}", "AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", d, "Sum"), MetricQuery(f"lat_{i}", "AWS/ApplicationELB", "TargetResponseTime", d, "p95")]
    return q
def lambda_queries(functions):
    q = []
    for i, f in enumerate(functions):
        d = {"FunctionName": f}
        q += [MetricQuery(f"inv_{i}", "AWS/Lambda", "Invocations", d, "Sum"), MetricQuery(f"dur_{i}", "AWS/Lambda", "Duration", d, "Average"), MetricQuery(f"conc_{i}", "AWS/Lambda", "ConcurrentExecutions", d, "Maximum")]
    return q

def collect_core_metrics(cw, asg_names=(), load_balancers=(), functions=(), start=None, end=None, group_metrics=False) -> pd.DataFrame:
    """5-minute CloudWatch part of Model-C telemetry. Sum metrics: missing datapoint = 0. Gauges: forward-filled (max 3 windows)."""
    qs = ec2_asg_queries(asg_names) + alb_queries(load_balancers) + lambda_queries(functions) + (asg_size_queries(asg_names) if group_metrics else [])
    raw = get_metric_data(cw, qs, start, end, 300); idx = pd.date_range(_utc(start).tz_localize(None).floor("5min"), _utc(end).tz_localize(None).floor("5min"), freq="5min", inclusive="left"); raw = raw.reindex(idx)
    pick = lambda pre: [c for c in raw.columns if c.startswith(pre + "_")]; out = pd.DataFrame(index=idx)
    zero = lambda cols: raw[cols].fillna(0).sum(axis=1) if cols else pd.Series(0.0, index=idx)
    out["cpu_utilization"] = raw[pick("cpu")].mean(axis=1).ffill(limit=3) if pick("cpu") else np.nan
    out["network_in_bytes"] = zero(pick("netin")); out["network_out_bytes"] = zero(pick("netout")); out["request_count"] = zero(pick("req")); out["invocation_count"] = zero(pick("inv"))
    if load_balancers:
        req = out.request_count.clip(lower=1); out["error_5xx_rate"] = zero(pick("e5xx")) / req; out["p95_latency_ms"] = raw[pick("lat")].mean(axis=1).ffill(limit=3) * 1000
    if functions: out["avg_function_duration_ms"] = raw[pick("dur")].mean(axis=1).ffill(limit=3).fillna(0); out["lambda_concurrency_max"] = zero(pick("conc"))
    if group_metrics and pick("inst"): out["instance_count"] = raw[pick("inst")].sum(axis=1, min_count=1).ffill(limit=3)
    out.index.name = "window_start"; return out.reset_index()
