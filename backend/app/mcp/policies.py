import hashlib
import json
from typing import Dict, Any, Tuple

ALLOWLISTED_ACTIONS = {
    "read_only": [
        "list_resources",
        "describe_instances",
        "get_cost_and_usage",
        "get_metric_data",
        "simulate_cost_impact"
    ],
    "state_changing": [
        "resize_instance",
        "modify_instance_type",
        "stop_idle_instance",
        "stop_instance",
        "terminate_idle_instance",
        "terminate_instance",
        "delete_unattached_volume",
        "delete_volume",
        "convert_gp2_to_gp3",
        "modify_volume_type",
        "modify_autoscaling_group"
    ]
}

def generate_action_hash(action_type: str, resource_id: str, payload: Dict[str, Any]) -> str:
    """Create a tamper-evident cryptographic hash for approved actions."""
    raw = f"{action_type}:{resource_id}:{json.dumps(payload, sort_keys=True)}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def validate_remediation_policy(action_type: str, resource: Dict[str, Any], payload: Dict[str, Any]) -> Tuple[bool, str]:
    """Production guardrail checks before remediation execution."""
    if action_type not in ALLOWLISTED_ACTIONS["state_changing"]:
        return False, f"Action '{action_type}' is not in the allowlist of permitted cloud operations."

    tags = resource.get("tags", {})
    env = tags.get("Environment", tags.get("env", "staging")).lower()
    
    # Critical database and core production cluster safeguards
    if tags.get("Protection", "").lower() == "strict":
        return False, f"Resource {resource.get('id')} has strict termination protection tag."

    if action_type == "delete_unattached_volume":
        # Check volume size limit for automated deletion
        size_gb = payload.get("size_gb", 0)
        if size_gb > 2000:
            return False, f"Volume size ({size_gb} GB) exceeds automated single-step threshold (2,000 GB). Manual FinOps escalation required."

    return True, "Policy checks passed successfully."
