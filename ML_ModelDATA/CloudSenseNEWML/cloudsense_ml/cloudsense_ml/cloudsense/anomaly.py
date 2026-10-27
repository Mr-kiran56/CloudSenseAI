"""Model C: Isolation Forest anomaly + Denial-of-Wallet (DoW) candidate detection on 5-minute telemetry.
Spec: IsolationForest(n_estimators=200, contamination=0.01, max_samples='auto', random_state=42); CostVelocity=(Cost(t)-Cost(t-D))/D (USD/min, D=5 min);
ProvisioningFrequency = launches in the trailing 30 min / 0.5 h (launches per hour); score is NOT a probability; alerts are 'DoW candidates', never confirmed attacks.
Core input columns: window_start, cost_usd, request_count, instances_launched, cpu_utilization, network_in_bytes, network_out_bytes, storage_used_gb, invocation_count.
Optional extended columns (improve DoW vs flash-crowd separation; need access logs/CloudWatch): see EXT_C. Optional calendar: CAL_C. Labels are OPTIONAL (separate frame)."""
from __future__ import annotations
import itertools, json, logging, platform
from pathlib import Path
import numpy as np, pandas as pd
from .common import SchemaError, require_columns, jdump, set_seed

log = logging.getLogger("cloudsense.anomaly")
CORE_C = ["window_start", "cost_usd", "request_count", "instances_launched", "cpu_utilization", "network_in_bytes", "network_out_bytes", "storage_used_gb", "invocation_count"]
EXT_C = ["unique_ips", "top_ip_share", "geo_entropy_bits", "avg_function_duration_ms", "lambda_concurrency_max", "error_5xx_rate", "p95_latency_ms", "memory_utilization_pct", "instance_count"]
CAL_C = ["cal_promo_intensity", "cal_is_holiday", "cal_scheduled_job"]
IF_SPEC = dict(n_estimators=200, contamination=0.01, max_samples="auto", random_state=42)
SPEC9 = ["cost_velocity", "request_rate", "request_rate_delta", "provisioning_frequency", "cpu_utilization", "network_io", "storage_growth_rate", "spend_vs_baseline", "invocation_rate"]
DEFAULT_CFG = dict(seed=42, train_frac=0.60, val_frac=0.20, fp_per_day_budget=15.0, alert_budget_per_day=12.0, grace_windows=2, max_gap_windows=3, buffer_len=360, n_boot=200,
                   if_grid=dict(n_estimators=[200, 400], max_samples=[256, 1024], max_features=[0.5, 1.0]),
                   triage=dict(ip_low=-3.0, top_ip_high=3.0, inv_req_high=3.0, dur_high=3.0, launch_high=3.0, out_high=3.0, req_flat=2.0, err_high=3.0, cpu_high=3.0, mem_high=3.0, store_high=3.0))
FORBIDDEN = ["context", "label", "is_anomaly", "is_dow", "incident_id", "attack_type", "label_source", "split"]
signed_log = lambda x: np.sign(x) * np.log1p(np.abs(x))
slot_of = lambda ts: ts.dt.hour * 12 + ts.dt.minute // 5

# ----------------------------------------------------------------------------- validation / state
def validate_c(df: pd.DataFrame):
    require_columns(df, CORE_C, "Model C telemetry")
    bad = [c for c in FORBIDDEN if c in df.columns]
    if bad: raise SchemaError(f"Model C telemetry must not contain label/annotation columns {bad}; keep labels in a separate frame.")
    d = df.copy(); d["window_start"] = pd.to_datetime(d["window_start"]); d = d.sort_values("window_start").reset_index(drop=True)
    if d.window_start.duplicated().any(): raise SchemaError("duplicate window_start timestamps")
    step = d.window_start.diff().dropna().unique()
    if len(step) != 1 or step[0] != pd.Timedelta(minutes=5): raise SchemaError(f"telemetry must be a regular 5-minute grid; found steps {list(step)[:5]}. Re-sample/forward-fill gaps first.")
    num = d.drop(columns="window_start").select_dtypes("number"); dq = dict(rows=len(d), start=str(d.window_start.min()), end=str(d.window_start.max()), negatives=int((num.drop(columns=[c for c in num if c in ("storage_used_gb",)], errors="ignore") < 0).sum().sum()),
        nan_by_col={k: int(v) for k, v in d.isna().sum().items() if v}, optional_present=[c for c in EXT_C + CAL_C if c in d.columns])
    if dq["negatives"]: raise SchemaError(f"negative counters found: {dq}")
    return d, dq

def fit_state(train: pd.DataFrame) -> dict:
    sl = slot_of(train.window_start); dt = (train.window_start.dt.dayofweek >= 5).astype(int)
    return dict(cpu_slot_med=train.groupby(sl).cpu_utilization.median().to_dict(), cpu_global=float(train.cpu_utilization.median()),
                cost_base={(int(a), int(b)): float(v) for (a, b), v in train.groupby([sl, dt]).cost_usd.median().items()}, cost_global=float(train.cost_usd.median()),
                ext=[c for c in EXT_C if c in train.columns], cal=[c for c in CAL_C if c in train.columns], use_invocation=bool(train.invocation_count.std() > 0))

def _base(df, S):
    x = df.copy(); sl = slot_of(x.window_start); dtp = (x.window_start.dt.dayofweek >= 5).astype(int)
    x["cpu_utilization"] = x.cpu_utilization.ffill(limit=3); x["cpu_utilization"] = x.cpu_utilization.fillna(sl.map(S["cpu_slot_med"])).fillna(S["cpu_global"])     # causal imputation
    for c in ("memory_utilization_pct", "p95_latency_ms"):
        if c in x: x[c] = x[c].ffill(limit=3).fillna(x[c].median() if x[c].notna().any() else 0)
    F = pd.DataFrame(index=x.index)
    F["cost_velocity"] = x.cost_usd.diff().fillna(0) / 5                                         # USD per minute, D = 5 min
    F["cost_velocity_1h"] = x.cost_usd.diff(12).fillna(0) / 60                                    # D = 1 hour
    F["request_rate"] = x.request_count / 300; F["request_rate_delta"] = F.request_rate.diff().fillna(0)
    F["request_rate_pct_1h"] = x.request_count.pct_change(12).replace([np.inf, -np.inf], np.nan).fillna(0).clip(-5, 5)
    F["provisioning_frequency"] = x.instances_launched.rolling(6, min_periods=1).sum() / 0.5       # launches per hour, trailing 30 min
    F["provisioning_frequency_2h"] = x.instances_launched.rolling(24, min_periods=1).sum() / 2.0
    F["cpu_utilization"] = x.cpu_utilization; F["network_io"] = (x.network_in_bytes + x.network_out_bytes) / 1e6      # MB per window
    F["storage_growth_rate"] = x.storage_used_gb.diff().fillna(0).clip(lower=0)                    # GB per window, drops (rotation/deletes) clipped
    base = pd.Series([S["cost_base"].get((int(a), int(b)), S["cost_global"]) for a, b in zip(sl, dtp)], index=x.index); F["spend_vs_baseline"] = x.cost_usd / base
    F["invocation_rate"] = x.invocation_count / 300
    rq = x.request_count.clip(lower=1); F["out_per_request"] = x.network_out_bytes / 1e6 / rq; F["cost_per_request"] = x.cost_usd / rq; F["cpu_per_request"] = x.cpu_utilization / F.request_rate.clip(lower=1)
    F["invocation_per_request"] = x.invocation_count / rq
    if "unique_ips" in x: F["ip_ratio"] = x.unique_ips / rq
    for c, n in [("top_ip_share", "top_ip_share"), ("geo_entropy_bits", "geo_entropy_bits"), ("avg_function_duration_ms", "avg_function_duration_ms"), ("lambda_concurrency_max", "lambda_concurrency_max"),
                 ("error_5xx_rate", "error_5xx_rate"), ("p95_latency_ms", "p95_latency_ms"), ("memory_utilization_pct", "memory_utilization_pct")]:
        if c in x: F[n] = x[c]
    if "instance_count" in x: F["instance_count"] = x.instance_count; F["instance_count_delta"] = x.instance_count.diff().fillna(0)
    F["instances_launched"] = x.instances_launched
    return x, F

def fit_seasonal(train_F: pd.DataFrame, train_ts: pd.Series) -> dict:
    sl = slot_of(train_ts); S1 = dict(slot_med={}, mad={})
    for f in train_F.columns:
        v = signed_log(train_F[f]); med = v.groupby(sl).median(); S1["slot_med"][f] = {int(k): float(x) for k, x in med.items()}; S1["mad"][f] = float((v - sl.map(med)).abs().median() * 1.4826 + 1e-6)
    return S1

KEY_ROLL = ["request_rate", "invocation_per_request", "ip_ratio", "top_ip_share", "cpu_utilization", "error_5xx_rate", "cost_velocity", "provisioning_frequency", "network_io", "storage_growth_rate", "spend_vs_baseline"]
def build_features(df: pd.DataFrame, state: dict, S1: dict) -> pd.DataFrame:
    """Causal features (current + past windows only): raw, base engineered, seasonal residuals (train-only slot medians), rolling context, calendar."""
    x, F = _base(df, state); sl = slot_of(x.window_start)
    R = pd.DataFrame({"r_" + f: (signed_log(F[f]) - sl.map(S1["slot_med"][f])) / S1["mad"][f] for f in F.columns if f in S1["mad"]}, index=x.index)
    out = pd.concat([F.add_prefix("b_"), R], axis=1)
    for f in [k for k in KEY_ROLL if "r_" + k in R]:
        r = R["r_" + f]; out["m1h_" + f] = r.rolling(12, min_periods=1).mean(); mu, sd = r.rolling(288, min_periods=24).mean(), r.rolling(288, min_periods=24).std(); out["z24_" + f] = ((r - mu) / (sd + 1e-6)).fillna(0)
    for c in state["cal"]: out[c] = x[c].values
    out["hour_sin"] = np.sin(2 * np.pi * x.window_start.dt.hour / 24).values; out["hour_cos"] = np.cos(2 * np.pi * x.window_start.dt.hour / 24).values; out["dow"] = x.window_start.dt.dayofweek.values
    return out

def feature_sets(state: dict, cols) -> dict:
    cols = set(cols); has = lambda l: [c for c in l if c in cols]
    spec9 = [f for f in SPEC9 if f != "invocation_rate" or state["use_invocation"]]; cal = state["cal"] + ["hour_sin", "hour_cos", "dow"]
    roll = lambda base: [p + b for b in base for p in ("m1h_", "z24_") if p + b in cols]
    core_extra = ["cost_velocity_1h", "provisioning_frequency_2h", "request_rate_pct_1h", "out_per_request", "cost_per_request", "cpu_per_request", "invocation_per_request", "instances_launched"]
    ext = ["ip_ratio", "top_ip_share", "geo_entropy_bits", "avg_function_duration_ms", "lambda_concurrency_max", "error_5xx_rate", "p95_latency_ms", "memory_utilization_pct", "instance_count", "instance_count_delta"]
    fs = {"IF_spec_raw": has(["b_" + f for f in spec9]), "IF_spec_resid": has(["r_" + f for f in spec9]) + roll(spec9) + has(cal),
          "IF_core_resid": has(["r_" + f for f in spec9 + core_extra]) + roll(spec9 + core_extra) + has(cal)}
    allr = has(["r_" + f for f in spec9 + core_extra + ext if "r_" + f in cols]); fs["_resid_all"] = allr
    if state["ext"]:
        G = {"cost_provisioning": ["cost_velocity", "cost_velocity_1h", "provisioning_frequency", "provisioning_frequency_2h", "spend_vs_baseline", "cost_per_request", "instance_count", "instance_count_delta", "instances_launched"],
             "traffic_ip": ["request_rate", "request_rate_delta", "request_rate_pct_1h", "ip_ratio", "top_ip_share", "geo_entropy_bits", "out_per_request"],
             "serverless": ["invocation_rate", "invocation_per_request", "avg_function_duration_ms", "lambda_concurrency_max"],
             "performance_fleet": ["error_5xx_rate", "p95_latency_ms", "cpu_utilization", "memory_utilization_pct", "cpu_per_request"], "storage_network": ["storage_growth_rate", "network_io"]}
        fs["_groups"] = {g: has(["r_" + f for f in fl]) + roll([f for f in fl]) + has(cal) for g, fl in G.items() if has(["r_" + f for f in fl])}
    return fs

# ----------------------------------------------------------------------------- detectors / thresholds
def _if(X, seed=42, **kw):
    from sklearn.ensemble import IsolationForest
    p = dict(IF_SPEC); p["random_state"] = seed; p.update(kw); return IsolationForest(**p).fit(X)
def choose_threshold_labelled(score, y, normal, n_days, budget):
    """Max F1 on VALIDATION subject to <= budget false-alert windows per day."""
    qs = np.unique(np.quantile(score, np.linspace(0.5, 0.9995, 500))); best = (-1, None)
    for t in qs:
        pr = score > t; tp = (pr & (y == 1)).sum(); fp = (pr & normal).sum()
        if fp / n_days > budget: continue
        f1 = 2 * tp / max(2 * tp + fp + ((y == 1) & ~pr).sum(), 1)
        if f1 > best[0]: best = (f1, t)
    return float(best[1] if best[1] is not None else qs[-1])
def choose_threshold_budget(score, n_days, alerts_per_day):
    """Unlabelled mode: pick the score threshold so a held-out (assumed mostly normal) period raises <= alerts_per_day alert windows per day."""
    return float(np.quantile(score, 1 - min(0.5, alerts_per_day * n_days / len(score))))
def group_alerts(alert: np.ndarray, max_gap: int):
    pos = np.where(alert)[0]
    if len(pos) == 0: return []
    out = []; s = p = pos[0]
    for q in pos[1:]:
        if q - p - 1 > max_gap: out.append((s, p)); s = q
        p = q
    out.append((s, p)); return out
def triage(F_seg: pd.DataFrame, promo: float = 0.0, T=None):
    """Transparent rules on mean seasonal-residual robust-z over an incident. Returns (class, reasons). Missing features count as 0. Never says 'confirmed attack'."""
    T = T or DEFAULT_CFG["triage"]; m = F_seg[[c for c in F_seg.columns if c.startswith("r_")]].mean(); g = lambda k: float(m.get("r_" + k, 0.0)); why = []
    ip_low = g("ip_ratio") < T["ip_low"]; top_hi = g("top_ip_share") > T["top_ip_high"]; inv_hi = g("invocation_per_request") > T["inv_req_high"] or g("avg_function_duration_ms") > T["dur_high"]
    prov = g("provisioning_frequency") > T["launch_high"] and g("network_io") > T["out_high"] and abs(g("request_rate")) < T["req_flat"]; egress = g("out_per_request") > T["out_high"] and (ip_low or top_hi)
    up = g("request_rate") > T["req_flat"]
    if (ip_low or top_hi) and (up or inv_hi or egress): why.append("low IP diversity / concentrated sources with traffic or invocation surge")
    if prov: why.append("provisioning burst + network surge with flat request volume (possible credential abuse / mining)")
    if inv_hi and (ip_low or top_hi): why.append("invocation/duration surge from few sources")
    if why: return "dow_candidate", why
    if up and promo > 0 and not ip_low: return "likely_legitimate_traffic", ["surge with normal IP diversity during a promotion"]
    if g("error_5xx_rate") > T["err_high"] or g("cpu_utilization") > T["cpu_high"] or g("memory_utilization_pct") > T["mem_high"] or g("storage_growth_rate") > T["store_high"] or g("instances_launched") > T["launch_high"] or g("instance_count") > T["cpu_high"]:
        return "operational", ["errors/latency/CPU/memory/storage/fleet deviation with normal traffic quality"]
    return "needs_review", ["no rule matched"]
def top_features_z(row: pd.Series, k=4):
    r = row[[c for c in row.index if c.startswith("r_")]]; return [dict(feature=f[2:], robust_z=float(r[f])) for f in r.abs().sort_values(ascending=False).head(k).index]
def explain_alert(row: pd.Series, k=4) -> dict:
    tf = top_features_z(row, k); return dict(top_features=tf, sentence="Alert driven by " + "; ".join(f"{d['feature']} {d['robust_z']:+.1f} robust-z vs its time-of-day norm" for d in tf) + ". (Isolation-Forest score is not a probability.)")

# ----------------------------------------------------------------------------- training
def _norm_stats(s_train): return float(np.median(s_train)), float(np.subtract(*np.percentile(s_train, [75, 25])) + 1e-9)

def train_anomaly(telemetry: pd.DataFrame, labels: pd.DataFrame | None = None, cfg: dict | None = None, out_dir=None, progress=print) -> dict:
    """Train detectors on the TRAIN split only (unsupervised). With labels: tune/choose on VAL, evaluate on TEST once. Without labels: threshold from an alert budget on the calibration split."""
    from sklearn.metrics import average_precision_score, roc_auc_score
    from sklearn.preprocessing import RobustScaler
    from sklearn.svm import OneClassSVM
    from sklearn.neighbors import LocalOutlierFactor
    cfg = {**DEFAULT_CFG, **(cfg or {})}; set_seed(cfg["seed"]); raw, dq = validate_c(telemetry); n = len(raw); days = raw.window_start.dt.floor("D").nunique()
    i_tr = int(n * cfg["train_frac"]); i_va = int(n * (cfg["train_frac"] + cfg["val_frac"])); split = np.array(["train"] * i_tr + ["val"] * (i_va - i_tr) + ["test"] * (n - i_va)); sp = {s: split == s for s in ("train", "val", "test")}
    if i_tr < 288 * 14: log.warning("less than 14 days of training windows: seasonal statistics will be weak")
    S0 = fit_state(raw[sp["train"]]); x_all, F_all = _base(raw, S0); S1 = fit_seasonal(F_all[sp["train"]], raw.window_start[sp["train"]]); FE = build_features(raw, S0, S1)
    FS = feature_sets(S0, FE.columns); labelled = labels is not None
    if labelled:
        L = labels.copy(); L["window_start"] = pd.to_datetime(L["window_start"]); L = L.set_index("window_start").reindex(raw.window_start); Y = L.is_anomaly.fillna(0).astype(int).values; YD = L.is_dow.fillna(0).astype(int).values; LAB = L.label.fillna("normal").values
        CTX = L.context.fillna("none").values if "context" in L else np.array(["none"] * n); INC = L.incident_id.fillna("").values if "incident_id" in L else np.array([""] * n)
    SC, MODELS, ND = {}, {}, {s: max(1, raw[sp[s]].window_start.dt.floor("D").nunique()) for s in sp}; trm = sp["train"]
    for name in ("IF_spec_raw", "IF_spec_resid", "IF_core_resid"):
        MODELS[name] = _if(FE.loc[trm, FS[name]]); SC[name] = -MODELS[name].score_samples(FE[FS[name]])
    GM, GSTAT = {}, {}
    if "_groups" in FS:
        gs = {}
        for g, cols in FS["_groups"].items():
            GM[g] = _if(FE.loc[trm, cols]); s = -GM[g].score_samples(FE[cols]); GSTAT[g] = _norm_stats(s[trm]); gs[g] = (s - GSTAT[g][0]) / GSTAT[g][1]
        SC["IF_ext_group"] = pd.DataFrame(gs).max(axis=1).values
    ZC = FS["_resid_all"]; SC["BL_zscore_rule"] = FE[ZC].abs().max(axis=1).clip(upper=1e3).values
    main_if = "IF_ext_group" if "IF_ext_group" in SC else "IF_core_resid"
    zst, ist = _norm_stats(SC["BL_zscore_rule"][trm]), _norm_stats(SC[main_if][trm]); SC["HYBRID_IF_zrule"] = np.maximum((SC[main_if] - ist[0]) / ist[1], (SC["BL_zscore_rule"] - zst[0]) / zst[1])
    rs = np.random.default_rng(42); XS_cols = FS["IF_core_resid"]; sc = RobustScaler().fit(FE.loc[trm, XS_cols]); XS = np.clip(sc.transform(FE[XS_cols]), -20, 20); tri = np.where(trm)[0]
    oc = OneClassSVM(nu=0.01, gamma="scale").fit(XS[rs.choice(tri, min(5000, len(tri)), replace=False)]); SC["BL_OneClassSVM"] = -oc.decision_function(XS)
    lof = LocalOutlierFactor(n_neighbors=35, novelty=True).fit(XS[rs.choice(tri, min(8000, len(tri)), replace=False)]); SC["BL_LOF"] = -lof.score_samples(XS)
    THR, EV, INC_EV, summ = {}, None, None, None; deployable = [k for k in SC if not k.startswith("BL_")]
    if labelled:
        for k in SC: THR[k] = choose_threshold_labelled(SC[k][sp["val"]], Y[sp["val"]], LAB[sp["val"]] == "normal", ND["val"], cfg["fp_per_day_budget"])
        rows = []
        def tmask(split, task):
            m = sp[split].copy()
            if task == "b_DoW_vs_normal": m &= np.isin(LAB, ["normal", "dow_candidate", "dow_confirmed"])
            if task == "c_confirmed_replay_vs_normal": m &= np.isin(LAB, ["normal", "dow_confirmed"])
            return m
        ty = {"a_any_anomaly": Y, "b_DoW_vs_normal": YD, "c_confirmed_replay_vs_normal": (LAB == "dow_confirmed").astype(int)}
        for k, s in SC.items():
            for split_ in ("val", "test"):
                for task in ty:
                    m = tmask(split_, task); yy = ty[task][m]
                    if yy.sum() == 0 or yy.sum() == len(yy): continue
                    pr = s[m] > THR[k]; tp = (pr & (yy == 1)).sum(); fp = (pr & (yy == 0)).sum(); fn = (~pr & (yy == 1)).sum(); P = tp / max(tp + fp, 1); R = tp / max(tp + fn, 1)
                    rows.append(dict(model=k, split=split_, task=task, precision=P, recall=R, F1=2 * P * R / max(P + R, 1e-9), AUPRC=average_precision_score(yy, s[m]), prevalence=yy.mean(), AUROC=roc_auc_score(yy, s[m])))
        EV = pd.DataFrame(rows); val_auprc = EV[(EV.split == "val") & (EV.task == "a_any_anomaly")].set_index("model").AUPRC
        BEST = max(deployable, key=lambda k: val_auprc.get(k, -1)); progress(f"deployable detector chosen on VAL AUPRC: {BEST}")
        irows = []
        for pid in [p for p in np.unique(INC) if p]:
            pos = np.where(INC == pid)[0]; split_ = split[pos[0]]
            if split_ != "test": continue
            for k in SC:
                rng_ = np.arange(pos[0], min(pos[-1] + 1 + cfg["grace_windows"], n)); hit = np.where(SC[k][rng_] > THR[k])[0]
                irows.append(dict(model=k, incident_id=pid, label=LAB[pos[0]], type=L.attack_type.iloc[pos[0]], n_windows=len(pos), detected=len(hit) > 0, delay_min=hit[0] * 5 if len(hit) else np.nan))
        INC_EV = pd.DataFrame(irows)
        if len(INC_EV):
            summ = INC_EV.groupby("model").agg(incident_recall=("detected", "mean"), median_delay_min=("delay_min", "median")); summ["false_alert_windows_per_day"] = [((SC[k] > THR[k]) & sp["test"] & (LAB == "normal")).sum() / ND["test"] for k in summ.index]
    else:
        BEST = "IF_spec_resid"; cal = sp["val"]
        for k in SC: THR[k] = choose_threshold_budget(SC[k][cal], ND["val"], cfg["alert_budget_per_day"])
        progress(f"UNLABELLED mode: deployed {BEST} (spec-primary Isolation Forest, de-seasonalised); threshold = alert budget {cfg['alert_budget_per_day']}/day on the calibration split")
    if BEST == "IF_ext_group": kind, models, cols = "group", GM, FS["_groups"]
    elif BEST == "HYBRID_IF_zrule":
        kind = "hybrid"; models = dict(main=GM if main_if == "IF_ext_group" else MODELS["IF_core_resid"]); cols = dict(main=FS["_groups"] if main_if == "IF_ext_group" else FS["IF_core_resid"], zcols=ZC)
    else: kind, models, cols = "single", MODELS[BEST], FS[BEST]
    bundle = dict(kind=kind, name=BEST, models=models, columns=cols, group_stats=GSTAT, main_kind=("group" if main_if == "IF_ext_group" else "single"), hybrid_stats=dict(z=zst, i=ist), threshold=THR[BEST], state=S0, S1=S1,
                  required_cols=CORE_C + S0["ext"] + S0["cal"], buffer_len=cfg["buffer_len"], mode="labelled" if labelled else "unlabelled", cfg=cfg, if_params=IF_SPEC,
                  versions=dict(python=platform.python_version(), pandas=pd.__version__, numpy=np.__version__), note="score is NOT a probability; alerts are DoW candidates, never confirmed attacks")
    out = dict(scores=SC, thresholds=THR, best=BEST, eval=EV, incident_eval=INC_EV, incident_summary=summ, feature_sets=FS, FE=FE, split=split, bundle=bundle, raw=raw, dq=dq, labelled=labelled, n_days=ND, models=MODELS, group_models=GM, ZC=ZC)
    if labelled: out.update(Y=Y, YD=YD, LAB=LAB, CTX=CTX, INC=INC, L=L)
    if out_dir is not None:
        import joblib; d = Path(out_dir); d.mkdir(parents=True, exist_ok=True); joblib.dump(bundle, d / "bundle.joblib")
        jdump({k: bundle[k] for k in ("name", "kind", "threshold", "mode", "if_params", "versions", "note")}, d / "meta.json"); out["bundle_dir"] = d
    return out

# ----------------------------------------------------------------------------- real-time scorer
class StreamScorer:
    """update(window: dict) -> {window_start, score, is_alert, severity, top_features, incident_id, triage}. Keeps a rolling buffer so features equal the batch pipeline.
    Feed windows in time order on the 5-minute grid. score_frame(df) scores a historical frame the same way (no buffer limits)."""
    def __init__(self, bundle_dir):
        import joblib
        self.b = joblib.load(Path(bundle_dir) / "bundle.joblib"); self.buf: list = []; self.n_inc = 0; self.open_inc = None; self.gap = 0
    @classmethod
    def load(cls, bundle_dir): return cls(bundle_dir)
    def _score_matrix(self, F: pd.DataFrame) -> np.ndarray:
        """Vectorised scores (higher = more anomalous; NOT a probability) for every row of F."""
        b = self.b
        def single(m, cols): return -m.score_samples(F[cols])
        def group(models, cols): return np.max([(single(m, cols[g]) - b["group_stats"][g][0]) / b["group_stats"][g][1] for g, m in models.items()], axis=0)
        if b["kind"] == "single": return single(b["models"], b["columns"])
        if b["kind"] == "group": return group(b["models"], b["columns"])
        main = group(b["models"]["main"], b["columns"]["main"]) if b["main_kind"] == "group" else single(b["models"]["main"], b["columns"]["main"])
        z = F[b["columns"]["zcols"]].abs().max(axis=1).clip(upper=1e3).values; zs, is_ = b["hybrid_stats"]["z"], b["hybrid_stats"]["i"]
        return np.maximum((main - is_[0]) / is_[1], (z - zs[0]) / zs[1])
    def update(self, window: dict) -> dict:
        miss = [k for k in self.b["required_cols"] if k not in window]
        if miss: raise ValueError(f"missing keys: {miss}")
        self.buf.append({k: window[k] for k in self.b["required_cols"]}); self.buf = self.buf[-self.b["buffer_len"]:]
        df = pd.DataFrame(self.buf); df["window_start"] = pd.to_datetime(df["window_start"]); F = build_features(df, self.b["state"], self.b["S1"]); s = float(self._score_matrix(F.iloc[[-1]])[0]); alert = s > self.b["threshold"]
        res = dict(window_start=str(df.window_start.iloc[-1]), score=s, is_alert=bool(alert), severity="none", top_features=[], incident_id=None, triage=None)
        if alert:
            self.gap = 0
            if self.open_inc is None: self.n_inc += 1; self.open_inc = dict(id=f"LIVE{self.n_inc:04d}", start=len(df) - 1)
            cls, why = triage(F.iloc[self.open_inc["start"]:], float(F["cal_promo_intensity"].iloc[-1]) if "cal_promo_intensity" in F else 0.0, self.b["cfg"]["triage"])
            res.update(top_features=top_features_z(F.iloc[-1]), incident_id=self.open_inc["id"], triage=dict(cls=cls, reasons=why), severity="high" if cls == "dow_candidate" else "medium")
        else:
            self.gap += 1
            if self.open_inc is not None and self.gap > self.b["cfg"]["max_gap_windows"]: self.open_inc = None
        return res
    def score_frame(self, df: pd.DataFrame) -> pd.DataFrame:
        """Score a historical telemetry frame (same features as streaming). Returns window_start, score, is_alert."""
        raw, _ = validate_c(df[[c for c in self.b["required_cols"]]]); F = build_features(raw, self.b["state"], self.b["S1"]); sc = self._score_matrix(F)
        return pd.DataFrame({"window_start": raw.window_start.values, "score": sc, "is_alert": sc > self.b["threshold"]})
