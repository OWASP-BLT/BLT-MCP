# BLT-MCP Usage Examples

This document provides practical examples of how to use the BLT-MCP server.

> **Current Status**: A Python proof-of-concept implementation is being developed alongside the existing TypeScript server. The goal is to evaluate compatibility with the Python MCP SDK while preserving the existing BLT API integration.

---

# Implementation Status

| Feature | TypeScript Server | Python PoC |
|-------|-------|------|
| Resources | ✅ | ✅ (issues only) |
| Tools | ✅ | ✅ (`submit_issue`) |
| Prompts | ✅ | ✅ (`triage_vulnerability`) |
| Leaderboards | ✅ | 🚧 Planned |
| Rewards / Bacon Points | ✅ | 🚧 Planned |
| Workflow Management | ✅ | 🚧 Planned |

The Python implementation mirrors the architecture of the TypeScript MCP server to evaluate maintainability and ecosystem compatibility.

---

# Prerequisites

## Python Implementation (Proof of Concept)

1. Install dependencies:

```bash
# Using uv (recommended)
uv pip install -e .

# Or using pip
pip install -e .
```

2. Configure your environment:

```bash
export BLT_API_BASE="https://blt.owasp.org/api"
export BLT_API_KEY="your_api_key_here"
```

Python **3.11 or higher** is recommended.

---

## TypeScript Implementation (Existing Server)

1. Navigate to legacy directory:

```bash
cd typescript-legacy
```

2. Install dependencies:

```bash
npm install
```

3. Build the server:

```bash
npm run build
```

4. Configure your environment:

```bash
cp .env.example .env
```

Then edit `.env` with your BLT API credentials.

---

# Configuration Examples

## Claude Desktop Configuration

### Python Implementation (Proof of Concept)

Add to your Claude Desktop config file:

- **macOS**  
  `~/Library/Application Support/Claude/claude_desktop_config.json`

- **Windows**  
  `%APPDATA%\Claude\claude_desktop_config.json`

Using **uv**:

```json
{
  "mcpServers": {
    "blt-mcp-python": {
      "command": "uv",
      "args": [
        "--directory",
        "/absolute/path/to/BLT-MCP",
        "run",
        "python",
        "main.py"
      ],
      "env": {
        "BLT_API_BASE": "https://blt.owasp.org/api",
        "BLT_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Or using **standard Python**:

```json
{
  "mcpServers": {
    "blt-mcp-python": {
      "command": "python",
      "args": ["/absolute/path/to/BLT-MCP/main.py"],
      "env": {
        "BLT_API_BASE": "https://blt.owasp.org/api",
        "BLT_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

---

### TypeScript Implementation

```json
{
  "mcpServers": {
    "blt-legacy": {
      "command": "node",
      "args": ["/absolute/path/to/BLT-MCP/typescript-legacy/dist/index.js"],
      "env": {
        "BLT_API_BASE": "https://blt.owasp.org/api",
        "BLT_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

---

# Cline / Continue Configuration

For VS Code extensions like **Cline** or **Continue**.

## Python

```json
{
  "mcpServers": {
    "blt-mcp-python": {
      "command": "python",
      "args": ["/absolute/path/to/BLT-MCP/main.py"],
      "env": {
        "BLT_API_BASE": "https://blt.owasp.org/api",
        "BLT_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## TypeScript

```json
{
  "mcpServers": {
    "blt-legacy": {
      "command": "node",
      "args": ["/absolute/path/to/BLT-MCP/typescript-legacy/dist/index.js"],
      "env": {
        "BLT_API_BASE": "https://blt.owasp.org/api",
        "BLT_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

---

# Usage Scenarios

> **Note:** The following scenarios demonstrate MCP interaction patterns.  
> The Python implementation currently supports a proof-of-concept subset (1 resource, 1 tool, 1 prompt). Full feature parity is planned.

---

## Scenario 1: Reporting a Vulnerability

**User Query**

```
I found a SQL injection vulnerability in the user registration endpoint of repo 456.
Please submit this as a critical issue.
```

**What Happens**

1. The AI agent uses the `submit_issue` tool.
2. It creates an issue with:
   - Title: *SQL Injection in User Registration*
   - Description: vulnerability details
   - Repository ID: `456`
   - Severity: `critical`
   - Type: `vulnerability`

**Expected Result**

```json
{
  "id": "789",
  "title": "SQL Injection in User Registration",
  "status": "open",
  "created_at": "2026-02-18T02:30:00Z"
}
```

**Python Implementation Status:** ✅ Available

---

## Scenario 2: Triaging a Vulnerability

**User Query**

```
Help me triage this XSS vulnerability:
User input in the comment section is not properly sanitized,
allowing arbitrary JavaScript execution.
```

**What Happens**

1. AI agent uses the `triage_vulnerability` prompt.
2. It generates:
   - Severity assessment
   - Impact analysis
   - Mitigation recommendations
   - Priority level

**Expected Response**

The AI provides a structured vulnerability triage analysis.

**Python Implementation Status:** ✅ Available

---

## Scenario 3: Reviewing the Leaderboard

**User Query**

```
Show me the current leaderboard standings
```

**What Happens**

1. AI agent reads the `blt://leaderboards` resource.
2. Displays formatted leaderboard data.

**Python Implementation Status:** 🚧 Planned (TypeScript only)

---

## Scenario 4: Awarding Bacon Points

**User Query**

```
Award 50 bacon points to contributor 123 for their security analysis
```

**Expected Result**

```json
{
  "contributor_id": "123",
  "points_awarded": 50,
  "new_total": 350
}
```

**Python Implementation Status:** 🚧 Planned (TypeScript only)

---

## Scenario 5: Managing Issue Workflow

**User Query**

```
Update issue 789 to resolved status and add a comment explaining the fix
```

**What Happens**

1. AI agent uses `update_issue_status`.
2. AI agent uses `add_comment`.

**Python Implementation Status:** 🚧 Planned (TypeScript only)

---

# Testing the Server

## Manual Testing

### Python

```bash
python main.py
```

Then send JSON-RPC requests via stdin:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list"
}
```

---

### TypeScript

```bash
cd typescript-legacy
node dist/index.js
```

---

# Testing with MCP Inspector

### Python

```bash
npx @modelcontextprotocol/inspector -- python main.py
```

### TypeScript

```bash
npx @modelcontextprotocol/inspector -- node typescript-legacy/dist/index.js
```

---

# Troubleshooting

## Python Implementation

### Module Import Errors

Install dependencies:

```bash
uv pip install -e .
```

or

```bash
pip install -e .
```

Check Python version:

```bash
python --version
```

Python **3.11+** is recommended.

---

### Authentication Errors

Verify the following variables are set correctly:

- `BLT_API_BASE`
- `BLT_API_KEY`

Also verify the API key permissions.

---

### Connection Issues

Verify the BLT API endpoint:

```
https://blt.owasp.org/api
```

You can test connectivity using tools like `curl` or `httpx`.

---

# Best Practices

## Security

- Never commit `.env` files containing real API keys
- Use environment variables for credentials
- Rotate API keys regularly

## Performance

- Respect API rate limits
- Cache frequently accessed resources
- Batch operations when possible

## Error Handling

- Provide clear issue descriptions
- Include context in comments
- Handle API failures gracefully

---

# Additional Resources

- MCP Documentation: https://modelcontextprotocol.io/
- MCP Python SDK: https://github.com/modelcontextprotocol/python-sdk
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- OWASP BLT Project: https://owasp.org/www-project-bug-logging-tool/
- BLT API Docs: https://blt.owasp.org/api/docs