"""Model B: XGBoost unit-economics prediction (+ SHAP explanations with risk level and next investigation).
Core input columns (spec): date, service, cost_usd, active_users, api_requests, transactions, cpu_avg, network_bytes, instance_family, region, resource_tag, provisioning_frequency.
Optional columns used when present: instance_count_avg, instance_count_max, cpu_p95, mem_avg, ebs_provisioned_gb, is_promo, is_holiday.
`time_lagged_spend` is computed in code (cost lags). Target: NEXT-DAY cost per API request (scaled x1000 internally for numerical stability; outputs are per request AND per 1k)."""
from __future__ import annotations
import json, logging, platform
from pathlib import Path
import numpy as np, pandas as pd
from .common import SchemaError, require_columns, regression_metrics, jdump, set_seed

log = logging.getLogger("cloudsense.unit")
CORE_B = ["date", "service", "cost_usd", "active_users", "api_requests", "transactions", "cpu_avg", "network_bytes", "instance_family", "region", "resource_tag", "provisioning_frequency"]
OPT_B = ["instance_count_avg", "instance_count_max", "cpu_p95", "mem_avg", "ebs_provisioned_gb", "is_promo", "is_holiday"]
CATS_B = ["service", "instance_family", "region", "resource_tag"]
TARGET_SCALE = 1000.0
XGB_START = dict(n_estimators=500, max_depth=6, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8, objective="reg:squarederror", random_state=42)   # spec starting values
DEFAULT_CFG = dict(seed=42, train_frac=0.70, val_frac=0.15, optuna_trials=30, cv_train_fracs=[0.5, 0.65, 0.8], cv_val_frac=0.15, n_boot=500, r2_guard=0.999, tier1_bytes=10240e9,
                   risk_medium_pct=5.0, risk_high_pct=15.0, per_txn_services=None)

# ----------------------------------------------------------------------------- validation + cleaning
def validate_b(df: pd.DataFrame):
    """Check spec schema, duplicates, impossible values. Returns (clean_df, data_quality_dict). Zero denominators are kept (handled at target time), never silently filled."""
    require_columns(df, CORE_B, "Model B input")
    d = df.copy(); d["date"] = pd.to_datetime(d["date"])
    if d.duplicated(["date", "service"]).any(): raise SchemaError("Model B input: duplicate (date, service) rows. Join your cost and KPI tables first (one row per service per day).")
    d = d.sort_values(["service", "date"]).reset_index(drop=True)
    num = d.select_dtypes("number")
    dq = dict(rows=len(d), services=sorted(d.service.unique().tolist()), date_range=[str(d.date.min().date()), str(d.date.max().date())], negatives=int((num < 0).sum().sum()),
              cpu_over_100=int((d.cpu_avg > 100).sum()), zero_requests=int((d.api_requests == 0).sum()), zero_users=int((d.active_users == 0).sum()), zero_transactions_share=round(float((d.transactions == 0).mean()), 3),
              cpu_nan=int(d.cpu_avg.isna().sum()), date_gaps={k: int((g.date.diff().dt.days.dropna() != 1).sum()) for k, g in d.groupby("service")}, optional_columns_present=[c for c in OPT_B if c in d.columns])
    if dq["negatives"] or dq["cpu_over_100"]: raise SchemaError(f"Model B input has impossible values: {dq}")
    return d, dq

def fit_state(train: pd.DataFrame, cfg=None) -> dict:
    """Statistics learned from TRAIN rows only (imputation values, category vocabularies, optional columns)."""
    cfg = {**DEFAULT_CFG, **(cfg or {})}
    return dict(cpu_median={k: float(v) for k, v in train.groupby("service").cpu_avg.median().items()}, cpu_global=float(train.cpu_avg.median()),
                categories={c: sorted(train[c].astype(str).unique().tolist()) for c in CATS_B}, opt=[c for c in OPT_B if c in train.columns], tier1_bytes=cfg["tier1_bytes"])

def build_features(df: pd.DataFrame, state: dict, next_calendar: dict | None = None) -> pd.DataFrame:
    """Leakage-safe features. Row t uses data up to end of day t plus CALENDAR for t+1 (known in advance). All lags/rolls are per service."""
    x = df.sort_values(["service", "date"]).copy(); opt = state["opt"]
    x["cpu_imputed"] = x.cpu_avg.isna().astype(int)
    x["cpu_avg"] = x.cpu_avg.fillna(x.service.map(state["cpu_median"])).fillna(state["cpu_global"])
    if "cpu_p95" in opt: x["cpu_p95"] = x.cpu_p95.fillna(x.cpu_avg)
    x["unit_cost_today"] = x.cost_usd / x.api_requests.replace(0, np.nan) * TARGET_SCALE
    g = x.groupby("service", sort=False)
    x["network_bytes_per_request"] = x.network_bytes / x.api_requests.replace(0, np.nan); x["requests_per_user"] = x.api_requests / x.active_users.replace(0, np.nan)
    for L in (1, 7):
        x[f"time_lagged_spend_{L}d"] = g.cost_usd.shift(L); x[f"unit_cost_lag{L}"] = g.unit_cost_today.shift(L)
    for w in (7, 28):
        for col, nm in [("cost_usd", "cost"), ("api_requests", "req"), ("unit_cost_today", "unit")]:
            x[f"{nm}_roll{w}_mean"] = g[col].transform(lambda s: s.rolling(w, min_periods=w).mean()); x[f"{nm}_roll{w}_std"] = g[col].transform(lambda s: s.rolling(w, min_periods=w).std())
    x["req_pct_change_1d"] = g.api_requests.pct_change().replace([np.inf, -np.inf], np.nan); x["cost_pct_change_1d"] = g.cost_usd.pct_change().replace([np.inf, -np.inf], np.nan)
    daily = x.groupby("date").network_bytes.sum(); mtd = daily.groupby(daily.index.to_period("M")).cumsum()          # account-level month-to-date transfer (tier effect)
    x["mtd_network_bytes"] = x.date.map(mtd); x["tier1_share_used"] = np.clip(x.mtd_network_bytes / state["tier1_bytes"], 0, 1)
    nd = x.date + pd.Timedelta(days=1); x["next_dow"] = nd.dt.dayofweek; x["next_day_of_month"] = nd.dt.day; x["days_to_month_end"] = nd.dt.days_in_month - nd.dt.day
    x["next_is_weekend"] = (x.next_dow >= 5).astype(int); x["next_is_month_end"] = (x.next_day_of_month >= 28).astype(int)
    if "instance_count_avg" in opt:
        x["requests_per_instance"] = x.api_requests / x.instance_count_avg; x["users_per_instance"] = x.active_users / x.instance_count_avg
        x["cpu_x_inst"] = x.cpu_avg * x.instance_count_avg; x["inst_pct_change_1d"] = x.groupby("service", sort=False).instance_count_avg.pct_change()
    if "cpu_p95" in opt: x["cpu_headroom"] = 100 - x.cpu_p95
    if "ebs_provisioned_gb" in opt and "instance_count_avg" in opt: x["ebs_gb_per_instance"] = x.ebs_provisioned_gb / x.instance_count_avg
    for c in ("is_promo", "is_holiday"):
        if c in opt:
            x["next_" + c] = x.groupby("service", sort=False)[c].shift(-1)
            if next_calendar:
                for dt, cal in next_calendar.items():
                    m = (x.date == pd.Timestamp(dt)) & x["next_" + c].isna(); x.loc[m, "next_" + c] = cal.get(c, 0)
    for c in CATS_B: x[c + "_code"] = pd.Categorical(x[c].astype(str), categories=state["categories"][c]).codes      # unseen → -1
    return x

def feature_list(state: dict) -> list[str]:
    f = ["active_users", "api_requests", "transactions", "cpu_avg", "network_bytes", "provisioning_frequency", "cost_usd", "unit_cost_today", "cpu_imputed", "network_bytes_per_request", "requests_per_user",
         "time_lagged_spend_1d", "time_lagged_spend_7d", "unit_cost_lag1", "unit_cost_lag7"] + [f"{n}_roll{w}_{s}" for n in ("cost", "req", "unit") for w in (7, 28) for s in ("mean", "std")] + \
        ["req_pct_change_1d", "cost_pct_change_1d", "mtd_network_bytes", "tier1_share_used", "next_dow", "next_day_of_month", "days_to_month_end", "next_is_weekend", "next_is_month_end"]
    o = state["opt"]
    if "instance_count_avg" in o: f += ["instance_count_avg", "requests_per_instance", "users_per_instance", "cpu_x_inst", "inst_pct_change_1d"]
    if "instance_count_max" in o: f += ["instance_count_max"]
    if "cpu_p95" in o: f += ["cpu_p95", "cpu_headroom"]
    if "mem_avg" in o: f += ["mem_avg"]
    if "ebs_provisioned_gb" in o: f += ["ebs_provisioned_gb"] + (["ebs_gb_per_instance"] if "instance_count_avg" in o else [])
    for c in ("is_promo", "is_holiday"):
        if c in o: f += ["next_" + c]
    return f + [c + "_code" for c in CATS_B]

def add_targets(x: pd.DataFrame) -> pd.DataFrame:
    """Next-day unit costs per service. Zero denominators → NaN (rows excluded for that target, never filled)."""
    g = x.groupby("service", sort=False)
    nreq, nusr, ntxn, ncost = g.api_requests.shift(-1), g.active_users.shift(-1), g.transactions.shift(-1), g.cost_usd.shift(-1)
    x["y_req"] = np.where(nreq > 0, ncost / nreq.replace(0, np.nan) * TARGET_SCALE, np.nan)
    x["y_user"] = np.where(nusr > 0, ncost / nusr.replace(0, np.nan) * TARGET_SCALE, np.nan)
    x["y_txn"] = np.where(ntxn > 0, ncost / ntxn.replace(0, np.nan), np.nan)
    x["unit_cost_lag6"] = g.unit_cost_today.shift(6); return x

# ----------------------------------------------------------------------------- explanation: risk level + next investigation
FAMILIES = [("provisioning", ["provisioning_frequency", "inst_pct_change", "launch"]), ("capacity", ["instance_count", "requests_per_instance", "users_per_instance", "cpu_x_inst", "cpu_headroom", "cpu_avg", "cpu_p95", "ebs_"]),
            ("network_tier", ["network_bytes", "mtd_network", "tier1"]), ("traffic", ["api_requests", "active_users", "req_", "requests_per_user", "transactions"]),
            ("calendar", ["next_", "days_to_month_end"]), ("spend_trend", ["cost", "unit_cost", "time_lagged_spend"])]
NEXT_STEP = {"provisioning": "Review recent instance launches (CloudTrail RunInstances / Auto Scaling activities); confirm they are expected and not abuse.",
             "capacity": "Compare CPU with fleet size: check Auto Scaling minimum size and right-sizing; look for idle or over-provisioned instances.",
             "network_tier": "Check data-transfer volume and month-to-date tier position; review CDN/caching and large downloads.",
             "traffic": "Traffic changed relative to fixed cost: check campaign end, outages or traffic loss (unit cost rises when requests fall).",
             "calendar": "Cost pattern follows the calendar (weekend/month-end/promo): confirm it is the expected seasonal effect.",
             "spend_trend": "Persistent spend trend: check recent deployments, pricing or discount changes, and long-running resources."}
def feature_family(name: str) -> str:
    for fam, keys in FAMILIES:
        if any(k in name for k in keys): return fam
    return "spend_trend"

def risk_from_change(change_pct: float, cfg) -> str:
    return "high" if change_pct >= cfg["risk_high_pct"] else ("medium" if change_pct >= cfg["risk_medium_pct"] else "low")

# ----------------------------------------------------------------------------- training
def train_unit_economics(df: pd.DataFrame, cfg: dict | None = None, out_dir=None, progress=print) -> dict:
    """Full Model-B training: time split, baselines (naive, same-weekday, LinearRegression, Ridge, RF, LightGBM), XGBoost (spec params vs Optuna), selection on VALIDATION,
    refit on train+val, ONE evaluation on test, bootstrap CIs, secondary targets, SHAP. Saves a bundle when out_dir is given."""
    import xgboost as xgb, lightgbm as lgb, optuna
    from sklearn.linear_model import LinearRegression, Ridge
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.preprocessing import StandardScaler
    optuna.logging.set_verbosity(optuna.logging.WARNING)
    cfg = {**DEFAULT_CFG, **(cfg or {})}; set_seed(cfg["seed"]); clean, dq = validate_b(df)
    dates = np.sort(clean.date.unique()); n = len(dates); t_end = dates[int(n * cfg["train_frac"]) - 1]; v_end = dates[int(n * (cfg["train_frac"] + cfg["val_frac"])) - 1]
    state = fit_state(clean[clean.date <= t_end], cfg); FE = add_targets(build_features(clean, state)); feats = feature_list(state)
    FE["split"] = np.where(FE.date <= t_end, "train", np.where(FE.date <= v_end, "val", "test"))
    M = FE.dropna(subset=["y_req", "unit_cost_lag28" if "unit_cost_lag28" in FE else "cost_roll28_mean", "time_lagged_spend_7d"]).copy()
    tr, va, te = (M[M.split == s] for s in ("train", "val", "test")); progress(f"rows train/val/test: {len(tr)}/{len(va)}/{len(te)} | split {pd.Timestamp(t_end).date()} / {pd.Timestamp(v_end).date()}")
    if min(len(tr), len(va), len(te)) < 50: raise SchemaError("Not enough rows per split (need >= 50). Provide more days or services.")
    metr = lambda y, p: regression_metrics(y, p)
    PRED = {"naive_today": {s: d.unit_cost_today.values for s, d in (("val", va), ("test", te))},
            "naive_same_weekday": {s: d.unit_cost_lag6.fillna(d.unit_cost_today).values for s, d in (("val", va), ("test", te))}}
    lin_cols = [f for f in feats if not f.endswith("_code")]; X = lambda d: d[lin_cols].fillna(0.0).values
    sc = StandardScaler().fit(X(tr)); oh = lambda d: pd.get_dummies(d[CATS_B].astype(str), dtype=float).reindex(columns=oh_cols, fill_value=0.0).values
    oh_cols = pd.get_dummies(tr[CATS_B].astype(str), dtype=float).columns; XL = lambda d: np.hstack([sc.transform(X(d)), oh(d)])
    lr = LinearRegression().fit(XL(tr), tr.y_req); PRED["linear_regression"] = {s: lr.predict(XL(d)) for s, d in (("val", va), ("test", te))}
    rg = Ridge(alpha=1.0).fit(XL(tr), tr.y_req); PRED["ridge"] = {s: rg.predict(XL(d)) for s, d in (("val", va), ("test", te))}
    rf = RandomForestRegressor(300, max_depth=14, min_samples_leaf=3, n_jobs=-1, random_state=42).fit(tr[feats].fillna(-1), tr.y_req); PRED["random_forest"] = {s: rf.predict(d[feats].fillna(-1)) for s, d in (("val", va), ("test", te))}
    lg = lgb.LGBMRegressor(n_estimators=500, learning_rate=.05, num_leaves=31, subsample=.8, colsample_bytree=.8, random_state=42, verbose=-1).fit(tr[feats], tr.y_req, eval_set=[(va[feats], va.y_req)], callbacks=[lgb.early_stopping(30, verbose=False)])
    PRED["lightgbm"] = {s: lg.predict(d[feats]) for s, d in (("val", va), ("test", te))}
    x0 = xgb.XGBRegressor(**XGB_START, early_stopping_rounds=40).fit(tr[feats], tr.y_req, eval_set=[(va[feats], va.y_req)], verbose=False); PRED["xgb_spec_params"] = {s: x0.predict(d[feats]) for s, d in (("val", va), ("test", te))}
    tdates = np.sort(tr.date.unique()); folds = []
    for f in cfg["cv_train_fracs"]:
        a_ = tdates[int(len(tdates) * f) - 1]; b_ = tdates[min(len(tdates) - 1, int(len(tdates) * (f + cfg["cv_val_frac"])) - 1)]; folds.append((tr[tr.date <= a_], tr[(tr.date > a_) & (tr.date <= b_)]))
    def objective(trial):
        p = dict(max_depth=trial.suggest_int("max_depth", 3, 9), learning_rate=trial.suggest_float("learning_rate", .02, .15, log=True), subsample=trial.suggest_float("subsample", .6, 1.0), colsample_bytree=trial.suggest_float("colsample_bytree", .5, 1.0),
                 min_child_weight=trial.suggest_int("min_child_weight", 1, 10), gamma=trial.suggest_float("gamma", 0, 5e-4), reg_alpha=trial.suggest_float("reg_alpha", 1e-8, 1e-3, log=True), reg_lambda=trial.suggest_float("reg_lambda", 1e-2, 10, log=True))
        ms = []
        for a_, b_ in folds:
            m = xgb.XGBRegressor(n_estimators=800, objective="reg:squarederror", random_state=42, early_stopping_rounds=30, **p).fit(a_[feats], a_.y_req, eval_set=[(b_[feats], b_.y_req)], verbose=False); ms.append(np.mean(np.abs(b_.y_req - m.predict(b_[feats]))))
        return float(np.mean(ms))
    study = optuna.create_study(direction="minimize", sampler=optuna.samplers.TPESampler(seed=42)); study.enqueue_trial(dict(max_depth=6, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8, min_child_weight=1, gamma=0.0, reg_alpha=1e-8, reg_lambda=1.0))
    study.optimize(objective, n_trials=cfg["optuna_trials"]); BEST = study.best_params
    xt = xgb.XGBRegressor(n_estimators=800, objective="reg:squarederror", random_state=42, early_stopping_rounds=40, **BEST).fit(tr[feats], tr.y_req, eval_set=[(va[feats], va.y_req)], verbose=False); PRED["xgb_tuned"] = {s: xt.predict(d[feats]) for s, d in (("val", va), ("test", te))}
    pp = {"val": np.zeros(len(va)), "test": np.zeros(len(te))}
    for k in tr.service.unique():
        a_, b_, c_ = tr[tr.service == k], va[va.service == k], te[te.service == k]
        if min(len(a_), len(b_)) < 30: continue
        m = xgb.XGBRegressor(n_estimators=800, objective="reg:squarederror", random_state=42, early_stopping_rounds=40, **BEST).fit(a_[feats], a_.y_req, eval_set=[(b_[feats], b_.y_req)], verbose=False)
        pp["val"][(va.service == k).values] = m.predict(b_[feats]); pp["test"][(te.service == k).values] = m.predict(c_[feats])
    PRED["xgb_tuned_per_service"] = pp
    vmae = {k: float(np.mean(np.abs(va.y_req - v["val"]))) for k, v in PRED.items()}; CHOICE = min(["xgb_spec_params", "xgb_tuned"], key=vmae.get); XM = x0 if CHOICE == "xgb_spec_params" else xt
    P_FINAL = {k: v for k, v in XGB_START.items() if k != "n_estimators"} if CHOICE == "xgb_spec_params" else dict(BEST, objective="reg:squarederror", random_state=42)
    progress(f"validation MAE: { {k: round(v, 5) for k, v in vmae.items()} } -> deploy {CHOICE}")
    trva = pd.concat([tr, va]); n_final = int(max(100, XM.best_iteration * 1.1)); FINAL = xgb.XGBRegressor(n_estimators=n_final, **P_FINAL).fit(trva[feats], trva.y_req); PRED["xgb_final_refit"] = {"test": FINAL.predict(te[feats])}
    rows = []
    for k, v in PRED.items():
        for s in ("val", "test"):
            if s in v: r = metr((va if s == "val" else te).y_req, v[s]); r.update(model=k, split=s); rows.append(r)
    RES = pd.DataFrame(rows)[["model", "split", "MAE", "RMSE", "R2", "MAPE", "sMAPE"]]
    r2t = float(RES[(RES.model == "xgb_final_refit") & (RES.split == "test")].R2.iloc[0])
    if r2t >= cfg["r2_guard"]: raise RuntimeError(f"R2={r2t:.5f} >= {cfg['r2_guard']}: audit for leakage before trusting results")
    rng = np.random.default_rng(42); T = te.assign(pf=PRED["xgb_final_refit"]["test"]); ud = T.date.unique(); cis = {}
    for b in ["naive_today", "naive_same_weekday", "linear_regression", "ridge", "random_forest", "lightgbm"]:
        diff = np.abs(te.y_req.values - PRED[b]["test"]) - np.abs(T.y_req - T.pf).values; dd = pd.Series(diff).groupby(T.date.values).mean(); bs = [dd.loc[rng.choice(ud, len(ud))].mean() for _ in range(cfg["n_boot"])]
        cis[b] = (float(dd.mean()), *map(float, np.percentile(bs, [2.5, 97.5])))
    SEC = {}
    for nm, col, sel in [("cost_per_active_user", "y_user", None), ("cost_per_transaction", "y_txn", cfg["per_txn_services"] or sorted(clean[clean.transactions > 0].service.unique().tolist()))]:
        Z = M[M.service.isin(sel)] if sel else M; n_all = len(Z); Z = Z.dropna(subset=[col]); a_, b_, c_ = (Z[Z.split == s] for s in ("train", "val", "test"))
        if min(len(a_), len(b_), len(c_)) < 30: continue
        m = xgb.XGBRegressor(n_estimators=800, early_stopping_rounds=40, **P_FINAL).fit(a_[feats], a_[col], eval_set=[(b_[feats], b_[col])], verbose=False)
        base = (c_.cost_usd / c_.active_users.replace(0, np.nan) * TARGET_SCALE) if col == "y_user" else c_.cost_usd / c_.transactions.replace(0, np.nan)
        SEC[nm] = dict(model=m, excluded_rows=int(n_all - len(Z)), xgb=metr(c_[col], m.predict(c_[feats])), naive=metr(c_[col].values, base.fillna(c_[col].median()).values))
    out = dict(results=RES, bootstrap=cis, choice=CHOICE, params=P_FINAL, n_trees=n_final, tuned_params=BEST, dq=dq, split=dict(train_end=str(pd.Timestamp(t_end).date()), val_end=str(pd.Timestamp(v_end).date())), state=state,
               features=feats, model=FINAL, test_frame=T, secondary=SEC, FE=FE, splits=(tr, va, te), pred=PRED, optuna=study.trials_dataframe())
    if out_dir is not None: out["bundle_dir"] = save_bundle_b(out, Path(out_dir), cfg)
    return out

def save_bundle_b(out: dict, d: Path, cfg) -> Path:
    d.mkdir(parents=True, exist_ok=True); out["model"].save_model(d / "model.json")
    for k, v in out["secondary"].items(): v["model"].save_model(d / f"model_secondary_{k}.json")
    T = out["test_frame"]; jdump(dict(features=out["features"], state=out["state"], params=out["params"], n_trees=out["n_trees"], choice=out["choice"], split=out["split"], target_scale=TARGET_SCALE, cfg=cfg,
        target="next-day cost per API request (USD); model works in USD per 1,000 requests", note="model.json does not store training params; they are recorded here",
        versions=dict(python=platform.python_version(), pandas=pd.__version__, numpy=np.__version__), metrics_test={k: v for k, v in out["results"][out["results"].split == "test"].set_index("model").to_dict("index").items()}), d / "preprocessing.json")
    return d

class UnitEconomicsPredictor:
    """predict(history, next_calendar) -> per service: predicted cost per API request (USD) and per 1k requests for the day AFTER the last date in `history`.
    explain(...) adds SHAP drivers, a risk level and a recommended next investigation."""
    def __init__(self, model_dir):
        import xgboost as xgb
        self.dir = Path(model_dir); self.prep = json.load(open(self.dir / "preprocessing.json")); self.model = xgb.XGBRegressor(); self.model.load_model(self.dir / "model.json")
        self.state, self.feats, self.cfg = self.prep["state"], self.prep["features"], {**DEFAULT_CFG, **self.prep.get("cfg", {})}; self._expl = None
    @classmethod
    def load(cls, model_dir): return cls(model_dir)
    def _rows(self, history, next_calendar, with_ref=False):
        require_columns(history, CORE_B, "UnitEconomicsPredictor history")
        h = history.copy(); h["date"] = pd.to_datetime(h["date"])
        if h.groupby("service").date.nunique().min() < 29: raise ValueError("need >= 29 days of history per service (28-day rolling windows)")
        last = h.date.max(); x = build_features(h, self.state, {last: next_calendar} if next_calendar else None); cur = x[x.date == last]
        if not with_ref: return cur
        return cur, x[(x.date < last) & (x.date >= last - pd.Timedelta(days=7))]
    def predict(self, history: pd.DataFrame, next_calendar: dict | None = None) -> pd.DataFrame:
        r = self._rows(history, next_calendar); p = self.model.predict(r[self.feats]) / TARGET_SCALE
        return pd.DataFrame({"date": r.date.values, "service": r.service.values, "predicted_cost_per_api_request": p, "predicted_cost_per_1k_requests": p * TARGET_SCALE})
    def explain(self, history, next_calendar=None, top_k=4) -> list[dict]:
        """Why does tomorrow's unit cost differ from this service's own recent norm? Drivers = SHAP(now) - mean SHAP(previous 7 days), so they attribute the CHANGE, not cross-service differences."""
        import shap
        if self._expl is None: self._expl = shap.TreeExplainer(self.model)
        cur, ref = self._rows(history, next_calendar, with_ref=True); pred = self.model.predict(cur[self.feats]); sv = self._expl.shap_values(cur[self.feats]); out = []
        for i, (_, row) in enumerate(cur.iterrows()):
            r = ref[ref.service == row["service"]]; sref = self._expl.shap_values(r[self.feats]).mean(axis=0) if len(r) else np.zeros(len(self.feats))
            s = pd.Series(sv[i] - sref, index=self.feats); top = s.reindex(s.abs().sort_values(ascending=False).index)[:top_k]
            ref_val = row["unit_roll7_mean"]; chg = float((pred[i] / ref_val - 1) * 100) if ref_val and np.isfinite(ref_val) else 0.0; risk = risk_from_change(chg, self.cfg)
            drivers = [dict(feature=f, family=feature_family(f), shap_change=float(v), direction="raises" if v > 0 else "lowers", value=float(row[f]) if np.isfinite(row[f]) else None) for f, v in top.items()]
            pos = [d for d in drivers if d["shap_change"] > 0]; fam = (pos[0] if pos else drivers[0])["family"]
            sent = (f"{row['service']}: predicted cost per 1k requests {pred[i]:.4f} ({chg:+.1f}% vs its realised 7-day mean). Compared with its last 7 days, the biggest changes in model drivers: "
                    + "; ".join(f"{d['feature']} ({d['direction']} it)" for d in drivers) + ". Model attribution only - not causal proof and not a savings estimate.")
            out.append(dict(service=row["service"], date=str(row["date"].date()), predicted_cost_per_api_request=float(pred[i] / TARGET_SCALE), predicted_cost_per_1k_requests=float(pred[i]), change_vs_7d_mean_pct=chg,
                            risk_level=risk, drivers=drivers, recommended_next_investigation=NEXT_STEP[fam], explanation=sent))
        return out
