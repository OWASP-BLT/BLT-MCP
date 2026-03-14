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

async def make_api_request(endpoint: str, method: str = "GET", body: dict = None) -> Any:
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
        ),
        Resource(
            uri="blt://repos",
            name="BLT Repositories",
            description="List of repositories tracked in BLT (Token-optimized)",
            mimeType="application/json",
        ),
        Resource(
            uri="blt://repos/{id}",
            name="BLT Repository by ID",
            description="Get details for a specific repository by ID",
            mimeType="application/json",
        ),
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
            raw_data = await make_api_request("/issues?limit=20")
            data = [{"id": i["id"], "title": i["title"], "status": i["status"]} for i in raw_data]
            
        # Fix for MCP SDK v1.26.0+: Return list of content objects
        return [
            ReadResourceContents(
                uri=uri_str,
                mimeType="application/json",
                text=json.dumps(data, indent=2)
            )
        ]

    if resource_type == "repos":
        if resource_id:
            if not re.match(r"^[A-Za-z0-9_-]+$", resource_id):
                raise ValueError("Invalid resource ID")
            raw = await make_api_request(f"/repos/{resource_id}")
            data = {
                "id": raw.get("id"),
                "name": raw.get("name"),
                "slug": raw.get("slug"),
                "description": raw.get("description"),
                "open_issues": raw.get("open_issues"),
                "url": raw.get("url"),
            }
        else:
            raw_data = await make_api_request("/repos?limit=20")
            data = [
                {
                    "id": r.get("id"),
                    "name": r.get("name"),
                    "slug": r.get("slug"),
                    "open_issues": r.get("open_issues"),
                }
                for r in raw_data
            ]

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
async def handle_call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Executes tool calls."""
    if name == "submit_issue":
        result = await make_api_request("/issues", method="POST", body=arguments)
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
