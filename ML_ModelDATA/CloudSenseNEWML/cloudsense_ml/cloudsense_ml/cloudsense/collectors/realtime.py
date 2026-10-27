"""Near-real-time scoring loop for Model C. CloudWatch publishes datapoints with a delay, so windows are scored `lag_windows` after they close."""
from __future__ import annotations
import logging
import pandas as pd
log = logging.getLogger("cloudsense.realtime")

class RealtimeRunner:
    """fetch_window(window_start: Timestamp) -> dict with the scorer's required columns. on_alert(result: dict) is your hook (SNS, Slack, DB...). Call step(now) every ~5 minutes (e.g. EventBridge/cron)."""
    def __init__(self, scorer, fetch_window, on_alert=print, lag_windows: int = 2):
        self.scorer, self.fetch, self.on_alert, self.lag = scorer, fetch_window, on_alert, lag_windows; self.last = None
    def backfill(self, history: pd.DataFrame):
        """Warm the buffer with >= buffer_len past windows (30 h); alerts are NOT raised for history."""
        cols = self.scorer.b["required_cols"]
        for _, r in history.tail(self.scorer.b["buffer_len"]).iterrows(): self.scorer.update(r[cols].to_dict()); self.last = pd.Timestamp(r["window_start"])
    def step(self, now) -> list[dict]:
        now = pd.Timestamp(now).tz_localize(None) if pd.Timestamp(now).tzinfo else pd.Timestamp(now); ready = now.floor("5min") - pd.Timedelta(minutes=5 * self.lag); out = []
        if self.last is None: raise RuntimeError("call backfill() first so features have their history")
        while self.last + pd.Timedelta(minutes=5) <= ready:
            w = self.last + pd.Timedelta(minutes=5); res = self.scorer.update(self.fetch(w)); self.last = w; out.append(res)
            if res["is_alert"]: self.on_alert(res)
        return out
