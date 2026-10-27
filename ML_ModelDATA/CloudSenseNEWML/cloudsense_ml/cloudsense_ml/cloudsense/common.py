"""Shared helpers: seeds, metrics, JSON, hashing, schema validation."""
from __future__ import annotations
import hashlib, json, logging, random
from pathlib import Path
import numpy as np, pandas as pd

log = logging.getLogger("cloudsense")

def set_seed(seed: int = 42) -> None:
    random.seed(seed); np.random.seed(seed)

def file_hash(path) -> str:
    return hashlib.md5(open(path, "rb").read()).hexdigest()[:12]

def df_hash(df: pd.DataFrame) -> str:
    return hashlib.md5(pd.util.hash_pandas_object(df, index=True).values.tobytes()).hexdigest()[:12]

def jdump(obj, path) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    json.dump(obj, open(path, "w"), indent=2, default=lambda o: o.item() if hasattr(o, "item") else str(o))

class SchemaError(ValueError):
    """Raised with a clear message when an input frame does not match the spec."""

def require_columns(df: pd.DataFrame, cols, name: str) -> None:
    miss = [c for c in cols if c not in df.columns]
    if miss:
        raise SchemaError(f"{name}: missing required column(s) {miss}. Found: {list(df.columns)}")

def regression_metrics(y, p, lo=None, hi=None) -> dict:
    y, p = np.asarray(y, float), np.asarray(p, float); e = y - p
    out = dict(MAPE=float(np.mean(np.abs(e / y)) * 100), sMAPE=float(np.mean(2 * np.abs(e) / (np.abs(y) + np.abs(p))) * 100),
               RMSE=float(np.sqrt(np.mean(e ** 2))), MAE=float(np.mean(np.abs(e))), bias=float(np.mean(p - y)))
    ss = np.sum((y - y.mean()) ** 2); out["R2"] = float(1 - np.sum(e ** 2) / ss) if ss > 0 else float("nan")
    if lo is not None:
        out["coverage80"] = float(np.mean((y >= lo) & (y <= hi)) * 100); out["interval_width"] = float(np.mean(hi - lo))
    return out
