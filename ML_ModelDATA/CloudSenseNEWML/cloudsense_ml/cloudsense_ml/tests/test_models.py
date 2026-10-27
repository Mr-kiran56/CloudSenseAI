import numpy as np, pandas as pd, pytest, pathlib
from cloudsense.common import SchemaError
from cloudsense import forecasting as fa, unit_economics as ue, anomaly as an, savings as sv
D = pathlib.Path(__file__).resolve().parents[1] / "data"

# ---------------- Model A
def test_budget_overrun_dates_and_month_end_rollover():
    h = pd.Series(100.0, index=pd.date_range("2026-01-01", "2026-01-10")); f = pd.DataFrame({"ds": pd.date_range("2026-01-11", "2026-01-31"), "yhat": 100.0, "yhat_lower": 90.0, "yhat_upper": 110.0})
    r = fa.budget_overrun(h, f, 2500.0, "2026-01-10"); assert r["expected_overrun_date"] == "2026-01-26" and r["earliest_overrun_date"] <= r["expected_overrun_date"] <= r["latest_overrun_date"]
    assert fa.budget_overrun(h, f, 1e9, "2026-01-10")["expected_overrun_date"] is None
    f2 = pd.DataFrame({"ds": pd.date_range("2026-02-01", "2026-02-28"), "yhat": 10.0, "yhat_lower": 9.0, "yhat_upper": 11.0}); r2 = fa.budget_overrun(h, f2, 100.0, "2026-01-31"); assert r2["month"] == "2026-02" and r2["spent_to_date"] == 0.0

def test_prepare_daily_keeps_missing_as_nan_and_validates():
    df = pd.DataFrame({"ds": pd.to_datetime(["2026-01-01", "2026-01-02", "2026-01-04"]), "y": [1.0, 2.0, 4.0], "r": [1, 2, 4]}); d = fa.prepare_daily(df, ["r"])
    assert len(d) == 4 and d.loc["2026-01-03", "was_missing"] and np.isnan(d.loc["2026-01-03", "y"]) and d.loc["2026-01-03", "r"] == 3
    with pytest.raises(SchemaError): fa.prepare_daily(df.drop(columns="y"))
    with pytest.raises(SchemaError): fa.prepare_daily(pd.concat([df, df]))

def test_outlier_mask_flags_spike_and_cv_plan_adapts():
    y = pd.Series(100.0 + np.random.default_rng(0).normal(0, 1, 200), index=pd.date_range("2026-01-01", periods=200)); y.iloc[100] = 400; m = fa.outlier_mask(y); assert m.iloc[100] and m.sum() <= 3
    assert fa.cv_plan(1000, fa.DEFAULT_CFG)[0][0] == 540 and fa.cv_plan(100, fa.DEFAULT_CFG) == [] and len(fa.cv_plan(400, fa.DEFAULT_CFG)) >= 1

def test_forecaster_trains_on_minimal_input_and_roundtrips(tmp_path):
    a = pd.read_csv(D / "A_cost_daily.csv", parse_dates=["ds"])[["ds", "y"]].iloc[:420]       # ONLY ds + y (spec minimum)
    cfg = dict(holdout_days=60, cv_initial=240, cv_period=60, cv_horizon=60, horizons=[7, 30], select_h=30, grid=dict(changepoint_prior_scale=[0.05], seasonality_prior_scale=[10.0], seasonality_mode=["additive"]))
    r = fa.train_forecaster(a, None, cfg=cfg, out_dir=tmp_path / "b", progress=lambda *_: None); f = fa.CostForecaster.load(tmp_path / "b").forecast(14)
    assert list(f.columns) == ["ds", "yhat", "yhat_lower", "yhat_upper"] and len(f) == 14 and (f.yhat_lower <= f.yhat_upper).all() and r.holdout is not None
    with pytest.raises(ValueError): fa.CostForecaster.load(tmp_path / "b").forecast(0)

# ---------------- Model B
def _b(n_days=None):
    b = pd.read_csv(D / "B_unit_economics_daily.csv", parse_dates=["date"]); return b
def test_b_schema_errors_and_features_are_leakage_safe():
    b = _b()
    with pytest.raises(SchemaError): ue.validate_b(b.drop(columns=["cpu_avg"]))
    with pytest.raises(SchemaError): ue.validate_b(pd.concat([b, b.iloc[:3]]))
    clean, dq = ue.validate_b(b); st = ue.fit_state(clean[clean.date <= "2025-12-31"]); F = ue.add_targets(ue.build_features(clean, st)); feats = ue.feature_list(st)
    assert not [f for f in feats if f.startswith("y_")] and {f for f in feats if f.startswith("next_")} <= {"next_dow", "next_day_of_month", "next_is_weekend", "next_is_month_end", "next_is_promo", "next_is_holiday"}
    assert F.groupby("service").time_lagged_spend_1d.apply(lambda s: s.iloc[0]).isna().all()                       # lags never cross services
    F2 = ue.build_features(clean.assign(cost_usd=np.where(clean.date > "2026-03-01", clean.cost_usd * 5, clean.cost_usd)), st)     # changing the FUTURE must not change past features
    pa = F[F.date <= "2026-03-01"][feats].fillna(-1).values; pb = F2[F2.date <= "2026-03-01"][feats].fillna(-1).values
    assert pa.shape == pb.shape and np.allclose(pa, pb), "a feature at day t changed when only FUTURE costs changed (leakage)"
    assert (F.y_req.dropna() > 0).all()

def test_b_optional_columns_are_optional():
    b = _b()[ue.CORE_B]; clean, _ = ue.validate_b(b); st = ue.fit_state(clean); f = ue.feature_list(st)
    assert st["opt"] == [] and "requests_per_instance" not in f and "api_requests" in f

def test_b_trains_predicts_explains(tmp_path):
    b = _b(); b = b[b.service.isin(["catalog", "payments", "media"])]
    o = ue.train_unit_economics(b, dict(optuna_trials=2, n_boot=20), out_dir=tmp_path / "m", progress=lambda *_: None); p = ue.UnitEconomicsPredictor.load(tmp_path / "m")
    pr = p.predict(b, dict(is_promo=0, is_holiday=0)); assert set(pr.columns) >= {"service", "predicted_cost_per_api_request", "predicted_cost_per_1k_requests"} and (pr.predicted_cost_per_api_request > 0).all()
    e = p.explain(b, dict(is_promo=0, is_holiday=0))[0]; assert e["risk_level"] in ("low", "medium", "high") and e["recommended_next_investigation"] and len(e["drivers"]) == 4
    with pytest.raises(Exception): p.predict(b.drop(columns=["cost_usd"]), None)
    with pytest.raises(ValueError): p.predict(b[b.date > b.date.max() - pd.Timedelta(days=10)], None)

# ---------------- Model C
def _c(): return pd.read_csv(D / "C_telemetry_5min.csv", parse_dates=["window_start"]), pd.read_csv(D / "C_labels_eval_only.csv", parse_dates=["window_start"])
def test_c_rejects_labels_in_telemetry_and_irregular_grid():
    t, l = _c()
    with pytest.raises(SchemaError): an.validate_c(t.assign(label="x"))
    with pytest.raises(SchemaError): an.validate_c(t.drop(index=5))
    with pytest.raises(SchemaError): an.validate_c(t.drop(columns=["cpu_utilization"]))

def test_c_features_are_causal():
    t, _ = _c(); t = t.iloc[:9000]; S0 = an.fit_state(t.iloc[:5000]); x, F = an._base(t.iloc[:5000], S0); S1 = an.fit_seasonal(F, t.window_start.iloc[:5000])
    t2 = t.copy(); t2.loc[6001:, ["request_count", "cost_usd", "cpu_utilization", "instances_launched"]] *= 3
    a = an.build_features(t.iloc[:7000], S0, S1); b = an.build_features(t2.iloc[:7000], S0, S1); cols = [c for c in a.columns if c.startswith(("r_", "m1h_", "z24_", "b_"))]
    assert np.allclose(a.iloc[:6001][cols].values, b.iloc[:6001][cols].values, atol=1e-9), "non-causal feature"

def test_c_group_alerts_and_triage_rules():
    a = np.zeros(40, bool); a[[3, 4, 7, 20]] = True; assert an.group_alerts(a, 3) == [(3, 7), (20, 20)] and an.group_alerts(np.zeros(5, bool), 3) == []
    z = lambda **k: pd.DataFrame([{**{"r_ip_ratio": 0.0, "r_top_ip_share": 0.0, "r_request_rate": 0.0}, **k}])
    assert an.triage(z(r_ip_ratio=-8, r_top_ip_share=9, r_request_rate=6))[0] == "dow_candidate"
    assert an.triage(z(r_request_rate=6), promo=0.5)[0] == "likely_legitimate_traffic" and an.triage(z(r_error_5xx_rate=9))[0] == "operational"
    assert an.triage(z(r_provisioning_frequency=8, r_network_io=8))[0] == "dow_candidate"            # core-only metrics are enough for this rule
    assert an.triage(pd.DataFrame([{"r_request_rate": 0.0}]))[0] == "needs_review"

@pytest.fixture(scope="module")
def c_model(tmp_path_factory):
    t, l = _c(); d = tmp_path_factory.mktemp("c"); o = an.train_anomaly(t, l, out_dir=d / "m", progress=lambda *_: None); return t, l, o, d / "m"

def test_c_spec_params_and_thresholds_persist(c_model):
    t, l, o, d = c_model; m = o["models"]["IF_spec_raw"]; p = m.get_params()
    assert (p["n_estimators"], p["contamination"], p["max_samples"], p["random_state"]) == (200, 0.01, "auto", 42)
    import joblib; assert abs(joblib.load(d / "bundle.joblib")["threshold"] - o["thresholds"][o["best"]]) < 1e-12 and o["eval"] is not None

def test_c_stream_matches_batch_exactly(c_model):
    t, l, o, d = c_model; s = an.StreamScorer.load(d); n0 = int(len(t) * 0.8); feed = range(n0 - 400, n0 + 120); out = [s.update(t.iloc[i][s.b["required_cols"]].to_dict()) for i in feed]
    batch = s.score_frame(t.iloc[:n0 + 120]); got = np.array([r["score"] for r in out[-120:]]); ref = batch.score.values[-120:]
    assert np.allclose(got, ref, atol=1e-9) and all(isinstance(r["is_alert"], bool) for r in out)
    with pytest.raises(ValueError): s.update({"window_start": "2026-08-12"})

def test_c_core_only_and_unlabelled_modes_work():
    t, _ = _c(); core = t[an.CORE_C].iloc[:8640]; o = an.train_anomaly(core, None, progress=lambda *_: None)
    assert o["best"] == "IF_spec_resid" and not o["labelled"] and "IF_ext_group" not in o["scores"] and np.isfinite(o["thresholds"]["IF_spec_resid"])

# ---------------- savings
def test_savings_math_ranges_and_validation():
    e = sv.idle_instances(0.10, 3, observation_days=30); assert abs(e.savings_monthly_expected - 3 * 0.10 * 730) < 1e-6 and e.savings_monthly_low < e.savings_monthly_expected < e.savings_monthly_high
    thin = sv.idle_instances(0.10, 3, observation_days=3); assert thin.savings_monthly_low < e.savings_monthly_low and not all(c["passed"] for c in thin.checks)
    r = sv.rightsizing(0.20, 0.10, 5, observed_p95_cpu=40, one_time_cost=100); assert abs(r.savings_monthly_expected - 365.0) < 1e-6 and r.roi is not None and any(not c["passed"] for c in r.checks)
    assert sv.scheduled_shutdown(0.1, 2, 84).savings_monthly_expected == pytest.approx(0.1 * 2 * 730 * 0.5)
    with pytest.raises(ValueError): sv.rightsizing(0.1, 0.2, 1)
    with pytest.raises(ValueError): sv.idle_instances(-1, 1)


def test_bundle_regressors_match_selected_variant(tmp_path):
    """Regression test: if the selected variant has NO regressors, the saved model must not require any (loading + forecasting must work)."""
    a = pd.read_csv(D / "A_cost_daily.csv", parse_dates=["ds"]).iloc[:420]
    cfg = dict(holdout_days=60, cv_initial=240, cv_period=60, cv_horizon=60, horizons=[7, 30], select_h=30, grid=dict(changepoint_prior_scale=[0.05], seasonality_prior_scale=[10.0], seasonality_mode=["additive"]))
    r = fa.train_forecaster(a[["ds", "y", "api_requests", "active_users"]], None, regressors=["api_requests", "active_users"], cfg=cfg, out_dir=tmp_path / "x", progress=lambda *_: None)
    f = fa.CostForecaster.load(tmp_path / "x"); out = f.forecast(10); assert len(out) == 10 and f.regs == r.meta["regressors"]
