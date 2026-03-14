# Contributing to BLT-MCP

Thank you for your interest in contributing to BLT-MCP! This guide will help you get started.

> **Current Status**: The project is being migrated from TypeScript to Python. Both implementations are documented below. Python is the primary focus for new development.

## Code of Conduct

This project follows the [OWASP Code of Conduct](https://owasp.org/www-policy/operational/code-of-conduct). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

#### For Python Development (Primary)
- Python 3.11 or higher
- `uv` (recommended) or `pip`
- Git
- A text editor or IDE (VS Code recommended)

#### For TypeScript Development (Legacy)
- Node.js 18 or higher
- npm or yarn
- Git
- A text editor or IDE (VS Code recommended)

### Development Setup

#### Python Setup (Primary)

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/BLT-MCP.git
   cd BLT-MCP
   ```

2. **Install Dependencies**
   ```bash
   # Using uv (recommended)
   uv pip install -e .
   
   # Or using pip
   pip install -e .
   ```

3. **Configure Environment**
   ```bash
   export BLT_API_BASE="https://blt.owasp.org/api"
   export BLT_API_KEY="your_api_key_here"
   ```

4. **Test Your Setup**
   ```bash
   python main.py
   # Should start the server without errors
   ```

#### TypeScript Setup (Legacy)

1. **Navigate to TypeScript Directory**
   ```bash
   cd BLT-MCP/typescript-legacy
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build the Project**
   ```bash
   npm run build
   ```

4. **Test Your Setup**
   ```bash
   node dist/index.js
   ```

## Development Workflow

### Making Changes

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - **Python**: Edit files at the root level (`main.py`, `pyproject.toml`)
   - **TypeScript**: Edit files in the `typescript-legacy/src/` directory
   - Follow the existing code style
   - Add docstrings/comments for complex logic
   - Use type hints (Python) or types (TypeScript)

3. **Test Your Changes**
   ```bash
   # Python
   python main.py
   
   # TypeScript
   cd typescript-legacy
   npm run build
   node dist/index.js
   ```

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

### Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```text
feat: add support for GitHub webhooks
fix: handle null values in API responses
docs: update installation instructions
refactor: improve error handling in API client
```

## Code Style

### Python Guidelines (Primary)

- Use Python 3.11+ features
- Follow PEP 8 style guide
- Use type hints for all function signatures
- Document with docstrings (Google or NumPy style)
- Use `async`/`await` for async operations
- Follow existing naming conventions

Example:
```python
async def submit_issue(title: str, description: str) -> dict[str, Any]:
    """Submit a new issue to the BLT system.
    
    Args:
        title: The issue title
        description: Detailed description of the issue
        
    Returns:
        Dictionary containing the created issue data
        
    Raises:
        ValueError: If validation fails
        httpx.HTTPError: If API request fails
    """
    # Implementation
```

### TypeScript Guidelines (Legacy)

- Use TypeScript strict mode
- Define proper types (avoid `any`)
- Use interfaces for complex types
- Document public APIs with JSDoc comments
- Follow existing naming conventions

Example:
```typescript
/**
 * Submit a new issue to the BLT system
 * @param title - The issue title
 * @param description - Detailed description
 * @returns Promise with the created issue
 */
async function submitIssue(
  title: string,
  description: string
): Promise<Issue> {
  // Implementation
}
```

### Project Structure

```text
main.py               # Main Python server implementation
pyproject.toml        # Python dependencies and metadata
uv.lock              # Dependency lock file

typescript-legacy/
  src/
    index.ts          # Main TypeScript server (legacy)
  tsconfig.json
  package.json
```

## Testing

### Manual Testing

#### Python

1. **Start the Server**
   ```bash
   python main.py
   ```

2. **Test with MCP Inspector**
   ```bash
   npx @modelcontextprotocol/inspector python main.py
   ```

3. **Test with Claude Desktop**
   - Add configuration to Claude Desktop settings
   - Use the `mcp-config.json` as reference
   - Test all resources, tools, and prompts

#### TypeScript (Legacy)

1. **Start the Server**
   ```bash
   cd typescript-legacy
   node dist/index.js
   ```

2. **Test with MCP Inspector**
   ```bash
   npx @modelcontextprotocol/inspector typescript-legacy/dist/index.js
   ```

### Writing Tests

If adding test infrastructure:

#### Python
```python
import pytest
from main import server, make_api_request

@pytest.mark.asyncio
async def test_list_resources():
    """Test that resources are listed correctly."""
    # Test implementation
    pass

@pytest.mark.asyncio
async def test_submit_issue():
    """Test issue submission."""
    # Test implementation
    pass
```

#### TypeScript
```typescript
describe('BLT-MCP Server', () => {
  it('should list all resources', async () => {
    // Test implementation
  });
  
  it('should submit an issue', async () => {
    // Test implementation
  });
});
```

## Adding New Features

### Adding a New Resource

#### Python

1. Update `handle_list_resources` function:
   ```python
   Resource(
       uri="blt://new-resource",
       name="New Resource",
       description="Description of the resource",
       mimeType="application/json",
   )
   ```

2. Update `handle_read_resource` function:
   ```python
   elif resource_type == "new-resource":
       if resource_id:
           if not re.match(r"^[A-Za-z0-9_-]+$", resource_id):
               raise ValueError("Invalid resource ID")
           data = await make_api_request(f"/new-endpoint/{resource_id}")
       else:
           data = await make_api_request("/new-endpoint")
       return [
           ReadResourceContents(
               uri=uri_str,
               mimeType="application/json",
               text=json.dumps(data, indent=2)
           )
       ]
   ```

3. Update documentation in README.md

#### TypeScript (Legacy)

1. Update `ListResourcesRequestSchema` handler:
   ```typescript
   {
     uri: "blt://new-resource",
     name: "New Resource",
     description: "Description of the resource",
     mimeType: "application/json"
   }
   ```

2. Update `ReadResourceRequestSchema` handler:
   ```typescript
   case "new-resource":
     data = await makeApiRequest("/new-endpoint");
     break;
   ```

3. Update documentation in README.md

### Adding a New Tool

#### Python

1. Update `handle_list_tools` function:
   ```python
   Tool(
       name="new_tool",
       description="Tool description",
       inputSchema={
           "type": "object",
           "properties": {
               "param1": {"type": "string", "description": "Parameter description"}
           },
           "required": ["param1"]
       }
   )
   ```

2. Update `handle_call_tool` function:
   ```python
   if name == "new_tool":
       result = await make_api_request("/endpoint", method="POST", body=arguments)
       return [TextContent(type="text", text=json.dumps(result))]
   ```

3. Update documentation

#### TypeScript (Legacy)

1. Update `ListToolsRequestSchema` handler:
   ```typescript
   {
     name: "new_tool",
     description: "Tool description",
     inputSchema: {
       type: "object",
       properties: {
         param1: { type: "string" }
       },
       required: ["param1"]
     }
   }
   ```

2. Update `CallToolRequestSchema` handler:
   ```typescript
   case "new_tool":
     const result = await makeApiRequest("/endpoint", "POST", args);
     return { content: [{ type: "text", text: JSON.stringify(result) }] };
   ```

3. Update documentation

### Adding a New Prompt

#### Python

1. Update `handle_list_prompts` function:
   ```python
   Prompt(
       name="new_prompt",
       description="Prompt description",
       arguments=[
           PromptArgument(
               name="arg1",
               description="Argument description",
               required=True
           )
       ]
   )
   ```

2. Update `handle_get_prompt` function:
   ```python
   if name == "new_prompt":
       args = arguments or {}
       arg1 = args.get("arg1", "")
       return GetPromptResult(
           messages=[
               PromptMessage(
                   role="user",
                   content=TextContent(
                       type="text",
                       text=f"Prompt template with {arg1}"
                   )
               )
           ]
       )
   ```

3. Update documentation

#### TypeScript (Legacy)

1. Update `ListPromptsRequestSchema` handler:
   ```typescript
   {
     name: "new_prompt",
     description: "Prompt description",
     arguments: [
       { name: "arg1", description: "Argument description", required: true }
     ]
   }
   ```

2. Update `GetPromptRequestSchema` handler:
   ```typescript
   case "new_prompt":
     return {
       messages: [{
         role: "user",
         content: { type: "text", text: "Prompt template..." }
       }]
     };
   ```

3. Update documentation

## Documentation

### Updating Documentation

When making changes, update relevant documentation:

- **README.md** - User-facing documentation
- **USAGE.md** - Usage examples
- **ARCHITECTURE.md** - Architecture details
- **Code comments** - Inline documentation

### Documentation Style

- Use clear, concise language
- Include code examples
- Explain why, not just what
- Keep examples up-to-date

## Pull Request Process

### Before Submitting

1. **Test Your Changes**
   - Code runs successfully
   - Manual testing completed
   - No type errors (Python type hints validated, TypeScript compiles)
   - No security vulnerabilities
   - No syntax errors or linting issues

2. **Update Documentation**
   - README updated if needed
   - Examples added if needed
   - Docstrings/comments added for complex code
   - ARCHITECTURE.md updated for architectural changes

3. **Clean Commit History**
   - Meaningful commit messages
   - Squash work-in-progress commits if needed
   - Rebase on latest main if needed

### Submitting a PR

1. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create Pull Request**
   - Go to the GitHub repository
   - Click "New Pull Request"
   - Select your branch
   - Fill in the PR template

3. **PR Description Should Include**
   - What changes were made
   - Why the changes were made
   - How to test the changes
   - Screenshots (if UI changes)
   - Related issues (if any)

### PR Review Process

1. Automated checks will run
2. Maintainers will review your code
3. Address any feedback
4. Once approved, PR will be merged

## Security

### Reporting Security Issues

**Do not open public issues for security vulnerabilities.**

Instead, email security@owasp.org with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Security Best Practices

- Never commit API keys or secrets
- Validate all user inputs
- Use parameterized queries
- Follow OWASP security guidelines
- Keep dependencies updated

## Getting Help

### Resources

- [MCP Documentation](https://modelcontextprotocol.io/)
- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [OWASP BLT Project](https://owasp.org/www-project-bug-logging-tool/)
- [Python Documentation](https://docs.python.org/3/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

### Communication

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Questions and discussions
- **OWASP Slack** - Real-time chat (security channel)

## Recognition

Contributors are recognized in:
- GitHub contributors page
- Release notes
- Project documentation

Thank you for contributing to BLT-MCP and helping make security tools more accessible!
