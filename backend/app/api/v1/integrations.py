import json
import logging
import datetime
import urllib.request
import urllib.error
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

logger = logging.getLogger("cloudsense.integrations")
router = APIRouter(prefix="/integrations", tags=["Integrations"])

INTEGRATIONS_STORE: List[Dict[str, Any]] = [
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
    type: Optional[str] = "slack" # slack, teams, discord, webhook, pagerduty
    message: Optional[str] = "CloudSense AI notification verification test."

class IntegrationCreateRequest(BaseModel):
    name: str
    type: str  # slack, teams, discord, pagerduty, webhook
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
    else:  # Generic Webhook
        body = {
            "source": "CloudSense AI",
            "title": title,
            "description": description,
            "data": data,
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
    return json.dumps(body).encode("utf-8")

def dispatch_notification_to_webhooks(event_type: str, title: str, description: str, data: Optional[Dict[str, Any]] = None):
    """Outbound dispatcher to fire webhook alerts to configured Slack/Teams/PagerDuty endpoints."""
    for integ in INTEGRATIONS_STORE:
        # Check if subscribed to this event type
        if event_type == "anomaly" and not integ.get("autoNotifyAnomalies"):
            continue
        if event_type == "approval" and not integ.get("autoNotifyApprovals"):
            continue

        url = integ.get("webhookUrl")
        if url and url.startswith("http") and not "internal.corp" in url and not "XXXX" in url:
            try:
                body = build_payload(integ.get("type", "slack"), title, description, data)
                req = urllib.request.Request(
                    url,
                    data=body,
                    headers={"Content-Type": "application/json", "User-Agent": "CloudSenseAI-Dispatcher/1.0"}
                )
                with urllib.request.urlopen(req, timeout=4) as response:
                    logger.info("Dispatched notification to %s, status: %s", integ["name"], response.status)
                    integ["eventsForwarded"] = integ.get("eventsForwarded", 0) + 1
                    integ["lastEvent"] = "Just now"
            except Exception as e:
                logger.warning("Failed delivering webhook to %s: %s", integ["name"], e)

@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]])
def get_integrations():
    return INTEGRATIONS_STORE

@router.post("", response_model=Dict[str, Any])
@router.post("/", response_model=Dict[str, Any])
def add_integration(req: IntegrationCreateRequest):
    new_integ = {
        "id": f"integ_{len(INTEGRATIONS_STORE) + 1:02d}_{req.type}",
        "name": req.name,
        "type": req.type,
        "status": "connected",
        "channel": req.channel,
        "webhookUrl": req.webhookUrl or "",
        "eventsForwarded": 0,
        "lastEvent": "Just connected",
        "autoNotifyAnomalies": req.autoNotifyAnomalies if req.autoNotifyAnomalies is not None else True,
        "autoNotifyApprovals": req.autoNotifyApprovals if req.autoNotifyApprovals is not None else True
    }
    INTEGRATIONS_STORE.append(new_integ)
    return new_integ

@router.put("/{integ_id}", response_model=Dict[str, Any])
def update_integration(integ_id: str, req: IntegrationUpdateRequest):
    for item in INTEGRATIONS_STORE:
        if item["id"] == integ_id:
            if req.name is not None: item["name"] = req.name
            if req.channel is not None: item["channel"] = req.channel
            if req.webhookUrl is not None: item["webhookUrl"] = req.webhookUrl
            if req.autoNotifyAnomalies is not None: item["autoNotifyAnomalies"] = req.autoNotifyAnomalies
            if req.autoNotifyApprovals is not None: item["autoNotifyApprovals"] = req.autoNotifyApprovals
            return item
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found")

@router.delete("/{integ_id}")
def delete_integration(integ_id: str):
    for i, item in enumerate(INTEGRATIONS_STORE):
        if item["id"] == integ_id:
            INTEGRATIONS_STORE.pop(i)
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
