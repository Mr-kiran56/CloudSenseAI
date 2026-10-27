from __future__ import annotations
import pandas as pd
from ..common import require_columns
def load_kpi_csv(path_or_df, per_service: bool = True) -> pd.DataFrame:
    """Business KPIs come from YOUR application, not AWS. Required: date, active_users, transactions (+ service when per_service). api_requests can come from ALB RequestCount."""
    d = pd.read_csv(path_or_df) if not isinstance(path_or_df, pd.DataFrame) else path_or_df.copy()
    require_columns(d, ["date", "active_users", "transactions"] + (["service"] if per_service else []), "KPI input"); d["date"] = pd.to_datetime(d["date"]); return d
