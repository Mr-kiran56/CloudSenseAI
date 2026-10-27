"""Model A: Prophet cloud-cost forecasting.
Spec: growth=linear, daily_seasonality=False, weekly=True when history supports it, yearly='auto', interval_width=0.80, horizons 7/30/90,
rolling-origin validation, MAPE/RMSE/MAE, budget-overrun date. Input core columns: ds, y. Optional: any regressor columns (e.g. api_requests, active_users, workload_index)."""
from __future__ import annotations
import itertools, json, logging, platform
from dataclasses import dataclass, field, asdict
from pathlib import Path
import numpy as np, pandas as pd
from .common import SchemaError, require_columns, regression_metrics, jdump, set_seed

log = logging.getLogger("cloudsense.forecast")
for n in ("cmdstanpy", "prophet"): logging.getLogger(n).setLevel(logging.ERROR)

SPEC = dict(growth="linear", daily_seasonality=False, interval_width=0.80, horizons=(7, 30, 90))
DEFAULT_CFG = dict(seed=42, holdout_days=90, cv_initial=540, cv_period=90, cv_horizon=90, horizons=[7, 30, 90], select_h=30, monthly_fourier=5, changepoint_range=0.9,
                   grid=dict(changepoint_prior_scale=[0.05, 0.2], seasonality_prior_scale=[1.0, 10.0], seasonality_mode=["additive", "multiplicative"]), outlier_z=4.0)

# ----------------------------------------------------------------------------- data
def prepare_daily(df: pd.DataFrame, regressors=(), cost_basis: str = "net unblended cost, USD") -> pd.DataFrame:
    """Validate, sort, reindex to a full daily calendar. Missing cost days stay NaN (NEVER zero); regressor gaps are interpolated and flagged."""
    require_columns(df, ["ds", "y"], "Model A input")
    d = df.copy(); d["ds"] = pd.to_datetime(d["ds"])
    if d.ds.duplicated().any(): raise SchemaError("Model A input: duplicate dates in `ds`")
    d = d.sort_values("ds").set_index("ds")
    if (d.y.dropna() <= 0).any(): log.warning("non-positive cost values found; check the cost basis (%s)", cost_basis)
    full = pd.date_range(d.index.min(), d.index.max(), freq="D"); d = d.reindex(full).rename_axis("ds")
    d["was_missing"] = d["y"].isna()
    for r in regressors:
        require_columns(d, [r], "Model A regressor")
        d[r] = d[r].interpolate(limit_direction="both")
    d.attrs["cost_basis"] = cost_basis; d.attrs["missing_dates"] = [x.strftime("%Y-%m-%d") for x in d.index[d.was_missing]]
    return d

def outlier_mask(y: pd.Series, window: int = 61, z: float = 4.0) -> pd.Series:
    """Unsupervised flag for cost spikes: robust z-score of log cost vs rolling median. Works without incident labels (real accounts)."""
    ly = np.log(y.where(y > 0)); med = ly.rolling(window, center=True, min_periods=max(7, window // 4)).median(); res = ly - med
    mad = 1.4826 * res.abs().median()
    return (res.abs() > z * mad).fillna(False)

# ----------------------------------------------------------------------------- model construction
@dataclass
class VariantSpec:
    name: str
    mask: str = "none"            # none | auto | labels
    monthly: bool = False
    params: dict = field(default_factory=dict)
    regs: list = field(default_factory=list)
    reg_mode: str | None = None   # oracle | forecast
    deployable: bool = True

def make_prophet(params: dict, regressors=(), monthly=False, n_days=1000, holidays=None, monthly_fourier=5):
    from prophet import Prophet
    m = Prophet(growth=SPEC["growth"], daily_seasonality=SPEC["daily_seasonality"], weekly_seasonality=bool(n_days >= 14),   # weekly only when history supports it
                yearly_seasonality="auto", interval_width=SPEC["interval_width"], holidays=holidays,
                seasonality_mode=params.get("seasonality_mode", "additive"), changepoint_prior_scale=params.get("changepoint_prior_scale", 0.05),
                seasonality_prior_scale=params.get("seasonality_prior_scale", 10.0), changepoint_range=params.get("changepoint_range", 0.8))
    if monthly: m.add_seasonality(name="monthly", period=30.5, fourier_order=monthly_fourier)
    for r in regressors: m.add_regressor(r)
    return m

def _train_target(train: pd.DataFrame, spec: VariantSpec, cfg) -> pd.Series:
    y = train["y"].copy()
    if spec.mask == "auto": y = y.where(~outlier_mask(train["y"].interpolate(), z=cfg["outlier_z"]))
    elif spec.mask == "labels":
        if "incident" not in train.columns: raise SchemaError("mask='labels' needs a boolean `incident` column")
        y = y.where(~train["incident"].astype(bool))
    return y

def _forecast_regressor(train: pd.DataFrame, idx, col, holidays):
    from prophet import Prophet
    m = Prophet(weekly_seasonality=len(train) >= 14, yearly_seasonality="auto", daily_seasonality=False, holidays=holidays)
    m.fit(train.reset_index()[["ds", col]].rename(columns={col: "y"})); return m.predict(pd.DataFrame({"ds": idx}))["yhat"].values

def fit_forecast(train, test_index, spec: VariantSpec, cfg, holidays=None, test_regs: pd.DataFrame | None = None):
    """Fit on `train` ONLY (earlier dates) and forecast `test_index`. Returns yhat, lower, upper arrays."""
    y = _train_target(train, spec, cfg); tr = pd.DataFrame({"ds": train.index, "y": y.values})
    for r in spec.regs: tr[r] = train[r].values
    tr = tr.dropna(subset=["y"]); m = make_prophet(spec.params, spec.regs, spec.monthly, len(tr), holidays, cfg["monthly_fourier"]); m.fit(tr)
    fut = pd.DataFrame({"ds": test_index})
    for r in spec.regs:
        fut[r] = (test_regs[r].values if spec.reg_mode == "oracle" else _forecast_regressor(train, test_index, r, holidays))
    f = m.predict(fut); return f["yhat"].values, f["yhat_lower"].values, f["yhat_upper"].values, m

# ----------------------------------------------------------------------------- validation
def cv_plan(n_pre: int, cfg) -> list[tuple[int, int]]:
    """Expanding-window folds (train_end, test_end). Adapts to shorter real histories; returns [] if CV is impossible."""
    h, per, ini = cfg["cv_horizon"], cfg["cv_period"], cfg["cv_initial"]
    if n_pre < ini + h:                       # short history → shrink initial window, keep at least 120 days of training
        ini = max(120, n_pre - 2 * h)
        if n_pre < ini + h: return []
    return [(a, a + h) for a in range(ini, n_pre - h + 1, per)]

def baseline_predict(name: str, train: pd.DataFrame, n_test: int):
    y = train["y"].interpolate().values; a = len(y)
    if name in ("B_snaive7", "B_snaive28"):
        lag = 7 if name == "B_snaive7" else 28; idx = [a + j - lag * (j // lag + 1) for j in range(n_test)]; return y[idx]
    if name == "B_drift":
        slope = (y[-1] - y[0]) / (a - 1); return y[-1] + slope * np.arange(1, n_test + 1)
    if name == "B_sarima":
        from statsmodels.tsa.statespace.sarimax import SARIMAX
        r = SARIMAX(np.log(y[-400:]), order=(1, 1, 1), seasonal_order=(1, 0, 1, 7), enforce_stationarity=False, enforce_invertibility=False).fit(disp=False, maxiter=60)
        return np.exp(r.forecast(n_test))
    raise ValueError(name)

def _cv_rows(name, df_pre, folds, predict_fn, horizons):
    rows = []
    for fi, (a, b) in enumerate(folds):
        tr, te = df_pre.iloc[:a], df_pre.iloc[a:b]; p, lo, hi = predict_fn(tr, te); ok = ~te.was_missing.values
        for h in horizons:
            mk = ok.copy(); mk[h:] = False
            if mk.sum() == 0: continue
            r = regression_metrics(te.y.values[mk], p[mk], None if lo is None else lo[mk], None if hi is None else hi[mk]); r.update(variant=name, fold=fi, h=h); rows.append(r)
    return pd.DataFrame(rows)

# ----------------------------------------------------------------------------- budget overrun
def budget_overrun(history_y: pd.Series, fc: pd.DataFrame, monthly_budget: float, as_of) -> dict:
    """Expected, earliest (upper bound) and latest (lower bound) dates when month-to-date + forecast spend crosses the budget.
    If `as_of` is a month-end, the NEXT month is evaluated (nothing spent yet)."""
    as_of = pd.Timestamp(as_of).normalize(); ref = as_of + pd.Timedelta(days=1) if as_of == as_of + pd.offsets.MonthEnd(0) else as_of
    ms = ref.replace(day=1); me = ms + pd.offsets.MonthEnd(0)
    spent = float(history_y[(history_y.index >= ms) & (history_y.index <= as_of)].sum())
    f = fc[(fc.ds > as_of) & (fc.ds <= me)].set_index("ds")
    def first_cross(col):
        cum = spent + f[col].cumsum(); hit = cum[cum > monthly_budget]; return None if hit.empty else hit.index[0].date().isoformat()
    return dict(month=ms.strftime("%Y-%m"), spent_to_date=spent, projected_month_total=float(spent + f.yhat.sum()), budget=float(monthly_budget),
                expected_overrun_date=first_cross("yhat"), earliest_overrun_date=first_cross("yhat_upper"), latest_overrun_date=first_cross("yhat_lower"))

# ----------------------------------------------------------------------------- training orchestration
@dataclass
class ForecastResult:
    cv_summary: pd.DataFrame
    cv_all: pd.DataFrame
    tuning: pd.DataFrame
    best_variant: str
    best_params: dict
    holdout: dict | None
    holdout_frame: pd.DataFrame | None
    baselines_best: str
    folds: list
    meta: dict
    bundle_dir: Path | None = None

def train_forecaster(df: pd.DataFrame, holidays: pd.DataFrame | None = None, regressors=(), service_df: pd.DataFrame | None = None, cfg: dict | None = None,
                     out_dir=None, labels_incident: pd.Series | None = None, progress=print) -> ForecastResult:
    """Full Model-A training: CV over variants + baselines, select deployable model on CV, evaluate ONCE on the final hold-out, refit on all data, save bundle."""
    cfg = {**DEFAULT_CFG, **(cfg or {})}; set_seed(cfg["seed"]); regs = list(regressors); D = prepare_daily(df, regs)
    if labels_incident is not None: D["incident"] = labels_incident.reindex(D.index).fillna(False).astype(bool)
    H = cfg["holdout_days"]; pre, hold = (D.iloc[:-H], D.iloc[-H:]) if H and len(D) > H + 200 else (D, D.iloc[0:0])
    if len(hold) == 0: progress("history too short for a hold-out; skipping hold-out evaluation")
    folds = cv_plan(len(pre), cfg); progress(f"CV folds: {folds}")
    base = dict(); specs: dict[str, VariantSpec] = {}
    mask_mode = "labels" if labels_incident is not None else "auto"
    specs["P0_defaults"] = VariantSpec("P0_defaults"); specs["P1_mask"] = VariantSpec("P1_mask", mask=mask_mode); specs["P2_mask_monthly"] = VariantSpec("P2_mask_monthly", mask=mask_mode, monthly=True)
    rows, trials = [], []; hz = cfg["horizons"]
    if folds:
        for n, s in specs.items(): rows.append(_cv_rows(n, pre, folds, lambda tr, te, s=s: fit_forecast(tr, te.index, s, cfg, holidays, te)[:3], hz)); progress(f"{n} done")
        for g in itertools.product(*cfg["grid"].values()):
            p = dict(zip(cfg["grid"], g), changepoint_range=cfg["changepoint_range"]); s = VariantSpec("P3_tuned", mask=mask_mode, monthly=True, params=p)
            r = _cv_rows("P3_tuned", pre, folds, lambda tr, te, s=s: fit_forecast(tr, te.index, s, cfg, holidays, te)[:3], hz); trials.append(dict(p, mean_MAPE_select=r[r.h == cfg["select_h"]].MAPE.mean()))
        tdf = pd.DataFrame(trials).sort_values("mean_MAPE_select"); best_params = {k: (float(tdf.iloc[0][k]) if k != "seasonality_mode" else tdf.iloc[0][k]) for k in cfg["grid"]}; best_params["changepoint_range"] = cfg["changepoint_range"]
    else:
        tdf = pd.DataFrame(); best_params = dict(changepoint_prior_scale=0.05, seasonality_prior_scale=10.0, seasonality_mode="additive", changepoint_range=0.8)
    specs["P3_tuned"] = VariantSpec("P3_tuned", mask=mask_mode, monthly=True, params=best_params)
    if regs:
        specs["P4_oracle_regs"] = VariantSpec("P4_oracle_regs", mask=mask_mode, monthly=True, params=best_params, regs=regs, reg_mode="oracle", deployable=False)
        specs["P5_forecast_regs"] = VariantSpec("P5_forecast_regs", mask=mask_mode, monthly=True, params=best_params, regs=regs, reg_mode="forecast")
    if folds:
        for n in [k for k in specs if k in ("P3_tuned", "P4_oracle_regs", "P5_forecast_regs")]:
            s = specs[n]; rows.append(_cv_rows(n, pre, folds, lambda tr, te, s=s: fit_forecast(tr, te.index, s, cfg, holidays, te)[:3], hz)); progress(f"{n} done")
        svc_cols = None
        if service_df is not None:
            W = service_df.pivot_table(index="ds", columns="service", values="y", aggfunc="sum").reindex(D.index); svc_cols = list(W.columns)
            def p6(tr, te):
                tot = np.zeros(len(te)); lo = np.zeros(len(te)); hi = np.zeros(len(te)); msk = ~outlier_mask(tr["y"].interpolate(), z=cfg["outlier_z"])
                for c in svc_cols:
                    d = pd.DataFrame({"ds": tr.index, "y": W.loc[tr.index, c].where(msk).values}).dropna(); m = make_prophet(best_params, (), True, len(d), holidays, cfg["monthly_fourier"]); m.fit(d)
                    f = m.predict(pd.DataFrame({"ds": te.index})); tot += f.yhat.values; lo += f.yhat_lower.values; hi += f.yhat_upper.values
                return tot, lo, hi
            rows.append(_cv_rows("P6_per_service", pre, folds, p6, hz)); progress("P6_per_service done")
        for b in ("B_snaive7", "B_snaive28", "B_drift", "B_sarima"):
            try: rows.append(_cv_rows(b, pre, folds, lambda tr, te, b=b: (baseline_predict(b, tr, len(te)), None, None), hz))
            except Exception as e: log.warning("baseline %s skipped: %s", b, e)
    cv_all = pd.concat(rows, ignore_index=True) if rows else pd.DataFrame(); cols = [c for c in ["MAPE", "sMAPE", "RMSE", "MAE", "bias", "R2", "coverage80", "interval_width"] if c in cv_all.columns]
    summary = cv_all.groupby(["variant", "h"])[cols].mean().round(4).reset_index() if len(cv_all) else pd.DataFrame()
    deployable = [n for n, s in specs.items() if s.deployable] + (["P6_per_service"] if (len(summary) and "P6_per_service" in summary.variant.values) else [])
    if len(summary):
        sel = summary[summary.h == cfg["select_h"]].set_index("variant").MAPE; best = min([d for d in deployable if d in sel.index], key=lambda v: sel[v])
        bb = min([v for v in sel.index if v.startswith("B_")], key=lambda v: sel[v]) if any(v.startswith("B_") for v in sel.index) else ""
    else: best, bb = "P3_tuned", ""
    progress(f"selected deployable variant: {best}")
    # ---- hold-out: evaluated ONCE with the selected variant
    ho, ho_frame = None, None
    if len(hold):
        if best == "P6_per_service": P, LO, HI = p6(pre, hold)
        else: P, LO, HI, _ = fit_forecast(pre, hold.index, specs[best], cfg, holidays, hold)
        ok = ~hold.was_missing.values; ho = {}
        for h in hz:
            mk = ok.copy(); mk[h:] = False; ho[f"h{h}"] = regression_metrics(hold.y.values[mk], P[mk], LO[mk], HI[mk])
        for h in hz: ho[f"snaive7_h{h}"] = regression_metrics(hold.y.values[ok][:h], baseline_predict("B_snaive7", pre, len(hold))[ok][:h])
        if regs:
            Po, *_ = fit_forecast(pre, hold.index, specs["P4_oracle_regs"], cfg, holidays, hold); ho["oracle_regs_h90_NOT_DEPLOYABLE"] = regression_metrics(hold.y.values[ok], Po[ok])
        ho_frame = pd.DataFrame({"yhat": P, "yhat_lower": LO, "yhat_upper": HI, "y": hold.y.values}, index=hold.index)
    meta = dict(variant=best, params=best_params, regressors=specs[best].regs if best != "P6_per_service" else [], mask=specs[best].mask if best != "P6_per_service" else "auto", monthly=True,
                cost_basis=D.attrs.get("cost_basis"), missing_dates=D.attrs.get("missing_dates"), train_range=[str(D.index[0].date()), str(D.index[-1].date())], holdout_start=str(hold.index[0].date()) if len(hold) else None,
                cfg={k: v for k, v in cfg.items()}, holdout_metrics=ho, versions=dict(python=platform.python_version(), pandas=pd.__version__, numpy=np.__version__))
    res = ForecastResult(summary, cv_all, tdf, best, best_params, ho, ho_frame, bb, folds, meta)
    if out_dir is not None:
        res.bundle_dir = save_bundle(D, specs.get(best), best, best_params, regs, holidays, service_df, cfg, meta, Path(out_dir))
    return res

def save_bundle(D, spec, best, params, regs, holidays, service_df, cfg, meta, out_dir: Path) -> Path:
    """Production refit on ALL data (hold-out included) and persist."""
    from prophet import Prophet
    from prophet.serialize import model_to_json
    regs = list(spec.regs) if (spec is not None and best != "P6_per_service") else []      # the bundle must use exactly the selected variant's regressors
    out_dir.mkdir(parents=True, exist_ok=True); (out_dir / "reg_models").mkdir(exist_ok=True); n = len(D)
    if best == "P6_per_service":
        (out_dir / "svc_models").mkdir(exist_ok=True); W = service_df.pivot_table(index="ds", columns="service", values="y", aggfunc="sum").reindex(D.index); msk = ~outlier_mask(D["y"].interpolate(), z=cfg["outlier_z"])
        for c in W.columns:
            d = pd.DataFrame({"ds": D.index, "y": W[c].where(msk).values}).dropna(); m = make_prophet(params, (), True, len(d), holidays, cfg["monthly_fourier"]); m.fit(d); open(out_dir / "svc_models" / f"{c}.json", "w").write(model_to_json(m))
    else:
        y = _train_target(D, spec, cfg); tr = pd.DataFrame({"ds": D.index, "y": y.values}); 
        for r in regs: tr[r] = D[r].values
        tr = tr.dropna(subset=["y"]); m = make_prophet(spec.params, regs, spec.monthly, len(tr), holidays, cfg["monthly_fourier"]); m.fit(tr); open(out_dir / "model.json", "w").write(model_to_json(m))
        for r in regs:
            mr = Prophet(weekly_seasonality=n >= 14, yearly_seasonality="auto", daily_seasonality=False, holidays=holidays); mr.fit(D.reset_index()[["ds", r]].rename(columns={r: "y"})); open(out_dir / "reg_models" / f"{r}.json", "w").write(model_to_json(mr))
    meta = dict(meta, refit_on="all data incl. hold-out", note="hold-out metrics come from the pre-hold-out fit")
    jdump(meta, out_dir / "meta.json"); D[["y"]].to_csv(out_dir / "history.csv"); return out_dir

class CostForecaster:
    """Load a saved bundle and forecast. FastAPI-ready: forecast() returns ds, yhat, yhat_lower, yhat_upper."""
    def __init__(self, model_dir):
        from prophet.serialize import model_from_json
        self.dir = Path(model_dir); self.meta = json.load(open(self.dir / "meta.json")); self.hist = pd.read_csv(self.dir / "history.csv", index_col=0, parse_dates=True)
        self.regs = self.meta["regressors"]; self.per_service = self.meta["variant"] == "P6_per_service"
        if self.per_service: self.svc = {p.stem: model_from_json(open(p).read()) for p in (self.dir / "svc_models").glob("*.json")}
        else:
            self.model = model_from_json(open(self.dir / "model.json").read())
            self.regm = {r: model_from_json(open(self.dir / "reg_models" / f"{r}.json").read()) for r in self.regs}
    @classmethod
    def load(cls, model_dir): return cls(model_dir)
    def forecast(self, horizon_days: int, future_regressors: pd.DataFrame | None = None) -> pd.DataFrame:
        if not (1 <= int(horizon_days) <= 366): raise ValueError("horizon_days must be in [1, 366]")
        ds = pd.date_range(pd.Timestamp(self.meta["train_range"][1]) + pd.Timedelta(days=1), periods=int(horizon_days), freq="D"); fut = pd.DataFrame({"ds": ds})
        if self.per_service:
            tot = sum(m.predict(fut)[["yhat", "yhat_lower", "yhat_upper"]].values for m in self.svc.values()); o = pd.DataFrame(tot, columns=["yhat", "yhat_lower", "yhat_upper"]); o.insert(0, "ds", ds); return o
        for r in self.regs:
            if future_regressors is not None:
                if r not in future_regressors or len(future_regressors) < horizon_days: raise ValueError(f"future_regressors must contain '{r}' for {horizon_days} days")
                fut[r] = future_regressors[r].values[:horizon_days]
            else: fut[r] = self.regm[r].predict(fut[["ds"]])["yhat"].values
        return self.model.predict(fut)[["ds", "yhat", "yhat_lower", "yhat_upper"]]
    def budget_overrun(self, monthly_budget: float, as_of) -> dict:
        return budget_overrun(self.hist.y.dropna(), self.forecast(62), monthly_budget, as_of)
    @staticmethod
    def to_json(fc: pd.DataFrame): return json.loads(fc.assign(ds=fc.ds.dt.strftime("%Y-%m-%d")).to_json(orient="records"))
