"""Instance launches per 5-minute window (the N_create term of ProvisioningFrequency)."""
from __future__ import annotations
import json, time
import pandas as pd

def _bucket(times) -> pd.Series:
    t = pd.to_datetime(pd.Series(times)); t = t.dt.tz_convert("UTC").dt.tz_localize(None) if t.dt.tz is not None else t; return t.dt.floor("5min")

def launches_cloudtrail(ct, start, end, event_name: str = "RunInstances", throttle_s: float = 0.5) -> pd.Series:
    """Count instances started by RunInstances events (one event may start several instances). CloudTrail LookupEvents covers management events for the last 90 days and is rate-limited."""
    rows, token = [], None
    while True:
        kw = dict(LookupAttributes=[{"AttributeKey": "EventName", "AttributeValue": event_name}], StartTime=pd.Timestamp(start).to_pydatetime(), EndTime=pd.Timestamp(end).to_pydatetime(), MaxResults=50)
        if token: kw["NextToken"] = token
        r = ct.lookup_events(**kw)
        for e in r.get("Events", []):
            try: body = json.loads(e["CloudTrailEvent"])
            except (KeyError, ValueError): continue
            if body.get("errorCode"): continue                                     # failed launches do not create instances
            items = ((body.get("responseElements") or {}).get("instancesSet") or {}).get("items") or []; rows.append((e["EventTime"], max(1, len(items))))
        token = r.get("NextToken")
        if not token: break
        time.sleep(throttle_s)
    if not rows: return pd.Series(dtype="float64", name="instances_launched")
    d = pd.DataFrame(rows, columns=["t", "n"]); d["w"] = _bucket(d.t); return d.groupby("w").n.sum().rename("instances_launched")

def launches_asg(asg, group_names, start, end) -> pd.Series:
    """Successful 'Launching a new EC2 instance' scaling activities per window (alternative when CloudTrail is unavailable)."""
    rows = []
    for g in group_names:
        token = None
        while True:
            kw = dict(AutoScalingGroupName=g)
            if token: kw["NextToken"] = token
            r = asg.describe_scaling_activities(**kw)
            for a in r.get("Activities", []):
                if a.get("StatusCode") == "Successful" and str(a.get("Description", "")).startswith("Launching a new EC2 instance") and pd.Timestamp(start, tz="UTC") <= pd.Timestamp(a["StartTime"]) < pd.Timestamp(end, tz="UTC"): rows.append(a["StartTime"])
            token = r.get("NextToken")
            if not token: break
    if not rows: return pd.Series(dtype="float64", name="instances_launched")
    return _bucket(rows).value_counts().sort_index().rename("instances_launched")
