"""EXAMPLE (not run against live AWS): near-real-time Model C scoring from CloudWatch.
Run every 5 minutes (cron / EventBridge-triggered container). Alerts go to an SNS topic you own; replace ASG/ALB/function names."""
import os, sys, json, pandas as pd
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from cloudsense.anomaly import StreamScorer
from cloudsense.collectors import get_session
from cloudsense.collectors.pipeline import build_model_c_frame
from cloudsense.collectors.realtime import RealtimeRunner
from cloudsense.collectors.cost_estimate import PriceTable

BUNDLE = os.environ.get("CLOUDSENSE_BUNDLE", "trained_artifacts/isoforest_bundle")      # a bundle trained on YOUR account data
ASG, LB, FN = ["web-asg"], ["app/my-alb/0123456789abcdef"], ["notify-fn"]
s = get_session(profile=os.environ.get("AWS_PROFILE"), region=os.environ.get("AWS_REGION", "ap-south-1")); cw, ct, sns = s.client("cloudwatch"), s.client("cloudtrail"), s.client("sns")
prices = PriceTable(ec2_hourly_per_instance=0.10)        # set real prices

def fetch_window(w: pd.Timestamp) -> dict:
    d = build_model_c_frame(cw, w, w + pd.Timedelta(minutes=5), asg_names=ASG, load_balancers=LB, functions=FN, ct=ct, prices=prices)
    return d.iloc[0].to_dict()

def on_alert(res: dict):
    sns.publish(TopicArn=os.environ["ALERT_TOPIC_ARN"], Subject="CloudSense DoW/anomaly candidate", Message=json.dumps(res, default=str))

runner = RealtimeRunner(StreamScorer.load(BUNDLE), fetch_window, on_alert=on_alert, lag_windows=2)
now = pd.Timestamp.utcnow().tz_localize(None); hist = build_model_c_frame(cw, now - pd.Timedelta(hours=40), now - pd.Timedelta(minutes=15), asg_names=ASG, load_balancers=LB, functions=FN, ct=ct, prices=prices)
runner.backfill(hist)            # in production keep your own 5-minute history store instead of re-fetching
print(len(runner.step(now)), "new windows scored")
