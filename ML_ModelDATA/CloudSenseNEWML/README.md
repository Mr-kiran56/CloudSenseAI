# CloudSense ML: Models A, B, C + collectors (ML training and prediction only)

```
cloudsense/            importable package
  forecasting.py       Model A  Prophet cost forecasting, CV, budget-overrun date, CostForecaster
  unit_economics.py    Model B  XGBoost unit economics, SHAP explanation + risk level + next investigation, UnitEconomicsPredictor
  anomaly.py           Model C  Isolation Forest anomaly/DoW, triage, StreamScorer (real time)
  savings.py           separate savings estimator (idle, right-size, schedule, EBS) with ranges and checks
  collectors/          read-only AWS collectors -> the exact model input frames (+ RealtimeRunner)
notebooks/             3 executed training notebooks (clean -> features -> EDA -> train -> evaluate -> save -> download)
trained_artifacts/     model zips produced by those runs (trained on the SYNTHETIC benchmark)
data/                  spec-format datasets   |  DATA_SPEC.md  columns  |  docs/AWS_SETUP.md  IAM + AWS wiring
tests/                 27 pytest tests (all pass)  |  scripts/  dataset generator, example realtime loop
```

## Quick start
- **Colab:** upload `cloudsense_ml.zip`, unzip, open a notebook from `notebooks/`, run all cells (about 3-5 minutes each). The last cell downloads the model zip.
- **Local:** `pip install -r requirements.txt`, then `jupyter notebook`, or `python -m pytest tests -q`.
- **Use a trained model:** `CostForecaster.load(dir).forecast(30)`, `UnitEconomicsPredictor.load(dir).predict(history, next_day_calendar)` / `.explain(...)`, `StreamScorer.load(dir).update(window_dict)`.

## Spec checklist
| Spec item | Status |
|---|---|
| A: `ds`,`y` + optional regressors; linear growth, no daily seasonality, weekly when supported, yearly `auto`, 80% interval, horizons 7/30/90, train on earlier dates, rolling-origin CV, MAPE/RMSE/MAE, budget-overrun date | done (a `ds`+`y`-only run is tested) |
| B: spec columns (`cpu_avg`, `network_bytes`, `resource_tag`, `provisioning_frequency`, `time_lagged_spend` computed), spec XGBoost parameters, time split + early stopping, Linear Regression / Random Forest / LightGBM baselines, next-day cost per API request, MAE/RMSE/R2, zero denominators handled | done |
| C: the 9 spec features, CostVelocity and ProvisioningFrequency with explicit units/windows, spec Isolation Forest parameters, 5-minute buckets, threshold tuned on labelled windows, alerts grouped into incidents, precision/recall/F1/AUPRC + false positives + delay + alert volume, score is not a probability | done |
| D: SHAP TreeExplainer; explanation with **risk level and recommended next investigation** (Model B); **savings from a separate calculation** | done (Isolation Forest uses TreeExplainer on a sample, not Kernel SHAP) |

## Measured results (synthetic benchmark; your real data will differ)
- **A, Prophet.** Selected `P3_tuned`. Rolling-origin CV MAPE (4 folds): 8.7% at 30 days, 7.8% at 90 days, versus 11-17% for the baselines. On the single final 90-day hold-out: 2.6% / 4.8% / 9.5% at 7/30/90 days. **Treat CV as the expected accuracy: the <5% target is not reliably met.** The nominal 80% intervals covered only 71% / 63% / 46% on the hold-out, so they are too narrow.
- **B, XGBoost.** The spec parameters won on validation (Optuna did not beat them). Test MAE 0.00095 (per 1,000 requests), R2 0.994, MAPE 4.6%, better than every baseline with a positive 95% interval; Linear Regression is far worse (MAPE 7.4%). Per-service models were worse than one global model.
- **C, Isolation Forest.** Test any-anomaly AUPRC (prevalence 0.083): spec features raw 0.27, de-seasonalised spec features 0.40, core features 0.44, **extended feature-group ensemble 0.69**, robust z-score rule 0.82, hybrid (forest + rule) 0.83. **The simple rule beats the plain forest here, and the hybrid is effectively the rule plus the forest.** With only CloudWatch (core) data the best detector reaches 0.65. Calendar features did not reduce flash-crowd false positives. The real-time runner raised alerts on a replayed API-hammering incident.

## Not done / limits
- Collectors are tested with stubs and fakes only, never on a live AWS account. Prices are placeholders. `cost_usd` per 5 minutes is an estimate. `active_users`/`transactions` must come from your app.
- Models in `trained_artifacts/` are trained on synthetic data: use them to test your integration, **not** for decisions.
- Prediction classes load a saved bundle; backend/API, MCP remediation and notifications are not included (you said later).
