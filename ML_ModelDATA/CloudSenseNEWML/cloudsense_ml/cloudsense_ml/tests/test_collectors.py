import json, gzip, datetime as dt
import numpy as np, pandas as pd, pytest, boto3
from botocore.stub import Stubber
from cloudsense.collectors.cost import fetch_daily_cost, read_cur2
from cloudsense.collectors.cloudwatch import MetricQuery, get_metric_data, collect_core_metrics
from cloudsense.collectors.events import launches_cloudtrail, launches_asg
from cloudsense.collectors.logs import parse_alb_line, alb_window_stats
from cloudsense.collectors.cost_estimate import PriceTable, estimate_window_cost, reconcile_to_daily
from cloudsense.collectors import pipeline
from cloudsense.anomaly import CORE_C

K = dict(aws_access_key_id="x", aws_secret_access_key="x")
UTC = dt.timezone.utc

def test_cost_explorer_pagination_and_drop_last():
    ce = boto3.client("ce", region_name="us-east-1", **K)
    def page(days, token):
        r = {"ResultsByTime": [{"TimePeriod": {"Start": d, "End": d}, "Total": {"NetUnblendedCost": {"Amount": str(10 + i), "Unit": "USD"}}, "Groups": [], "Estimated": False} for i, d in enumerate(days)]}
        if token: r["NextPageToken"] = token
        return r
    with Stubber(ce) as st:
        st.add_response("get_cost_and_usage", page(["2026-01-01", "2026-01-02", "2026-01-03"], "t1")); st.add_response("get_cost_and_usage", page(["2026-01-04", "2026-01-05"], None))
        d = fetch_daily_cost(ce=ce, start="2026-01-01", end="2026-01-06", drop_last_days=2)
    assert list(d.columns) == ["ds", "y", "estimated"] and len(d) == 3 and d.y.tolist() == [10.0, 11.0, 12.0]

def test_cost_explorer_group_by_tag():
    ce = boto3.client("ce", region_name="us-east-1", **K)
    r = {"ResultsByTime": [{"TimePeriod": {"Start": "2026-01-01", "End": "2026-01-02"}, "Total": {}, "Groups": [{"Keys": ["service$checkout"], "Metrics": {"NetUnblendedCost": {"Amount": "5.5", "Unit": "USD"}}}], "Estimated": False}]}
    with Stubber(ce) as st:
        st.add_response("get_cost_and_usage", r); d = fetch_daily_cost(ce=ce, start="2026-01-01", end="2026-01-02", group_by=("TAG", "service"), drop_last_days=0)
    assert d.group.iloc[0] == "checkout" and d.y.iloc[0] == 5.5
    with pytest.raises(ValueError): fetch_daily_cost(ce=ce, start="a", end="b", metric="Nope")

def test_cur2_reader(tmp_path):
    df = pd.DataFrame({"line_item_usage_start_date": pd.to_datetime(["2026-01-01 00:00", "2026-01-01 01:00", "2026-01-02 00:00"]), "line_item_product_code": ["AmazonEC2", "AmazonEC2", "AmazonS3"],
                       "line_item_unblended_cost": [1.0, 2.0, 5.0], "line_item_line_item_type": ["Usage", "Usage", "Tax"]})
    df.to_parquet(tmp_path / "a.parquet"); d = read_cur2(tmp_path)
    assert d.y.tolist() == [3.0] and str(d.ds.iloc[0].date()) == "2026-01-01"           # Tax excluded
    assert read_cur2(tmp_path, by_service=True).service.tolist() == ["AmazonEC2"]

class FakeCW:
    """Returns deterministic datapoints for every requested query (honours Period/StartTime/EndTime, paginates once)."""
    def __init__(self): self.calls = 0
    def get_metric_data(self, MetricDataQueries, StartTime, EndTime, ScanBy=None, NextToken=None):
        self.calls += 1; assert len(MetricDataQueries) <= 500
        per = MetricDataQueries[0]["MetricStat"]["Period"]; ts = pd.date_range(pd.Timestamp(StartTime).floor(f"{per}s"), pd.Timestamp(EndTime), freq=f"{per}s", inclusive="left")
        res = []
        for q in MetricDataQueries:
            i = q["Id"]; base = 50.0 if i.startswith("cpu") else (1e6 if i.startswith(("netin", "netout")) else (1000.0 if i.startswith(("req", "inv")) else 5.0))
            res.append({"Id": i, "Label": i, "Timestamps": [t.to_pydatetime() for t in ts], "Values": [base * (1 + 0.1 * np.sin(k / 10)) for k in range(len(ts))], "StatusCode": "Complete"})
        return {"MetricDataResults": res}

def test_get_metric_data_batches_and_shape():
    cw = FakeCW(); qs = [MetricQuery(f"m{i}", "AWS/EC2", "CPUUtilization", {"AutoScalingGroupName": "a"}) for i in range(1200)]
    d = get_metric_data(cw, qs, "2026-01-01", "2026-01-01T01:00:00", 300)
    assert d.shape == (12, 1200) and cw.calls >= 3
    with pytest.raises(ValueError): MetricQuery("1bad", "n", "m")

def test_get_metric_data_cloudwatch_stub_nexttoken():
    cw = boto3.client("cloudwatch", region_name="us-east-1", **K); t = [dt.datetime(2026, 1, 1, 0, 0, tzinfo=UTC), dt.datetime(2026, 1, 1, 0, 5, tzinfo=UTC)]
    with Stubber(cw) as st:
        st.add_response("get_metric_data", {"MetricDataResults": [{"Id": "a", "Label": "a", "Timestamps": t[:1], "Values": [1.0], "StatusCode": "PartialData"}], "NextToken": "n"})
        st.add_response("get_metric_data", {"MetricDataResults": [{"Id": "a", "Label": "a", "Timestamps": t[1:], "Values": [2.0], "StatusCode": "Complete"}]})
        d = get_metric_data(cw, [MetricQuery("a", "AWS/EC2", "CPUUtilization", {"AutoScalingGroupName": "g"})], "2026-01-01", "2026-01-01T00:10:00", 300)
    assert d.a.tolist() == [1.0, 2.0]

def test_collect_core_metrics_columns_and_zero_fill():
    d = collect_core_metrics(FakeCW(), ["asg1"], ["app/lb/1"], ["fn1"], "2026-01-01", "2026-01-01T01:00:00", group_metrics=True)
    for c in ["window_start", "cpu_utilization", "network_in_bytes", "network_out_bytes", "request_count", "invocation_count", "error_5xx_rate", "p95_latency_ms", "avg_function_duration_ms", "lambda_concurrency_max", "instance_count"]: assert c in d.columns
    assert len(d) == 12 and d.request_count.min() > 0

def test_cloudtrail_launches_counts_instances_and_skips_errors():
    ct = boto3.client("cloudtrail", region_name="us-east-1", **K); ev = lambda t, body: {"EventId": "1", "EventName": "RunInstances", "EventTime": t, "CloudTrailEvent": json.dumps(body)}
    t0 = dt.datetime(2026, 1, 1, 0, 2, tzinfo=UTC)
    with Stubber(ct) as st:
        st.add_response("lookup_events", {"Events": [ev(t0, {"responseElements": {"instancesSet": {"items": [{}, {}, {}]}}}), ev(t0, {"errorCode": "Unauthorized"}), ev(t0 + dt.timedelta(minutes=7), {"responseElements": {"instancesSet": {"items": [{}]}}})]})
        s = launches_cloudtrail(ct, "2026-01-01", "2026-01-02", throttle_s=0)
    assert s.tolist() == [3, 1] and s.index[0] == pd.Timestamp("2026-01-01 00:00") and s.index[1] == pd.Timestamp("2026-01-01 00:05")

def test_asg_launch_activities():
    asg = boto3.client("autoscaling", region_name="us-east-1", **K); t = dt.datetime(2026, 1, 1, 0, 3, tzinfo=UTC)
    act = lambda d, s: {"ActivityId": "a", "AutoScalingGroupName": "g", "Cause": "c", "StartTime": t, "StatusCode": s, "Description": d}
    with Stubber(asg) as st:
        st.add_response("describe_scaling_activities", {"Activities": [act("Launching a new EC2 instance: i-1", "Successful"), act("Terminating EC2 instance: i-2", "Successful"), act("Launching a new EC2 instance: i-3", "Failed")]})
        s = launches_asg(asg, ["g"], "2026-01-01", "2026-01-02")
    assert s.tolist() == [1]

def test_alb_log_parsing_and_window_stats():
    line = lambda ts, ip, st, tt: f'https {ts} app/lb/1 {ip}:5000 10.0.0.1:80 0.001 {tt} 0.000 {st} {st} 100 200 "GET https://x:443/ HTTP/1.1" "curl/8" ECDHE TLSv1.2 arn:tg "Root=1" "-" "-" 0 {ts} "forward" "-" "-"'
    lines = [line("2026-01-01T00:01:00.000000Z", "1.1.1.1", 200, 0.1)] * 5 + [line("2026-01-01T00:02:00.000000Z", "2.2.2.2", 502, 0.3)]
    p = parse_alb_line(lines[0]); assert p["client_ip"] == "1.1.1.1" and p["status"] == 200
    w = alb_window_stats(lines, geo_lookup=lambda ip: "IN" if ip.startswith("1") else "US"); r = w.iloc[0]
    assert r.request_count == 6 and r.unique_ips == 2 and abs(r.top_ip_share - 5 / 6) < 1e-9 and abs(r.error_5xx_rate - 1 / 6) < 1e-9 and r.geo_entropy_bits > 0
    assert parse_alb_line("garbage") is None

def test_cost_estimate_reconciles_to_real_daily_total():
    idx = pd.date_range("2026-01-01", periods=576, freq="5min"); df = pd.DataFrame({"window_start": idx, "instance_count": 10, "invocation_count": 100, "network_out_bytes": 1e9, "storage_used_gb": 100, "request_count": 1000})
    est = estimate_window_cost(df, PriceTable()); assert (est > 0).all()
    rec = reconcile_to_daily(est, df.window_start, pd.DataFrame({"ds": ["2026-01-01", "2026-01-02"], "y": [100.0, 200.0]}))
    assert abs(rec[:288].sum() - 100) < 1e-6 and abs(rec[288:].sum() - 200) < 1e-6

def test_build_model_c_frame_has_all_core_columns():
    d = pipeline.build_model_c_frame(FakeCW(), "2026-01-01", "2026-01-02", asg_names=["a"], load_balancers=["lb"], functions=["f"], storage_gb=500.0, daily_cost=pd.DataFrame({"ds": ["2026-01-01"], "y": 300.0}))
    assert set(CORE_C) <= set(d.columns) and len(d) == 288 and abs(d.cost_usd.sum() - 300.0) < 1e-6

def test_build_model_b_frame_needs_kpis():
    ce = boto3.client("ce", region_name="us-east-1", **K); days = [f"2026-01-{i:02d}" for i in range(1, 6)]
    r = {"ResultsByTime": [{"TimePeriod": {"Start": d, "End": d}, "Total": {}, "Groups": [{"Keys": ["service$web"], "Metrics": {"NetUnblendedCost": {"Amount": "20", "Unit": "USD"}}}], "Estimated": False} for d in days]}
    class FakeASG:
        def describe_scaling_activities(self, **kw): return {"Activities": []}
    svc = [dict(name="web", asg_name="asg", load_balancer="app/lb/1", instance_family="m5.large", region="ap-south-1", resource_tag="platform")]
    kpi = pd.DataFrame({"date": pd.to_datetime(days), "service": "web", "active_users": 100, "transactions": 5})
    with Stubber(ce) as st:
        st.add_response("get_cost_and_usage", r); b = pipeline.build_model_b_frame(ce, FakeCW(), FakeASG(), svc, "2026-01-01", "2026-01-08", kpi)
    from cloudsense.unit_economics import CORE_B
    assert list(b.columns[:len(CORE_B)]) == CORE_B and len(b) == 3 and b.cost_usd.iloc[0] == 20.0
