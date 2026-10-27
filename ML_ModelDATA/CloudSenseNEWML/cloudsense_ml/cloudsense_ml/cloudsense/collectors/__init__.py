"""AWS collectors (boto3): Cost Explorer / CUR 2.0, CloudWatch GetMetricData, CloudTrail launches, ALB logs, price-based 5-minute cost estimate, pipelines that emit the model input frames.
All collectors are READ-ONLY and take an injectable boto3 client (so they can be unit-tested with botocore Stubber)."""
from .session import get_session
from .cost import fetch_daily_cost, read_cur2
from .cloudwatch import MetricQuery, get_metric_data
