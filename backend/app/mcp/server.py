import logging
from typing import Dict, Any
from .tools import MCPToolRegistry

logger = logging.getLogger("cloudsense.mcp.server")

class MCPServer:
    """Model Context Protocol (MCP) Server for CloudSense AI."""

    def __init__(self):
        self.registry = MCPToolRegistry()

    def list_available_tools(self):
        return [
            {
                "name": "preview_remediation",
                "description": "Dry-run validation of a cost optimization action.",
                "parameters": ["action_type", "resource_id", "parameters"]
            },
            {
                "name": "execute_remediation",
                "description": "Execute approved state-changing remediation on AWS.",
                "parameters": ["action_type", "resource", "parameters", "approval_token"]
            },
            {
                "name": "rollback_remediation",
                "description": "Roll back a remediation action using rollback token.",
                "parameters": ["resource_id", "rollback_token"]
            }
        ]

    def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        logger.info("MCP Tool called: %s with args %s", name, arguments)
        if name == "preview_remediation":
            return self.registry.preview_remediation(
                arguments["action_type"],
                arguments["resource_id"],
                arguments.get("parameters", {})
            )
        elif name == "execute_remediation":
            return self.registry.execute_remediation(
                arguments["action_type"],
                arguments["resource"],
                arguments.get("parameters", {}),
                arguments.get("approval_token", "default_hash")
            )
        elif name == "rollback_remediation":
            return self.registry.rollback_remediation(
                arguments["resource_id"],
                arguments["rollback_token"]
            )
        else:
            raise ValueError(f"Unknown MCP tool: {name}")

mcp_server = MCPServer()
