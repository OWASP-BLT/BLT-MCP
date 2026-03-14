# BLT-MCP

An MCP (Model Context Protocol) server that provides AI agents and developers with structured access to the BLT (Bug Logging Tool) ecosystem. This server enables seamless integration with IDEs and chat interfaces to log bugs, triage issues, query data, and manage security workflows.

> **Note**: This project is currently being migrated from a TypeScript implementation to a lightweight Python implementation using the official MCP Python SDK. The Python implementation is at the root level, while the original TypeScript server has been preserved in the `typescript-legacy/` directory.

---

# Overview

BLT-MCP implements the Model Context Protocol (MCP), giving AI agents structured access to BLT through three layers:

## 🔗 Resources (`blt://` URIs)

Access BLT data using standardized MCP URIs.

Currently implemented:

- `blt://issues` — List of issues retrieved from the BLT API (token-optimized for LLM context efficiency)

Additional resources will be added as feature parity with the TypeScript implementation is completed.

---

## 🛠️ Tools

Tools allow AI agents to perform actions within BLT.

Currently available:

- **submit_issue** — Report a new bug or vulnerability directly to the BLT API.

---

## 💡 Prompts

Prompts guide AI through structured workflows.

Currently available:

- **triage_vulnerability** — Helps AI evaluate a vulnerability and produce severity and impact analysis.

---

# Features

- ✅ **Python MCP Server** — Built using the official MCP Python SDK.
- ✅ **Token Optimized Responses** — Issue responses strip unnecessary fields to reduce LLM context usage.
- ✅ **Security-Aware Input Validation** — Regex validation prevents malformed resource IDs.
- ✅ **Lightweight Architecture** — Minimal dependencies and async design.
- ✅ **Migration-Friendly Structure** — TypeScript implementation preserved in `typescript-legacy/`.

---

# Repository Structure

```text
BLT-MCP/
│
├── main.py                # Python MCP implementation
├── pyproject.toml         # Python dependencies
├── uv.lock               # Dependency lock file
│
├── typescript-legacy/     # Original TypeScript implementation
│   ├── src/
│   └── tsconfig.json
│
├── README.md
├── USAGE.md
├── ARCHITECTURE.md
└── CONTRIBUTING.md
```

---

# Installation

## Prerequisites

- Python **3.11+**
- Node.js **18+** (only needed for MCP Inspector)
- `uv` (recommended) or `pip`

---

## Clone the repository

```bash
git clone https://github.com/OWASP-BLT/BLT-MCP.git
cd BLT-MCP
```

---

## Install dependencies

Using **uv (recommended)**:

```bash
uv pip install -e .
```

Or using **pip**:

```bash
pip install -e .
```

---

# Environment Configuration

Set the BLT API configuration variables:

```bash
export BLT_API_BASE="https://blt.owasp.org/api"
export BLT_API_KEY="your_api_key_here"
```

---

# Running the Server

Start the MCP server:

```bash
python main.py
```

The server communicates via **stdio**, allowing it to integrate with MCP clients such as Claude Desktop, Continue, or Cline.

---

# Testing with MCP Inspector

You can inspect resources, tools, and prompts using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector -- python main.py
```

This launches a browser interface for testing MCP endpoints.

---

# Example Capabilities

## Query Issues

```text
blt://issues
```

Returns token-optimized issue data suitable for AI agents.

---

## Submit a Vulnerability

AI agents can call the `submit_issue` tool with:

- title
- description
- repo_id
- severity
- type

---

## Triage a Vulnerability

Use the `triage_vulnerability` prompt to guide AI through:

- severity classification
- impact analysis
- mitigation suggestions

---

# Migration Status

The Python implementation currently provides a **proof-of-concept subset of functionality**.

Planned work includes:

- Additional MCP resources
- More tools for issue management
- Full feature parity with the original TypeScript server
- Pagination and performance improvements

---

# Related Projects

- Model Context Protocol: https://modelcontextprotocol.io/
- MCP Python SDK: https://github.com/modelcontextprotocol/python-sdk
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- OWASP BLT Project: https://owasp.org/www-project-bug-logging-tool/