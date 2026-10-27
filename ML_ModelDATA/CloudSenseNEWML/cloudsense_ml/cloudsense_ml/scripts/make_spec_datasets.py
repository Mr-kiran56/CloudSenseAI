"""Convert the generator output into the EXACT input formats of the model spec.
Core columns = what the spec lists (required). Optional columns = used when present. Evaluation-only labels live in SEPARATE files."""
import pandas as pd, numpy as np, shutil, sys
from pathlib import Path
SRC = Path(sys.argv[1]); DST = Path(sys.argv[2]); DST.mkdir(parents=True, exist_ok=True)
# ---------------- A ----------------
a = pd.read_csv(SRC / "A_prophet_cost_daily.csv", parse_dates=["ds"])
a_out = a.rename(columns={"dau": "active_users", "promo_intensity": "workload_index"})[["ds", "y", "api_requests", "active_users", "workload_index"]]
a_out.to_csv(DST / "A_cost_daily.csv", index=False)
a[["ds", "y_clean", "anomaly_type", "anomaly_id"]].to_csv(DST / "A_eval_only_diagnostics.csv", index=False)
s = pd.read_csv(SRC / "A_cost_by_service_daily.csv", parse_dates=["line_item_usage_start_date"])
s.rename(columns={"line_item_usage_start_date": "ds", "line_item_product_code": "service", "line_item_net_unblended_cost": "y"})[["ds", "service", "y"]].to_csv(DST / "A_cost_by_service_daily.csv", index=False)
shutil.copy(SRC / "A_holidays_events.csv", DST / "A_calendar_events.csv")
# ---------------- B ----------------
b = pd.read_csv(SRC / "B_xgboost_unit_economics.csv", parse_dates=["date"])
b_out = pd.DataFrame({"date": b.date, "service": b.microservice, "cost_usd": b.cost_usd, "active_users": b.active_users, "api_requests": b.api_requests, "transactions": b.transactions,
    "cpu_avg": b.cpu_avg_pct, "network_bytes": (b.network_gb * 1e9).round().astype("int64"), "instance_family": b.instance_family, "region": b.region, "resource_tag": b.team_tag,
    "provisioning_frequency": (b.instances_launched / 24.0).round(4),     # instances created per hour (daily mean)
    "instance_count_avg": b.instance_count_avg, "instance_count_max": b.instance_count_max, "cpu_p95": b.cpu_p95_pct, "mem_avg": b.mem_avg_pct, "ebs_provisioned_gb": b.ebs_provisioned_gb,
    "is_promo": b.is_promo, "is_holiday": b.is_holiday})
b_out.to_csv(DST / "B_unit_economics_daily.csv", index=False)
# ---------------- C ----------------
c = pd.read_csv(SRC / "C_isoforest_telemetry_5min.csv", parse_dates=["window_start"])
c_out = pd.DataFrame({"window_start": c.window_start, "cost_usd": c.cost_usd, "request_count": c.request_count, "instances_launched": c.instances_launched, "cpu_utilization": c.cpu_utilization_pct,
    "network_in_bytes": (c.network_in_mb * 1e6).round().astype("int64"), "network_out_bytes": (c.network_out_mb * 1e6).round().astype("int64"), "storage_used_gb": c.ebs_used_gb, "invocation_count": c.invocation_count,
    # optional / extended
    "unique_ips": c.unique_ips, "top_ip_share": c.top_ip_share, "geo_entropy_bits": c.geo_entropy_bits, "avg_function_duration_ms": c.avg_function_duration_ms, "lambda_concurrency_max": c.lambda_concurrency_max,
    "error_5xx_rate": c.error_5xx_rate, "p95_latency_ms": c.p95_latency_ms, "memory_utilization_pct": c.memory_utilization_pct, "instance_count": c.instance_count,
    "cal_promo_intensity": c.cal_promo_intensity, "cal_is_holiday": c.cal_is_holiday, "cal_scheduled_job": c.cal_scheduled_job})
c_out.to_csv(DST / "C_telemetry_5min.csv", index=False)
c[["window_start", "label", "is_anomaly", "is_dow", "incident_id", "attack_type", "label_source", "context"]].to_csv(DST / "C_labels_eval_only.csv", index=False)
shutil.copy(SRC / "C_incident_ground_truth.csv", DST / "C_incident_ground_truth.csv"); shutil.copy(SRC / "C_borg_real_reference_windows.csv", DST / "C_borg_real_reference_windows.csv")
for f in sorted(DST.glob("*.csv")): print(f.name, pd.read_csv(f, nrows=3).shape[1], "cols")
