# Connecting CloudSense ML to your AWS account (read-only)

**Status:** the collectors in `cloudsense/collectors/` are unit-tested with botocore *stubs* and fake clients (see `tests/test_collectors.py`). They have **not** been run against a live AWS account. Run each one on a small date range first and compare with the console.

## 1. IAM: one read-only role/profile
```json
{ "Version": "2012-10-17", "Statement": [
  { "Effect": "Allow", "Action": ["ce:GetCostAndUsage"], "Resource": "*" },
  { "Effect": "Allow", "Action": ["cloudwatch:GetMetricData", "cloudwatch:ListMetrics"], "Resource": "*" },
  { "Effect": "Allow", "Action": ["cloudtrail:LookupEvents"], "Resource": "*" },
  { "Effect": "Allow", "Action": ["autoscaling:DescribeScalingActivities", "autoscaling:DescribeAutoScalingGroups", "ec2:DescribeInstances", "ec2:DescribeVolumes"], "Resource": "*" },
  { "Effect": "Allow", "Action": ["s3:ListBucket", "s3:GetObject"], "Resource": ["arn:aws:s3:::YOUR-ALB-LOG-BUCKET", "arn:aws:s3:::YOUR-ALB-LOG-BUCKET/*", "arn:aws:s3:::YOUR-CUR-BUCKET", "arn:aws:s3:::YOUR-CUR-BUCKET/*"] }
]}
```
Use a named profile or an assumed role (`get_session(profile=..., role_arn=...)`). Never put keys in code, notebooks or Git. No write permissions are needed for anything in this package.

## 2. What each model needs from AWS
| Model | Required input | AWS source | Notes |
|---|---|---|---|
| A | `ds`, `y` (daily cost) | Cost Explorer (`fetch_daily_cost`) or CUR 2.0 / Data Exports (`read_cur2`) | Keep ONE cost basis (e.g. NetUnblendedCost). The last ~2 days are dropped because they can still change. Cost Explorer API calls are billed (about $0.01 per request at the time of writing; check the pricing page). Default history is about 14 months; longer history needs an opt-in in Cost Explorer settings or CUR/Data Exports. |
| B | one row per (date, service): cost, users, requests, transactions, CPU, network bytes, instance family, region, tag, launches per hour | Cost Explorer grouped by a **cost-allocation tag** (activate the tag in Billing first; it takes time to appear), CloudWatch (ASG + ALB metrics), Auto Scaling activities. **`active_users` and `transactions` come from YOUR application** (`collectors/kpi.py`). | Build with `build_model_b_frame`. |
| C | 5-minute: cost, requests, launches, CPU, network in/out bytes, storage used GB, invocations | CloudWatch (`collect_core_metrics`), CloudTrail `RunInstances` (`launches_cloudtrail`) or ASG activities, **estimated** cost (`cost_estimate.py`) | See below. |

### Model C: things to know
- **Billing is not 5-minute data.** `cost_usd` per window is estimated from usage x price (`PriceTable`: the defaults are placeholders, set your own) and then reconciled so each day's windows sum to the real Cost Explorer/CUR daily total.
- **CloudWatch keeps 5-minute data for a limited time (about 63 days)**, so start storing your own history now. Model C needs at least ~14 days of mostly normal windows for its time-of-day statistics; 30-60 days is better.
- `storage_used_gb` should be real disk usage (CloudWatch agent metric). A provisioned-size constant makes the storage-growth feature flat.
- **Extended features** (`unique_ips`, `top_ip_share`, `geo_entropy_bits`, error rate, p95 latency) need ALB access logs (`logs.py`) and optionally a GeoIP lookup. In the benchmark, extended features lifted test AUPRC from 0.65 to 0.83: without them DoW is harder to separate from legitimate flash crowds.
- Real accounts have no labels: use the **unlabelled mode** (`train_anomaly(telemetry, labels=None)`), which sets the threshold from an alert budget. It cannot measure accuracy. Collect confirmed incidents over time and re-tune.

## 3. Run order
1. Run the three notebooks on the synthetic data to confirm your environment works.
2. Replace the data cell with the commented *REAL DATA* block (A first, then B, then C), on a short date range.
3. Retrain on your data. Do not reuse models trained on the synthetic benchmark.
4. For near-real-time scoring: `RealtimeRunner.backfill(history)` once, then call `step(now)` every 5 minutes. See `scripts/example_realtime_loop.py` (untested against live AWS).
