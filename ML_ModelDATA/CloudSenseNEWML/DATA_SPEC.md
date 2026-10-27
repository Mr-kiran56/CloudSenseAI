# Input formats (match the model spec exactly)
Files in `data/` are a **synthetic benchmark** (one shared scenario; seeded generator in `scripts/`). Core columns are required; optional columns are used when present; labels live in separate evaluation-only files.

## Model A: `A_cost_daily.csv` (1,000 days; 4 billing-gap days are missing on purpose)
Core: `ds`, `y` (daily net unblended cost, USD). Optional regressors: `api_requests`, `active_users`, `workload_index`.
Other: `A_cost_by_service_daily.csv` (`ds, service, y`), `A_calendar_events.csv` (Prophet holidays format), `A_eval_only_diagnostics.csv` (`y_clean, anomaly_type, anomaly_id`: evaluation only, never a model input).

## Model B: `B_unit_economics_daily.csv` (8,032 rows = 1,004 days x 8 services)
Core: `date, service, cost_usd, active_users, api_requests, transactions, cpu_avg, network_bytes, instance_family, region, resource_tag, provisioning_frequency` (instances created per hour).
Optional: `instance_count_avg, instance_count_max, cpu_p95, mem_avg, ebs_provisioned_gb, is_promo, is_holiday`. `time_lagged_spend` is computed in code. `transactions` is non-zero only for cart_checkout and payments (zero denominators are excluded for the per-transaction target). ~0.4% of `cpu_avg` is NaN (collector gaps).

## Model C: `C_telemetry_5min.csv` (25,920 windows, 5-minute grid, 90 days)
Core: `window_start, cost_usd, request_count, instances_launched, cpu_utilization, network_in_bytes, network_out_bytes, storage_used_gb, invocation_count`.
Extended (optional): `unique_ips, top_ip_share, geo_entropy_bits, avg_function_duration_ms, lambda_concurrency_max, error_5xx_rate, p95_latency_ms, memory_utilization_pct, instance_count`. Calendar (optional): `cal_promo_intensity, cal_is_holiday, cal_scheduled_job`.
Evaluation-only: `C_labels_eval_only.csv` (`label, is_anomaly, is_dow, incident_id, attack_type, label_source, context`), `C_incident_ground_truth.csv` (24 incidents). `C_borg_real_reference_windows.csv` = 2,790 real Google Borg 5-minute windows (reference only).
Splits (computed in code): first 60% train, next 20% validation, last 20% test. Test anomaly share 8.3% (train 0.67%): always read AUPRC next to the prevalence.

## Provenance
Real inputs: the Borg trace (reference table) and the DoW bot trace (replayed as `dow_confirmed`). Everything else is synthetic with illustrative prices. See `../cloudsense_datasets/DATA_DICTIONARY.md` for the scenario, documented events and limitations.
