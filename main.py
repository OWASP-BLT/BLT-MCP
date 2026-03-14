import asyncio
import httpx
import os
import json
import re
from typing import Any
from mcp.server import Server, NotificationOptions
from mcp.server.models import InitializationOptions
from mcp.types import (
    Resource, Tool, TextContent, Prompt, PromptArgument, 
    GetPromptResult, PromptMessage, ReadResourceContents
)
import mcp.server.stdio

# CORRECT BLT API configuration
BLT_API_BASE = os.getenv("BLT_API_BASE", "https://blt.owasp.org/api")
BLT_API_KEY = os.getenv("BLT_API_KEY", "")

server = Server("owasp-blt-mcp")

async def make_api_request(endpoint: str, method: str = "GET", body: dict | None = None) -> Any:
    """Authenticated HTTP client for BLT endpoints."""
    headers = {"Content-Type": "application/json"}
    if BLT_API_KEY:
        headers["Authorization"] = f"Bearer {BLT_API_KEY}"

    async with httpx.AsyncClient() as client:
        path = endpoint if endpoint.startswith("/") else f"/{endpoint}"
        url = f"{BLT_API_BASE}{path}"
        response = await client.request(method, url, headers=headers, json=body)
        response.raise_for_status()
        return response.json()

# --- RESOURCES ---

@server.list_resources()
async def handle_list_resources() -> list[Resource]:
    """Exposes resource metadata."""
    return [
        Resource(
            uri="blt://issues",
            name="BLT Issues",
            description="List of issues (Token-optimized)",
            mimeType="application/json",
        )
    ]

@server.read_resource()
async def handle_read_resource(uri: Any) -> list[ReadResourceContents]:
    """Translates MCP URIs into secure API calls. Converts AnyUrl to string for regex."""
    uri_str = str(uri).rstrip("/") # Normalize trailing slashes
    match = re.match(r"^blt:\/\/([^\/]+)(?:\/(.+))?$", uri_str)
    
    if not match:
        raise ValueError(f"Invalid BLT URI: {uri_str}")

    resource_type, resource_id = match.groups()

    if resource_type == "issues":
        if resource_id:
            if not re.match(r"^[A-Za-z0-9_-]+$", resource_id):
                raise ValueError("Invalid resource ID")
            data = await make_api_request(f"/issues/{resource_id}")
        else:
            raw_data = await make_api_request("/issues")
            # Handle paginated or wrapped API responses
            items = raw_data if isinstance(raw_data, list) else raw_data.get("results", [])
            # Return a smaller subset of fields for MCP responses
            # to keep responses lightweight for AI agents
            data = [
                {
                    "id": i.get("id"),
                    "title": i.get("title", "Untitled"),
                    "status": i.get("status", "unknown"),
                }
                for i in items
                if isinstance(i, dict)
            ]
            
        # Fix for MCP SDK v1.26.0+: Return list of content objects
        return [
            ReadResourceContents(
                uri=uri_str,
                mimeType="application/json",
                text=json.dumps(data, indent=2)
            )
        ]
    
    raise ValueError(f"Unknown resource type: {resource_type}")

# --- TOOLS ---

@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    """Exposes tools aligned with the TypeScript server contract."""
    return [
        Tool(
            name="submit_issue",
            description="Submit a new bug or vulnerability to BLT",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "repo_id": {"type": "string", "description": "Repository ID"},
                    "type": {"type": "string", "enum": ["bug", "vulnerability", "feature", "other"]},
                    "severity": {"type": "string", "enum": ["low", "medium", "high", "critical"]}
                },
                "required": ["title", "description"]
            }
        )
    ]

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict | None) -> list[TextContent]:
    """Executes tool calls."""
    if not arguments:
        raise ValueError("Missing required arguments")
    
    if name == "submit_issue":
        # Build explicit allowlist of fields to prevent forwarding undeclared parameters
        body: dict[str, Any] = {
            "title": arguments["title"],
            "description": arguments["description"],
            "severity": arguments.get("severity", "medium"),
            "type": arguments.get("type", "bug"),
        }
        # Add optional fields only if provided
        if "repo_id" in arguments:
            body["repo_id"] = arguments["repo_id"]
        result = await make_api_request("/issues", method="POST", body=body)
        return [TextContent(type="text", text=f"Issue submitted successfully! ID: {result.get('id')}")]
    raise ValueError(f"Unknown tool: {name}")

# --- PROMPTS ---

@server.list_prompts()
async def handle_list_prompts() -> list[Prompt]:
    """Exposes prompts aligned with the TypeScript server contract."""
    return [
        Prompt(
            name="triage_vulnerability",
            description="Guide AI through vulnerability triage",
            arguments=[
                PromptArgument(name="vulnerability_description", description="Description", required=True),
                PromptArgument(name="affected_component", description="The component affected", required=False)
            ]
        )
    ]

@server.get_prompt()
async def handle_get_prompt(name: str, arguments: dict | None) -> GetPromptResult:
    """Generates prompt content."""
    if name == "triage_vulnerability":
        args = arguments or {}
        desc = args.get("vulnerability_description", "No description provided.")
        comp = args.get("affected_component", "Unknown component")
        
        return GetPromptResult(
            messages=[
                PromptMessage(
                    role="user",
                    content=TextContent(
                        type="text",
                        text=f"Triage vulnerability in {comp}:\n\n{desc}\n\nProvide severity and impact analysis."
                    )
                )
            ]
        )
    raise ValueError(f"Unknown prompt: {name}")

async def main():
    """Runs the server using stdio transport."""
    async with mcp.server.stdio.stdio_server() as (read, write):
        await server.run(
            read, write,
            InitializationOptions(
                server_name="blt-mcp-python",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={}
                )
            )
        )

if __name__ == "__main__":
    asyncio.run(main())
