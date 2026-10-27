#!/usr/bin/env python3
"""
CloudSense AI - reproducible dataset generator
==============================================
Builds three model-specific datasets that share ONE consistent business scenario:

  A  -> Prophet          : daily AWS-style cost (CUR 2.0-like) + regressors
  B  -> XGBoost          : daily x microservice unit-economics table
  C  -> Isolation Forest : 5-minute infrastructure telemetry with labelled
                           operational anomalies and Denial-of-Wallet (DoW) windows

Real inputs used (if paths are given):
  * Google Borg trace CSV(zip)  -> C: per-window variability / provisioning-noise
                                      calibration + a real reference table
  * newfiledow.csv (real bot attack on a serverless function)
                                    -> C: replayed as `dow_confirmed` windows
Everything else is synthetic, seeded (SEED=42) and documented in DATA_DICTIONARY.md.
Prices are ILLUSTRATIVE approximations of AWS ap-south-1 list prices - verify before
quoting them in the paper.

Usage:
  python generate_datasets.py --borg borg_traces_data_csv.zip --dow newfiledow.csv --out data
"""
import argparse, json, os, re
import numpy as np
import pandas as pd

SEED = 42
rng = np.random.default_rng(SEED)

# ----------------------------------------------------------------------------
# 0. CALENDAR (approximate Indian e-commerce calendar)
# ----------------------------------------------------------------------------
PROMOS = [  # (start, end, intensity, name)
    ("2024-01-24", "2024-01-26", .15, "republic_day_sale"), ("2024-03-22", "2024-03-25", .12, "spring_sale"),
    ("2024-06-20", "2024-06-23", .18, "summer_sale"), ("2024-08-10", "2024-08-15", .20, "independence_sale"),
    ("2024-10-06", "2024-10-15", .45, "festive_big_sale"), ("2024-11-27", "2024-11-30", .30, "black_friday"),
    ("2024-12-24", "2024-12-31", .12, "year_end_sale"),
    ("2025-01-24", "2025-01-26", .15, "republic_day_sale"), ("2025-03-14", "2025-03-17", .12, "spring_sale"),
    ("2025-06-19", "2025-06-22", .20, "summer_sale"), ("2025-08-09", "2025-08-15", .22, "independence_sale"),
    ("2025-09-22", "2025-10-02", .50, "festive_big_sale"), ("2025-11-26", "2025-11-29", .32, "black_friday"),
    ("2025-12-23", "2025-12-31", .14, "year_end_sale"),
    ("2026-01-23", "2026-01-26", .16, "republic_day_sale"), ("2026-03-04", "2026-03-07", .14, "spring_sale"),
    ("2026-06-18", "2026-06-21", .20, "summer_sale"), ("2026-08-08", "2026-08-15", .24, "independence_sale"),
    ("2026-09-21", "2026-09-30", .55, "festive_big_sale"),
]
HOLIDAYS = [  # approximate dates
    ("2024-01-26", "republic_day"), ("2024-03-25", "holi"), ("2024-08-15", "independence_day"),
    ("2024-10-02", "gandhi_jayanti"), ("2024-11-01", "diwali"), ("2024-12-25", "christmas"),
    ("2025-01-01", "new_year"), ("2025-01-26", "republic_day"), ("2025-03-14", "holi"),
    ("2025-08-15", "independence_day"), ("2025-10-02", "gandhi_jayanti"), ("2025-10-20", "diwali"),
    ("2025-12-25", "christmas"), ("2026-01-01", "new_year"), ("2026-01-26", "republic_day"),
    ("2026-03-04", "holi"), ("2026-08-15", "independence_day"), ("2026-09-18", "ganesh_chaturthi"),
]
T_SP, T_GRAV, T_FEAT, T_CACHE, T_RIGHT, T_RDS = map(pd.Timestamp, [
    "2024-09-01", "2025-04-15", "2025-07-01", "2026-02-10", "2025-10-01", "2025-06-01"])
MISSING_BILLING_DAYS = ["2024-03-09", "2025-01-17", "2025-08-30", "2026-02-02"]  # CUR export gaps


# ----------------------------------------------------------------------------
# 1. BUSINESS SIMULATION (shared by A, B and C)
# ----------------------------------------------------------------------------
def build_business(start="2024-01-01", end="2026-09-30"):
    days = pd.date_range(start, end, freq="D")
    n = len(days); t = np.arange(n)
    doy = days.dayofyear.values; dow = days.dayofweek.values
    promo = np.zeros(n); promo_name = np.array(["none"] * n, dtype=object)
    for s, e, inten, name in PROMOS:
        m = (days >= s) & (days <= e); promo[m] = inten; promo_name[m] = name
    hol = np.isin(days.strftime("%Y-%m-%d"), [h[0] for h in HOLIDAYS]).astype(int)
    trend = 150_000 + 250_000 / (1 + np.exp(-(t - 450) / 260))
    weekly = np.array([.97, .97, .98, 1.0, 1.03, 1.08, 1.06])[dow]
    yearly = 1 + .07 * np.cos(2 * np.pi * (doy - 300) / 365)
    dau = trend * weekly * yearly * (1 + promo) * (1 + .08 * hol) * rng.lognormal(0, .03, n)
    rpu = 36 * (1 + .0004 * t) * np.where(days >= T_FEAT, 1.08, 1.0) * (1 + .35 * promo) * rng.lognormal(0, .02, n)
    api = dau * rpu
    txn = dau * .042 * (1 + .7 * promo) * rng.lognormal(0, .04, n)
    return pd.DataFrame(dict(date=days, dau=dau.round().astype(int), api_requests=api.round().astype(np.int64),
                             transactions=txn.round().astype(int), promo_intensity=promo.round(3),
                             promo_name=promo_name, is_promo=(promo > 0).astype(int), is_holiday=hol))


# ----------------------------------------------------------------------------
# 2. DATASET B  (microservice unit economics)  + building blocks for A
# ----------------------------------------------------------------------------
MS = [  # name, req share, user share, family, $/h, rps cap per instance, min inst, payload KB, EBS GB/inst, region, team, txn share
    dict(name="auth", rs=.17, us=.95, fam="c5.large", price=.090, cap=22., mi=3, kb=4, gb=50, reg="ap-south-1", team="platform", tx=0.0),
    dict(name="catalog", rs=.22, us=.85, fam="m5.large", price=.105, cap=12., mi=4, kb=38, gb=100, reg="ap-south-1", team="storefront", tx=0.0),
    dict(name="search", rs=.16, us=.55, fam="r5.large", price=.160, cap=9., mi=3, kb=22, gb=100, reg="ap-south-1", team="storefront", tx=0.0),
    dict(name="cart_checkout", rs=.09, us=.20, fam="m5.large", price=.105, cap=10., mi=3, kb=12, gb=80, reg="ap-south-1", team="commerce", tx=1.0),
    dict(name="payments", rs=.05, us=.06, fam="c5.xlarge", price=.180, cap=14., mi=3, kb=6, gb=80, reg="ap-south-1", team="commerce", tx=.97),
    dict(name="notifications", rs=.08, us=.70, fam="t3.large", price=.088, cap=20., mi=2, kb=3, gb=40, reg="ap-south-1", team="platform", tx=0.0),
    dict(name="analytics", rs=.12, us=.90, fam="r5.xlarge", price=.320, cap=7., mi=4, kb=9, gb=300, reg="ap-southeast-1", team="data", tx=0.0),
    dict(name="media", rs=.08, us=.60, fam="c6g.xlarge", price=.140, cap=8., mi=3, kb=700, gb=150, reg="ap-south-1", team="storefront", tx=0.0),
]
_rs = sum(m["rs"] for m in MS)
for m in MS: m["rs"] /= _rs


def ms_series(m, days):
    """time-varying instance family / price / capacity / min instances for one microservice"""
    n = len(days); fam = np.array([m["fam"]] * n, dtype=object)
    price = np.full(n, m["price"]); cap = np.full(n, m["cap"]); mi = np.full(n, m["mi"])
    if m["name"] in ("catalog", "cart_checkout"):
        k = days >= T_GRAV; fam[k] = "m6g.large"; price[k] *= .88; cap[k] *= 1.05
    if m["name"] in ("search", "payments"):
        cap[days >= T_FEAT] *= .90          # feature release made requests heavier
    if m["name"] in ("catalog", "search"):
        cap[days >= T_CACHE] *= 1.20        # caching roll-out
    if m["name"] == "analytics":
        k = days >= T_RIGHT; fam[k] = "r5.large"; price[k] *= .5; cap[k] *= .62   # right-sizing
    return fam, price, cap, mi


def build_B_and_costs(biz):
    days = pd.DatetimeIndex(biz.date); n = len(days)
    promo = biz.promo_intensity.values
    sp = np.where(days >= T_SP, .20, 0.0)                         # Savings-Plan discount on compute
    rows = []; comp = {k: np.zeros(n) for k in ["ec2", "ebs", "dt"]}
    # shared costs (allocated to microservices by request share)
    t = np.arange(n)
    rds = np.where(days >= T_RDS, 47.0, 24.0) + (200 + 0.45 * t) * .115 / 30.4 + rng.normal(0, .6, n)
    elb = 1.2 + biz.api_requests.values / 1e6 * 1.4 + rng.normal(0, .08, n)
    cw = 4.0 + biz.api_requests.values * 1.1e3 / 1e9 * .65 * 1.0 + rng.normal(0, .15, n)
    s3 = (12 + .03 * t) * 1024 * .025 / 30.4 + biz.transactions.values * .00005 + rng.normal(0, .25, n)
    lam = biz.api_requests.values * .18 / 1e6 * (.20 + .25 * .5 * 16.6667 * 1e-6 * 1e6 * 1e-1) * 1.0 + rng.normal(0, .08, n)
    lam = np.clip(lam, .5, None)
    # ---- pass 1: request volume and network per microservice, then ACCOUNT-LEVEL tiered data-transfer pricing
    REQ, NET = {}, {}
    for m in MS:
        REQ[m["name"]] = biz.api_requests.values * m["rs"] * rng.lognormal(0, .02, n)
        NET[m["name"]] = REQ[m["name"]] * m["kb"] / 1e6 * rng.lognormal(0, .05, n)
    tot_net = sum(NET.values())
    bounds = np.array([0, 10240, 51200, 1e12]); tprice = np.array([.109, .085, .070])   # GB tiers (illustrative)
    F = lambda x: np.sum(np.clip(x[:, None] - bounds[:-1], 0, np.diff(bounds)) * tprice, axis=1)
    mtd_prev = pd.Series(tot_net).groupby(days.to_period("M")).cumsum().values - tot_net
    dt_total = (F(mtd_prev + tot_net) - F(mtd_prev)) * .9                       # billable fraction 0.9
    # ---- pass 2: per-microservice fleet, utilisation and cost
    for m in MS:
        fam, price, cap, mi = ms_series(m, days)
        req = REQ[m["name"]]; net_gb = NET[m["name"]]
        pf = 2.1 * (1 + .45 * promo) * rng.lognormal(0, .05, n)
        n_peak = np.clip(np.ceil(req * pf / 86400 / (cap * .65)), mi, 400).astype(int)
        n_eff = n_peak.astype(float).copy()                                     # scale-in hysteresis (cool-down)
        for i in range(1, n): n_eff[i] = max(n_peak[i], np.ceil(.65 * n_eff[i - 1]))
        n_avg = mi + (n_eff - mi) * .52 + rng.normal(0, .15, n)
        cpu_bonus = np.zeros(n)
        if m["name"] == "analytics":                                            # Sunday batch + month-end close
            batch = np.asarray((days.dayofweek == 6) | (days.day >= 28))
            n_avg = n_avg + np.where(batch, np.where(days.day >= 28, 4.0, 2.5), 0); cpu_bonus = np.where(batch, 20, 0)
        waste = np.zeros(n)                                                     # orphaned/idle capacity episodes
        for _ in range(int(rng.integers(5, 8))):
            s0 = int(rng.integers(0, n - 15)); L = int(rng.integers(4, 15)); waste[s0:s0 + L] = float(rng.uniform(1, 3))
        n_avg = np.clip(n_avg + waste, mi, None)
        util = req / 86400 / (cap * n_avg) * .62 * rng.lognormal(0, .05, n)
        cpu = np.clip(util * 100 + cpu_bonus, 3, 92)
        cpu_p95 = np.clip(cpu * (1.35 + .25 * util), cpu, 100)
        mem = np.clip((55 if m["name"] == "analytics" else 38) + .35 * cpu + rng.normal(0, 2, n), 10, 95)
        ebs_gb = n_avg * m["gb"] + .5 * t * (m["gb"] / 100)
        launches = np.maximum(0, n_peak - mi) * .8 + rng.poisson(.3, n) + np.where(days.dayofweek == 1, mi, 0)
        c_ec2 = n_avg * 24 * price * (1 - sp) * rng.lognormal(0, .01, n)
        c_ebs = ebs_gb * .10 / 30.4
        c_dt = dt_total * net_gb / tot_net
        alloc = (rds + elb + cw) * m["rs"]
        cost = c_ec2 + c_ebs + c_dt + alloc
        users = biz.dau.values * m["us"] * rng.lognormal(0, .03, n)
        txns = biz.transactions.values * m["tx"] * rng.lognormal(0, .02, n)
        comp["ec2"] += c_ec2; comp["ebs"] += c_ebs; comp["dt"] += c_dt
        cpu_na = rng.random(n) < .004
        df = pd.DataFrame(dict(
            date=days, microservice=m["name"], team_tag=m["team"], env="prod", region=m["reg"], instance_family=fam,
            instance_count_avg=n_avg.round(2), instance_count_max=n_peak, instances_launched=np.round(launches).astype(int),
            active_users=users.round().astype(int), api_requests=req.round().astype(np.int64), transactions=txns.round().astype(int),
            cpu_avg_pct=np.where(cpu_na, np.nan, cpu.round(2)), cpu_p95_pct=np.where(cpu_na, np.nan, cpu_p95.round(2)),
            mem_avg_pct=mem.round(2), network_gb=net_gb.round(3), ebs_provisioned_gb=ebs_gb.round(1),
            cost_usd=cost.round(4), is_promo=biz.is_promo.values, is_holiday=biz.is_holiday.values))
        rows.append(df)
    B = pd.concat(rows).sort_values(["date", "microservice"]).reset_index(drop=True)
    tagged = B.groupby("date").cost_usd.sum().values
    shared = dict(rds=rds, elb=elb, cw=cw, s3=s3, lam=lam)
    return B, comp, shared, tagged


# ----------------------------------------------------------------------------
# 3. DATASET A  (daily cost, CUR-like) with injected cost incidents
# ----------------------------------------------------------------------------
INCIDENTS_A = [  # start, end, type, services -> fraction of that day's clean total
    ("2024-05-14", "2024-05-16", "operational", {"AWSLambda": .30}, "lambda_runaway_loop"),
    ("2024-11-20", "2024-11-22", "operational", {"AmazonEC2": .55}, "forgotten_gpu_cluster"),
    ("2025-02-08", "2025-02-10", "dow_simulated", {"AWSLambda": .35, "AmazonCloudWatch": .05, "AWSDataTransfer": .10}, "serverless_invocation_flood"),
    ("2025-06-25", "2025-06-25", "operational", {"AWSDataTransfer": .60}, "cdn_misconfiguration_egress"),
    ("2025-12-03", "2025-12-07", "dow_simulated", {"AmazonEC2": .90}, "compromised_credentials_mining"),
    ("2026-04-18", "2026-04-19", "dow_simulated", {"AWSDataTransfer": .35, "AmazonEC2": .20, "AWSLambda": .25}, "api_hammering_dow"),
    ("2026-08-02", "2026-08-03", "operational", {"AmazonEBS": .25, "AmazonS3": .20}, "snapshot_duplication"),
]


def build_A(biz, comp, shared, tagged):
    days = pd.DatetimeIndex(biz.date); n = len(days)
    svc = {"AmazonEC2": comp["ec2"], "AmazonEBS": comp["ebs"], "AWSDataTransfer": comp["dt"],
           "AmazonRDS": shared["rds"] * 1.0, "ElasticLoadBalancing": shared["elb"], "AmazonCloudWatch": shared["cw"],
           "AmazonS3": shared["s3"], "AWSLambda": shared["lam"]}
    clean = pd.DataFrame(svc, index=days)
    # AWS Support: 3% of previous month's spend (min $100), charged on the 1st
    support = np.zeros(n); mon = clean.sum(axis=1).groupby(days.to_period("M")).sum()
    for i, d in enumerate(days):
        if d.day == 1 and d.to_period("M") - 1 in mon.index:
            support[i] = max(100.0, .03 * mon[d.to_period("M") - 1])
    clean["AWSSupport"] = support
    total_clean = clean.sum(axis=1)
    obs = clean.copy(); atype = np.array(["none"] * n, dtype=object); aid = np.array([""] * n, dtype=object)
    for k, (s, e, typ, fr, name) in enumerate(INCIDENTS_A):
        m = (days >= s) & (days <= e); L = m.sum(); shape = np.linspace(.7, 1.0, L) if L > 1 else np.array([1.0])
        for sv, f in fr.items():
            obs.loc[m, sv] += total_clean[m].values * f * shape * rng.lognormal(0, .05, L)
        atype[m] = typ; aid[m] = name
    y = obs.sum(axis=1)
    keep = ~days.strftime("%Y-%m-%d").isin(MISSING_BILLING_DAYS)
    tot = pd.DataFrame(dict(ds=days, y=y.round(4).values, y_clean=total_clean.round(4).values, dau=biz.dau.values,
                            api_requests=biz.api_requests.values, transactions=biz.transactions.values,
                            promo_intensity=biz.promo_intensity.values, is_holiday=biz.is_holiday.values,
                            anomaly_type=atype, anomaly_id=aid))[keep].reset_index(drop=True)
    # long CUR-2.0-style service table
    unit = {"AmazonEC2": "Hrs", "AmazonEBS": "GB-Mo", "AWSDataTransfer": "GB", "AmazonRDS": "Hrs", "ElasticLoadBalancing": "LCU-Hrs",
            "AmazonCloudWatch": "GB", "AmazonS3": "GB-Mo", "AWSLambda": "GB-Second", "AWSSupport": "Fee"}
    recs = []
    for sv in obs.columns:
        recs.append(pd.DataFrame(dict(
            line_item_usage_start_date=days, line_item_usage_account_id="123456789012", line_item_product_code=sv,
            product_region_code="ap-south-1", pricing_unit=unit[sv], line_item_net_unblended_cost=obs[sv].round(4).values,
            anomaly_type=atype)))
    svc_long = pd.concat(recs)
    svc_long = svc_long[~svc_long.line_item_usage_start_date.dt.strftime("%Y-%m-%d").isin(MISSING_BILLING_DAYS)]
    svc_long = svc_long.sort_values(["line_item_usage_start_date", "line_item_product_code"]).reset_index(drop=True)
    hol = pd.DataFrame(dict(ds=[h[0] for h in HOLIDAYS], holiday=[h[1] for h in HOLIDAYS], lower_window=-1, upper_window=1))
    prm = []
    for s, e, inten, name in PROMOS:
        prm.append(dict(ds=s, holiday=name, lower_window=0, upper_window=(pd.Timestamp(e) - pd.Timestamp(s)).days))
    hol = pd.concat([hol, pd.DataFrame(prm)]).sort_values("ds").reset_index(drop=True)
    return tot, svc_long, hol, clean


# ----------------------------------------------------------------------------
# 4. REAL-DATA READERS (Borg, DoW) -> calibration parameters
# ----------------------------------------------------------------------------
def borg_reference(path):
    """Aggregate the real Borg trace into 5-minute windows and derive calibration constants."""
    cols = ["start_time", "end_time", "average_usage", "maximum_usage", "event", "cluster"]
    df = pd.read_csv(path, usecols=cols)
    win = (df.start_time // 300_000_000).astype(int)
    full = (df.end_time - df.start_time) == 300_000_000
    num = lambda s, k: pd.to_numeric(s.astype(str).str.extract(rf"'{k}': ([0-9.eE+-]+)")[0], errors="coerce")
    u = df[full].copy(); u["win"] = win[full]
    u["cpu"] = num(u.average_usage, "cpus"); u["mem"] = num(u.average_usage, "memory"); u["cpu_max"] = num(u.maximum_usage, "cpus")
    g = u.groupby("win").agg(cpu_avg_sum=("cpu", "sum"), cpu_max_sum=("cpu_max", "sum"), mem_avg_sum=("mem", "sum"),
                             n_usage_records=("cpu", "size"))
    ev = pd.crosstab(win, df.event).reindex(columns=["SCHEDULE", "FAIL", "EVICT", "FINISH", "KILL", "LOST"], fill_value=0)
    ev.columns = ["n_" + c.lower() for c in ev.columns]
    ref = g.join(ev, how="left").fillna(0).reset_index().rename(columns={"win": "window_index"})
    ref["minute_of_trace"] = (ref.window_index - 1) * 5
    ref["hour_of_day"] = (ref.minute_of_trace // 60) % 24
    ref = ref.round(6)
    lc = np.log(ref.cpu_avg_sum.clip(lower=1e-6)); lc = lc - lc.groupby(ref.hour_of_day).transform("mean")
    sigma = float(lc.std())
    consec = ref.window_index.diff() == 1
    a, b = lc[consec].values, lc.shift(1)[consec].values
    ar1 = float(np.corrcoef(a, b)[0, 1]) if len(a) > 30 else .5
    sch = ref.n_schedule; disp = float(sch.mean() ** 2 / max(sch.var() - sch.mean(), 1e-6)) if sch.var() > sch.mean() else 5.0
    cal = dict(borg_windows=int(len(ref)), log_resid_sigma=round(sigma, 4), ar1=round(ar1, 4), schedule_nb_dispersion=round(disp, 4))
    return ref, cal


def dow_reference(path):
    d = pd.read_csv(path, parse_dates=["timestamp"]).sort_values("timestamp")
    w = d.timestamp.dt.floor("5min")
    g = d.groupby(w).agg(n=("Id", "size"), uniq=("IP", "nunique"),
                         top=("IP", lambda s: s.value_counts().iloc[0] / len(s)), dur=("FunctionDuration", "mean"))
    g = g.reindex(pd.date_range(g.index.min(), g.index.max(), freq="5min")).fillna(0)
    return g


# ----------------------------------------------------------------------------
# 5. DATASET C  (5-minute telemetry + labelled incidents)
# ----------------------------------------------------------------------------
def ar1_noise(N, phi, sigma):
    z = rng.normal(size=N); e = np.zeros(N)
    for i in range(1, N): e[i] = phi * e[i - 1] + np.sqrt(1 - phi ** 2) * z[i]
    return e * sigma


def build_C(biz, cal, dowref, A_clean):
    W, ND = 288, 90; N = W * ND
    start = pd.Timestamp("2026-06-01"); idx = pd.date_range(start, periods=N, freq="5min")
    h = np.tile(np.arange(W) * 5 / 60, ND); day = np.repeat(np.arange(ND), W)
    b = biz.set_index("date").loc[start:start + pd.Timedelta(days=ND - 1)]
    dreq, promo = b.api_requests.values.astype(float), b.promo_intensity.values
    hw = np.arange(W) * 5 / 60
    base = .30 + .45 * np.exp(-.5 * ((hw - 13) / 3.5) ** 2) + .75 * np.exp(-.5 * ((hw - 21) / 2.5) ** 2)
    shape = np.zeros((ND, W)); flash = np.zeros((ND, W), bool)
    for d in range(ND):
        bump = promo[d] * 1.2 * (np.exp(-.5 * ((hw - 12) / .9) ** 2) + np.exp(-.5 * ((hw - 20) / .9) ** 2)) if promo[d] > .2 else 0 * hw
        s = base + bump; shape[d] = s / s.sum(); flash[d] = (bump > .25 * base) if promo[d] > .2 else False
    # NOTE: raw Borg residual sigma/AR1/dispersion are extremely heavy-tailed (sparse cluster-level samples),
    # so they are CLIPPED into service-level ranges below; see generation_report.json for the raw values.
    sig_req = float(np.clip(.25 * cal["log_resid_sigma"], .04, .09)); phi = float(np.clip(cal["ar1"], .3, .8))
    req = (dreq[:, None] * shape).reshape(-1) * np.exp(ar1_noise(N, phi, sig_req))
    inv = req * .12 * np.exp(ar1_noise(N, .5, .05)); dur = 185 * rng.lognormal(0, .06, N)
    uniq = req * (.22 + .03 * (promo[day] > 0)) * rng.lognormal(0, .03, N)
    top = .0025 * rng.lognormal(0, .3, N); geo = 3.1 + .15 * rng.normal(size=N) + .1 * np.sin(h / 24 * 2 * np.pi)
    err = .0018 * rng.lognormal(0, .25, N); lat_m = np.ones(N); err_m = np.ones(N); lat_add = np.zeros(N)
    out_mult = np.ones(N); in_mult = np.ones(N); ebs_mult = np.ones(N)
    cpu_add = np.zeros(N); mem_add = np.zeros(N); rogue_n = np.zeros(N); rogue_cpu = np.zeros(N); launch_extra = np.zeros(N)
    extra_out_mb = np.zeros(N)
    ctx = np.array(["none"] * N, dtype=object); ctx[flash.reshape(-1)] = "promo_flash_crowd"
    # --- benign recurring events (hard negatives)
    wi = np.tile(np.arange(W), ND)
    nb = (wi >= 24) & (wi < 30)                                  # nightly batch 02:00-02:30
    cpu_add[nb] += 18; out_mult[nb] *= 2.2; inv[nb] *= 1.8; launch_extra[nb & (wi == 24)] += 3; ctx[nb] = "nightly_batch"
    dep = (pd.Series(idx.dayofweek).values == 1) & (wi >= 132) & (wi < 138)  # Tuesday 11:00 rolling deployment
    lat_m[dep] *= 1.3; err_m[dep] *= 2.0; launch_extra[dep] += 4; ctx[dep] = "deployment_rollout"

    # --- incident machinery
    label = np.array(["normal"] * N, dtype=object); src = np.array(["none"] * N, dtype=object)
    inc_id = np.array([""] * N, dtype=object); atk = np.array([""] * N, dtype=object); incidents = []
    req0, inv0, uniq0, top0, geo0 = req.copy(), inv.copy(), uniq.copy(), top.copy(), geo.copy()
    att_req = np.zeros(N); att_inv = np.zeros(N); att_uniq = np.zeros(N); att_top = np.zeros(N); att_geo = np.zeros(N); att_dur = np.zeros(N)

    def mark(s, e, lab, name, source, k):
        label[s:e] = lab; src[s:e] = source; inc_id[s:e] = f"INC{k:03d}"; atk[s:e] = name
        incidents.append(dict(incident_id=f"INC{k:03d}", type=name, label=lab, label_source=source,
                              start=idx[s], end=idx[e - 1] + pd.Timedelta(minutes=5), n_windows=e - s))

    def attack(s, e, ar, ai, au, at, ag, ad=None):
        att_req[s:e] += ar; att_inv[s:e] += ai; att_uniq[s:e] += au
        att_top[s:e] = np.maximum(att_top[s:e], at); att_geo[s:e] = ag; att_dur[s:e] = ad if ad is not None else 0

    U = lambda a, b: float(rng.uniform(a, b))
    plan = {  # split -> list of incident types (train = low contamination, val/test = richer)
        "train": ["O1", "O3", "O4", "O6", "D2"], "val": ["O1", "O2", "O5", "O6", "D1", "D3", "DC"],
        "test": ["O1", "O2", "O3", "O4", "O5", "D1", "D2", "D3", "D4", "D5", "DC", "DC"]}
    rng_days = {"train": (2, 52), "val": (55, 70), "test": (73, 88)}
    k = 0; used = []
    for sp_name, types in plan.items():
        lo, hi = rng_days[sp_name]; ds = np.sort(rng.choice(np.arange(lo, hi), size=len(types), replace=False)); rng.shuffle(ds)
        for typ, d in zip(types, ds):
            k += 1; s0 = d * W + int(rng.integers(6, W - 150))
            if typ == "O1":
                L = int(rng.integers(6, 25)); s, e = s0, s0 + L
                err_m[s:e] *= U(6, 20); lat_m[s:e] *= U(2, 3.5); cpu_add[s:e] += U(10, 25); mark(s, e, "operational_anomaly", "deploy_regression", "synthetic_injection", k)
            elif typ == "O2":
                L = int(rng.integers(36, 73)); s, e = s0, s0 + L; r = np.linspace(0, 1, L)
                cpu_add[s:e] += r * U(25, 40); mem_add[s:e] += r * U(35, 48); mark(s, e, "operational_anomaly", "cpu_memory_leak", "synthetic_injection", k)
            elif typ == "O3":
                L = int(rng.integers(8, 20)); s, e = s0, s0 + L
                launch_extra[s:s + 4] += rng.integers(4, 16, 4); err_m[s:e] *= U(3, 8); lat_m[s:e] *= U(1.5, 2.5)
                mark(s, e, "operational_anomaly", "node_failure_churn", "synthetic_injection", k)
            elif typ == "O4":
                L = int(rng.integers(24, 73)); s, e = s0, s0 + L; ebs_mult[s:e] *= U(25, 80)
                mark(s, e, "operational_anomaly", "log_storage_bloat", "synthetic_injection", k)
            elif typ == "O5":
                L = int(rng.integers(48, 145)); s, e = s0, min(s0 + L, (d + 1) * W + 150); n_ = U(8, 30)
                rogue_n[s:e] += n_; rogue_cpu[s:e] = U(1, 5); launch_extra[s] += n_
                mark(s, e, "operational_anomaly", "orphaned_idle_fleet", "synthetic_injection", k)
            elif typ == "O6":
                L = int(rng.integers(6, 19)); s, e = s0, s0 + L; m_ = U(.6, 1.5)
                attack(s, e, m_ * req0[s:e], m_ * req0[s:e] * .12, 0, .002, geo0[s:e].mean()); att_top[s:e] = 0
                err[s:e] += U(.08, .25); lat_m[s:e] *= 1.8
                mark(s, e, "operational_anomaly", "retry_storm", "synthetic_injection", k)
            elif typ == "D1":
                L = int(rng.integers(18, 49)); s, e = s0, s0 + L; m_ = U(3, 9)
                attack(s, e, m_ * inv0[s:e] * .25, m_ * inv0[s:e], U(20, 200), U(.02, .15), U(.8, 1.6), U(500, 1200))
                mark(s, e, "dow_candidate", "serverless_invocation_flood", "synthetic_injection", k)
            elif typ == "D2":
                L = int(rng.integers(12, 37)); s, e = s0, s0 + L; m_ = U(1.8, 3.5) - 1
                attack(s, e, m_ * req0[s:e], m_ * req0[s:e] * .12, U(30, 200), U(.08, .25), U(.8, 1.6))
                mark(s, e, "dow_candidate", "api_hammering", "synthetic_injection", k)
            elif typ == "D3":
                L = int(rng.integers(12, 37)); s, e = s0, s0 + L; n_ = U(20, 60)
                rogue_n[s:e] += np.minimum(np.arange(1, L + 1) / 3, 1) * n_; rogue_cpu[s:e] = U(96, 100)
                launch_extra[s:s + 3] += n_ / 3; extra_out_mb[s:e] += rogue_n[s:e] * U(800, 2500)
                mark(s, e, "dow_candidate", "provisioning_abuse", "synthetic_injection", k)
            elif typ == "D4":
                L = int(rng.integers(72, 145)); s, e = s0, min(s0 + L, N - 1); L = e - s; r = np.linspace(0, 1, L)
                attack(s, e, r * U(1, 1.8) * req0[s:e], r * U(1, 3) * inv0[s:e], r * U(40, 120), U(.04, .10), U(1.8, 2.4))
                mark(s, e, "dow_candidate", "slow_ramp_low_and_slow", "synthetic_injection", k)
            elif typ == "D5":
                L = int(rng.integers(12, 49)); s, e = s0, s0 + L
                attack(s, e, U(.2, .6) * req0[s:e], 0, U(10, 60), U(.10, .40), U(.6, 1.4)); out_mult[s:e] *= U(5, 15)
                mark(s, e, "dow_candidate", "egress_abuse", "synthetic_injection", k)
            elif typ == "DC":   # real attack trace replayed on top of baseline
                L = len(dowref); s, e = s0, s0 + L; mult = U(1.5, 3.0)
                S = mult * inv0[s:e].mean() / max(dowref.n.mean(), 1e-9)
                nrep = dowref.n.values * S
                attack(s, e, nrep * .35, nrep, dowref.uniq.values.astype(float), dowref.top.values, 1.0, 1045.0)
                mark(s, e, "dow_confirmed", "real_trace_replay_serverless_bot", "real_trace_replay", k)

    # --- merge attack traffic into observed drivers
    req_t = req0 + att_req; inv_t = inv + att_inv
    w_att = np.divide(att_req, req_t, out=np.zeros(N), where=req_t > 0)
    hb = lambda p: -(p * np.log2(np.clip(p, 1e-9, 1)) + (1 - p) * np.log2(np.clip(1 - p, 1e-9, 1)))
    geo_t = np.where(w_att > 0, (1 - w_att) * geo0 + w_att * att_geo + hb(w_att), geo0)
    uniq_t = uniq0 + att_uniq
    top_cnt = np.maximum(top0 * req0, att_top * att_req); top_t = np.where(att_req > 0, top_cnt / req_t, top0)
    dur_t = np.where(att_inv > 0, (inv * dur + att_inv * np.where(att_dur > 0, att_dur, dur)) / np.maximum(inv_t, 1e-9), dur)
    # --- autoscaler + fleet metrics
    rate = req_t / 300; ew = pd.Series(rate).ewm(alpha=.5).mean().values
    desired = np.clip(np.ceil(ew / 2.6), 24, 260).astype(int); inst = np.zeros(N, int); inst[0] = desired[0]
    for i in range(1, N): inst[i] = max(desired[i], int(np.ceil(inst[i - 1] * .92)))
    util = rate / (inst * 4.4) * 100 * np.exp(ar1_noise(N, .5, .05))
    cpu_base = np.clip(util + cpu_add, 2, 100); fleet = inst + rogue_n
    cpu = np.clip((cpu_base * inst + np.where(rogue_n > 0, rogue_cpu, 0) * rogue_n) / fleet, 1, 100)
    mem = np.clip(47 + 6 * np.sin((h - 9) / 24 * 2 * np.pi) + rng.normal(0, 1.2, N) + mem_add, 10, 99)
    lat = 230 * (1 + .9 * (cpu_base / 100) ** 3) * rng.lognormal(0, .05, N) * lat_m
    errr = np.clip(err * err_m + .0008 * np.clip(cpu_base - 85, 0, None), 0, .6)
    nb_p = disp_p = max(min(cal["schedule_nb_dispersion"], 5.0), .5); mu = .12
    bg = rng.negative_binomial(disp_p, disp_p / (disp_p + mu), N)
    launches = np.clip(np.diff(inst, prepend=inst[0]), 0, None) + launch_extra + bg
    net_in = req_t * 1.8 / 1e3 * in_mult * rng.lognormal(0, .04, N)
    net_out = req_t * 26 / 1e3 * out_mult * rng.lognormal(0, .04, N) + extra_out_mb
    conc = inv_t / 300 * dur_t / 1000 * 3.5 * rng.lognormal(0, .1, N)
    g = .035 * (req_t / req_t.mean()) * rng.lognormal(0, .1, N) * ebs_mult
    ebs = 4200 + np.cumsum(g)
    for d in range(1, ND): ebs[d * W:] -= .85 * g[(d - 1) * W:d * W].sum()
    # --- cost (scaled so daily level matches dataset A's usage-driven services)
    c_ec2 = fleet * .11 / 12; c_lam = inv_t * (.2e-6 + dur_t / 1000 * .5 * 1.6667e-5); c_net = net_out / 1024 * .109 * .9
    c_ebs = ebs * .10 / 30.4 / 288; c_oth = req_t * 2.4e-6
    raw = c_ec2 + c_lam + c_net + c_ebs + c_oth
    normal_mask = label == "normal"
    raw_daily = pd.Series(raw[normal_mask]).groupby(day[normal_mask]).sum().median()
    a_cols = ["AmazonEC2", "AmazonEBS", "AWSDataTransfer", "AWSLambda", "ElasticLoadBalancing", "AmazonCloudWatch"]
    a_daily = A_clean.loc[start:start + pd.Timedelta(days=ND - 1), a_cols].sum(axis=1).median()
    kc = a_daily / raw_daily; cost = raw * kc * rng.lognormal(0, .01, N)
    # --- CloudWatch-style gaps
    na = rng.random(N) < .002
    split = np.where(day < 54, "train", np.where(day < 72, "val", "test"))
    C = pd.DataFrame(dict(
        window_start=idx, split=split, request_count=req_t.round().astype(int), unique_ips=uniq_t.round().astype(int),
        top_ip_share=top_t.round(5), geo_entropy_bits=geo_t.round(3), invocation_count=inv_t.round().astype(int),
        avg_function_duration_ms=dur_t.round(1), lambda_concurrency_max=conc.round(2),
        error_5xx_rate=errr.round(5), p95_latency_ms=lat.round(1),
        cpu_utilization_pct=np.where(na, np.nan, cpu.round(2)), memory_utilization_pct=np.where(na, np.nan, mem.round(2)),
        network_in_mb=net_in.round(2), network_out_mb=net_out.round(2), ebs_used_gb=ebs.round(3),
        instance_count=(fleet).round().astype(int), instances_launched=np.round(launches).astype(int), cost_usd=cost.round(4),
        cal_promo_intensity=np.repeat(promo, W), cal_is_holiday=np.repeat(b.is_holiday.values, W),
        cal_scheduled_job=(nb | dep).astype(int),
        context=ctx, label=label, is_anomaly=(label != "normal").astype(int), is_dow=np.isin(label, ["dow_candidate", "dow_confirmed"]).astype(int),
        incident_id=inc_id, attack_type=atk, label_source=src))
    inc = pd.DataFrame(incidents)
    inc["split"] = inc.start.map(lambda t: "train" if (t - start).days < 54 else ("val" if (t - start).days < 72 else "test"))
    return C, inc, dict(cost_scale_to_A=round(float(kc), 3))


# ----------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--borg", default=None); ap.add_argument("--dow", default=None); ap.add_argument("--out", default="data")
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    report = dict(seed=SEED)
    biz = build_business()
    B, comp, shared, tagged = build_B_and_costs(biz)
    A_tot, A_svc, A_hol, A_clean = build_A(biz, comp, shared, tagged)
    cal = dict(borg_windows=0, log_resid_sigma=.30, ar1=.5, schedule_nb_dispersion=1.5); ref = None
    if a.borg:
        ref, cal = borg_reference(a.borg); ref.to_csv(f"{a.out}/C_borg_real_reference_windows.csv", index=False)
    report["borg_calibration"] = cal
    if a.dow: dowref = dow_reference(a.dow)
    else:
        dowref = pd.DataFrame(dict(n=rng.integers(5, 36, 37), uniq=rng.integers(4, 18, 37), top=rng.uniform(.06, .2, 37), dur=1045.))
    C, inc, crep = build_C(biz, cal, dowref, A_clean); report.update(crep)
    A_tot.to_csv(f"{a.out}/A_prophet_cost_daily.csv", index=False)
    A_svc.to_csv(f"{a.out}/A_cost_by_service_daily.csv", index=False)
    A_hol.to_csv(f"{a.out}/A_holidays_events.csv", index=False)
    B.to_csv(f"{a.out}/B_xgboost_unit_economics.csv", index=False)
    C.to_csv(f"{a.out}/C_isoforest_telemetry_5min.csv", index=False)
    inc.to_csv(f"{a.out}/C_incident_ground_truth.csv", index=False)
    report["rows"] = dict(A=len(A_tot), A_service=len(A_svc), B=len(B), C=len(C), C_incidents=len(inc))
    json.dump(report, open(f"{a.out}/generation_report.json", "w"), indent=2, default=str)
    print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    main()
