"""Optional DoW features from ALB access logs: unique_ips, top_ip_share, geo_entropy_bits, error rate, p95 latency per 5-minute window."""
from __future__ import annotations
import gzip, io, shlex
import numpy as np, pandas as pd

def parse_alb_line(line: str):
    """Return dict(time, client_ip, status, target_time) or None. Uses the documented ALB field order (type, time, elb, client:port, target:port, 3 processing times, elb_status, ...)."""
    try: f = shlex.split(line)
    except ValueError: return None
    if len(f) < 9: return None
    try: tt = float(f[6])
    except ValueError: tt = -1.0
    return dict(time=pd.Timestamp(f[1]).tz_convert("UTC").tz_localize(None), client_ip=f[3].rsplit(":", 1)[0], status=int(f[8]) if f[8].isdigit() else 0, target_time=tt)

def alb_window_stats(lines, geo_lookup=None) -> pd.DataFrame:
    """Aggregate ALB log lines into 5-minute windows. geo_lookup(ip)->country code is optional (e.g. a local GeoIP database); without it geo_entropy_bits is omitted."""
    rows = [r for r in (parse_alb_line(l) for l in lines) if r]
    if not rows: return pd.DataFrame(columns=["window_start", "request_count", "unique_ips", "top_ip_share", "error_5xx_rate", "p95_latency_ms"])
    d = pd.DataFrame(rows); d["window_start"] = d.time.dt.floor("5min"); out = []
    for w, g in d.groupby("window_start"):
        vc = g.client_ip.value_counts(); rec = dict(window_start=w, request_count=len(g), unique_ips=int(vc.size), top_ip_share=float(vc.iloc[0] / len(g)), error_5xx_rate=float((g.status >= 500).mean()),
                                                     p95_latency_ms=float(np.percentile(g.target_time[g.target_time >= 0], 95) * 1000) if (g.target_time >= 0).any() else np.nan)
        if geo_lookup:
            c = g.client_ip.map(geo_lookup).value_counts(normalize=True); rec["geo_entropy_bits"] = float(-(c * np.log2(c)).sum())
        out.append(rec)
    return pd.DataFrame(out)

def read_alb_logs_s3(s3, bucket: str, prefix: str, max_keys: int = 1000):
    """Yield log lines from gzip'ed ALB log objects under a prefix (read-only)."""
    token, n = None, 0
    while True:
        kw = dict(Bucket=bucket, Prefix=prefix)
        if token: kw["ContinuationToken"] = token
        r = s3.list_objects_v2(**kw)
        for o in r.get("Contents", []):
            body = s3.get_object(Bucket=bucket, Key=o["Key"])["Body"].read()
            for line in io.TextIOWrapper(gzip.GzipFile(fileobj=io.BytesIO(body)), encoding="utf-8"): yield line
            n += 1
            if n >= max_keys: return
        token = r.get("NextContinuationToken")
        if not token: return
