import json
import logging
import datetime
import urllib.request
import urllib.error
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from ...db.session import get_db, SessionLocal
from ...db.models import Integration

logger = logging.getLogger("cloudsense.integrations")
router = APIRouter(prefix="/integrations", tags=["Integrations"])

DEFAULT_INTEGRATIONS = [
    {
        "id": "integ_01_slack",
        "name": "FinOps Incident Slack Channel",
        "type": "slack",
        "status": "connected",
        "channel": "#finops-cloud-alerts",
        "webhookUrl": "",
        "eventsForwarded": 428,
        "lastEvent": "14 minutes ago",
        "autoNotifyAnomalies": True,
        "autoNotifyApprovals": True
    },
    {
        "id": "integ_02_teams",
        "name": "Microsoft Teams FinOps Squad",
        "type": "teams",
        "status": "connected",
        "channel": "FinOps Approvals & Alerts",
        "webhookUrl": "",
        "eventsForwarded": 216,
        "lastEvent": "1 hour ago",
        "autoNotifyAnomalies": True,
        "autoNotifyApprovals": True
    },
    {
        "id": "integ_03_pagerduty",
        "name": "DevOps Escalation PagerDuty Service",
        "type": "pagerduty",
        "status": "connected",
        "channel": "Production Critical Incidents",
        "webhookUrl": "",
        "eventsForwarded": 14,
        "lastEvent": "Yesterday",
        "autoNotifyAnomalies": True,
        "autoNotifyApprovals": False
    },
    {
        "id": "integ_04_webhook",
        "name": "Custom Corporate REST Webhook",
        "type": "webhook",
        "status": "connected",
        "channel": "https://api.internal.corp/finops/v1/events",
        "webhookUrl": "",
        "eventsForwarded": 890,
        "lastEvent": "2 days ago",
        "autoNotifyAnomalies": True,
        "autoNotifyApprovals": True
    }
]

class WebhookTestRequest(BaseModel):
    url: str
    type: Optional[str] = "slack"
    message: Optional[str] = "CloudSense AI notification verification test."

class IntegrationCreateRequest(BaseModel):
    name: str
    type: str
    channel: str
    webhookUrl: Optional[str] = ""
    autoNotifyAnomalies: Optional[bool] = True
    autoNotifyApprovals: Optional[bool] = True

class IntegrationUpdateRequest(BaseModel):
    name: Optional[str] = None
    channel: Optional[str] = None
    webhookUrl: Optional[str] = None
    autoNotifyAnomalies: Optional[bool] = None
    autoNotifyApprovals: Optional[bool] = None

def build_payload(service_type: str, title: str, description: str, data: Optional[Dict[str, Any]] = None) -> bytes:
    data = data or {}
    if service_type == "slack":
        body = {
            "text": f":cloud: *{title}*\n{description}",
            "blocks": [
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": f"*CloudSense AI FinOps Alert*\n*{title}*\n{description}"}
                }
            ]
        }
    elif service_type == "teams":
        body = {
            "@type": "MessageCard",
            "@context": "https://schema.org/extensions",
            "summary": title,
            "themeColor": "0076D7",
            "title": f"CloudSense AI: {title}",
            "text": description
        }
    elif service_type == "discord":
        body = {
            "content": f"**CloudSense AI**: {title}\n> {description}"
        }
    elif service_type == "pagerduty":
        body = {
            "routing_key": data.get("routing_key", "default_routing_key"),
            "event_action": "trigger",
            "payload": {
                "summary": title,
                "source": "CloudSense-AI",
                "severity": data.get("severity", "warning"),
                "custom_details": {"description": description, **data}
            }
        }
    else:
        body = {
            "event": "cloudsense_finops_alert",
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "title": title,
            "description": description,
            "metadata": data
        }
    return json.dumps(body).encode("utf-8")

def dispatch_notification_to_webhooks(event_type: str, title: str, description: str, data: Optional[Dict[str, Any]] = None):
    """Deliver real outbound webhook notifications to configured endpoints (Slack, Teams, Discord)."""
    db = SessionLocal()
    try:
        # Check database integrations
        db_integs = db.query(Integration).filter(Integration.enabled == True).all()
        for rec in db_integs:
            if rec.type == "llm_provider":
                continue
            cfg = {}
            try:
                cfg = json.loads(rec.config_json or "{}")
            except Exception:
                pass

            if event_type == "anomaly" and not cfg.get("autoNotifyAnomalies", True):
                continue
            if event_type == "approval" and not cfg.get("autoNotifyApprovals", True):
                continue

            url = cfg.get("webhookUrl")
            if url and url.startswith("http") and not "internal.corp" in url and not "XXXX" in url:
                try:
                    body = build_payload(rec.type, title, description, data)
                    req = urllib.request.Request(
                        url,
                        data=body,
                        headers={"Content-Type": "application/json", "User-Agent": "CloudSenseAI-Dispatcher/1.0"}
                    )
                    with urllib.request.urlopen(req, timeout=4) as response:
                        logger.info("Delivered webhook to %s, status: %s", rec.name, response.status)
                except Exception as e:
                    logger.warning("Failed delivering webhook to %s: %s", rec.name, e)
    finally:
        db.close()

def _ensure_default_integrations(db: Session):
    existing = db.query(Integration).filter(Integration.type != "llm_provider").all()
    if not existing:
        for item in DEFAULT_INTEGRATIONS:
            cfg = {
                "id": item["id"],
                "channel": item["channel"],
                "webhookUrl": item["webhookUrl"],
                "autoNotifyAnomalies": item["autoNotifyAnomalies"],
                "autoNotifyApprovals": item["autoNotifyApprovals"],
                "eventsForwarded": item["eventsForwarded"],
                "lastEvent": item["lastEvent"]
            }
            db.add(Integration(
                type=item["type"],
                name=item["name"],
                status=item["status"],
                config_json=json.dumps(cfg),
                enabled=True
            ))
        db.commit()

@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]])
def get_integrations(db: Session = Depends(get_db)):
    """Retrieve all configured webhook integrations from the database."""
    _ensure_default_integrations(db)
    records = db.query(Integration).filter(Integration.type != "llm_provider").all()
    results = []
    for r in records:
        cfg = {}
        try:
            cfg = json.loads(r.config_json or "{}")
        except Exception:
            pass

        results.append({
            "id": cfg.get("id", f"integ_{r.id:02d}_{r.type}"),
            "dbId": r.id,
            "name": r.name,
            "type": r.type,
            "status": r.status,
            "channel": cfg.get("channel", ""),
            "webhookUrl": cfg.get("webhookUrl", ""),
            "eventsForwarded": cfg.get("eventsForwarded", 0),
            "lastEvent": cfg.get("lastEvent", "Recently"),
            "autoNotifyAnomalies": cfg.get("autoNotifyAnomalies", True),
            "autoNotifyApprovals": cfg.get("autoNotifyApprovals", True)
        })
    return results

@router.post("", response_model=Dict[str, Any])
@router.post("/", response_model=Dict[str, Any])
def add_integration(req: IntegrationCreateRequest, db: Session = Depends(get_db)):
    """Add and persist a new webhook integration in the database."""
    integ_id = f"integ_{req.type}_{datetime.datetime.utcnow().strftime('%M%S')}"
    cfg = {
        "id": integ_id,
        "channel": req.channel,
        "webhookUrl": req.webhookUrl or "",
        "autoNotifyAnomalies": req.autoNotifyAnomalies if req.autoNotifyAnomalies is not None else True,
        "autoNotifyApprovals": req.autoNotifyApprovals if req.autoNotifyApprovals is not None else True,
        "eventsForwarded": 0,
        "lastEvent": "Just connected"
    }
    new_record = Integration(
        type=req.type,
        name=req.name,
        status="connected",
        config_json=json.dumps(cfg),
        enabled=True
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)

    return {
        "id": integ_id,
        "dbId": new_record.id,
        "name": new_record.name,
        "type": new_record.type,
        "status": new_record.status,
        **cfg
    }

@router.put("/{integ_id}", response_model=Dict[str, Any])
def update_integration(integ_id: str, req: IntegrationUpdateRequest, db: Session = Depends(get_db)):
    """Update existing integration details in the database."""
    records = db.query(Integration).filter(Integration.type != "llm_provider").all()
    for r in records:
        cfg = {}
        try:
            cfg = json.loads(r.config_json or "{}")
        except Exception:
            pass

        if cfg.get("id") == integ_id or str(r.id) == integ_id:
            if req.name is not None:
                r.name = req.name
            if req.channel is not None:
                cfg["channel"] = req.channel
            if req.webhookUrl is not None:
                cfg["webhookUrl"] = req.webhookUrl
            if req.autoNotifyAnomalies is not None:
                cfg["autoNotifyAnomalies"] = req.autoNotifyAnomalies
            if req.autoNotifyApprovals is not None:
                cfg["autoNotifyApprovals"] = req.autoNotifyApprovals

            r.config_json = json.dumps(cfg)
            db.commit()
            return {
                "id": cfg.get("id", integ_id),
                "dbId": r.id,
                "name": r.name,
                "type": r.type,
                "status": r.status,
                **cfg
            }

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found")

@router.delete("/{integ_id}")
def delete_integration(integ_id: str, db: Session = Depends(get_db)):
    """Remove integration from the database."""
    records = db.query(Integration).filter(Integration.type != "llm_provider").all()
    for r in records:
        cfg = {}
        try:
            cfg = json.loads(r.config_json or "{}")
        except Exception:
            pass

        if cfg.get("id") == integ_id or str(r.id) == integ_id:
            db.delete(r)
            db.commit()
            return {"success": True, "message": f"Integration {integ_id} removed"}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found")

@router.post("/test-webhook")
def test_webhook(req: WebhookTestRequest):
    """Sends a real HTTP POST request with appropriate Slack/Teams/Discord formatting."""
    if not req.url or not req.url.startswith("http"):
        raise HTTPException(status_code=400, detail="Invalid webhook URL. Must start with http:// or https://")

    body = build_payload(
        service_type=req.type or "slack",
        title="Live Connection Verification Test",
        description=req.message or "CloudSense AI notification delivery test verified successfully.",
        data={"test": True}
    )

    try:
        http_req = urllib.request.Request(
            req.url,
            data=body,
            headers={"Content-Type": "application/json", "User-Agent": "CloudSenseAI-Tester/1.0"}
        )
        with urllib.request.urlopen(http_req, timeout=6) as resp:
            return {
                "success": True,
                "statusCode": resp.status,
                "message": f"Successfully delivered test payload to {req.type.upper()} webhook (HTTP {resp.status})"
            }
    except urllib.error.HTTPError as e:
        return {
            "success": False,
            "statusCode": e.code,
            "message": f"{req.type.upper()} endpoint returned HTTP {e.code}: {e.reason}"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}"
        }
