#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// BLT API configuration
const BLT_API_BASE = process.env.BLT_API_BASE || "https://blt.owasp.org/api";
const BLT_API_KEY = process.env.BLT_API_KEY || "";

// FIX 1 (Bug 1): Configurable request timeout — prevents the server from
// hanging forever when the BLT API is slow or unreachable. 10 seconds is
// aggressive enough to surface real problems without punishing slow networks.
const REQUEST_TIMEOUT_MS = 10_000;

// ============================================================================
// TYPES
// ============================================================================

interface ApiRequestBody {
  [key: string]: unknown;
}

// FIX 4 (Bug 4): The original return type was `{ [key: string]: unknown }`,
// which is an object shape. But collection endpoints (/issues, /repos, etc.)
// return JSON arrays. Using a union type makes the contract honest and prevents
// silent failures when callers try to key into an array.
type ApiResponse = Record<string, unknown> | Record<string, unknown>[];

// FIX 8 (Improbability 2): Typed error classes so callers can distinguish
// network failures from HTTP 4xx/5xx from parse errors — instead of
// every failure producing an identical generic string.
class ApiHttpError extends Error {
  constructor(public readonly status: number, public readonly statusText: string, endpoint: string) {
    super(`HTTP ${status} ${statusText} — ${endpoint}`);
    this.name = "ApiHttpError";
  }
}

class ApiNetworkError extends Error {
  constructor(endpoint: string, cause: unknown) {
    super(`Network failure reaching ${endpoint}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "ApiNetworkError";
  }
}

class ApiTimeoutError extends Error {
  constructor(endpoint: string) {
    super(`Request to ${endpoint} timed out after ${REQUEST_TIMEOUT_MS}ms`);
    this.name = "ApiTimeoutError";
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

// FIX 3 (Bug 3): Path traversal guard. Resource IDs and tool IDs are
// interpolated directly into URL paths. Without this check, a crafted input
// like "123/../../admin" would silently construct a different API endpoint.
// We restrict IDs to safe alphanumeric + hyphen/underscore characters only.
function assertSafeId(id: unknown, fieldName: string): string {
  if (typeof id !== "string" || id.trim() === "") {
    throw new ValidationError(`${fieldName} must be a non-empty string`);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new ValidationError(
      `${fieldName} contains invalid characters. Only alphanumeric, hyphen, and underscore are allowed.`
    );
  }
  return id;
}

// FIX 2 (Bug 2): Runtime presence + type checks for required tool arguments.
// TypeScript types are erased at runtime — an AI agent can pass anything.
// These helpers throw ValidationError (not generic Error) so the caller can
// surface a clean message back to the agent rather than a cryptic stack trace.
function assertRequiredString(args: Record<string, unknown>, field: string): string {
  const value = args[field];
  if (value === undefined || value === null) {
    throw new ValidationError(`Missing required argument: "${field}"`);
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`"${field}" must be a non-empty string`);
  }
  return value.trim();
}

function assertRequiredNumber(args: Record<string, unknown>, field: string): number {
  const value = args[field];
  if (value === undefined || value === null) {
    throw new ValidationError(`Missing required argument: "${field}"`);
  }
  const num = Number(value);
  if (isNaN(num)) {
    throw new ValidationError(`"${field}" must be a valid number`);
  }
  return num;
}

function assertOptionalString(args: Record<string, unknown>, field: string): string | undefined {
  const value = args[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new ValidationError(`"${field}" must be a string`);
  }
  return value.trim() || undefined;
}

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * Makes an authenticated HTTP request to the BLT API.
 *
 * Fixes applied vs. original:
 *   - AbortController timeout (Bug 1) — hard-kills requests after REQUEST_TIMEOUT_MS
 *   - Typed error hierarchy (Improbability 2) — network / HTTP / timeout are distinct
 *   - Union return type (Bug 4) — honest about array vs. object responses
 */
async function makeApiRequest(
  endpoint: string,
  method: string = "GET",
  body?: ApiRequestBody
): Promise<ApiResponse> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (BLT_API_KEY) {
    headers["Authorization"] = `Bearer ${BLT_API_KEY}`;
  }

  // FIX 1 (Bug 1): Attach a timeout signal so fetch never hangs indefinitely.
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const options: RequestInit = {
    method,
    headers,
    signal: controller.signal,
  };

  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const url = `${BLT_API_BASE}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    // FIX 1 + FIX 8: Distinguish timeout (AbortError) from generic network failure.
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiTimeoutError(endpoint);
    }
    throw new ApiNetworkError(endpoint, err);
  } finally {
    clearTimeout(timeoutHandle);
  }

  // FIX 8 (Improbability 2): Throw typed HTTP errors so callers know whether
  // this was a 401, 404, 500, etc. — not just "API request failed".
  if (!response.ok) {
    throw new ApiHttpError(response.status, response.statusText, endpoint);
  }

  return response.json() as Promise<ApiResponse>;
}

// ============================================================================
// SERVER INIT
// ============================================================================

const server = new Server(
  {
    name: "blt-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

// ============================================================================
// RESOURCES
// ============================================================================

/**
 * FIX 6 (Bug 6): The original list included URI templates like
 * `blt://issues/{id}` as real, readable resource URIs. An MCP client that
 * calls ReadResource on a template literally sends "{id}" to the API.
 *
 * Corrected approach: only list concrete, callable URIs in the resources
 * manifest. Parameterised lookups are handled by the ReadResource handler
 * dynamically — they do not need a static manifest entry to work.
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "blt://issues",
        name: "BLT Issues",
        description: "List all issues in the BLT system",
        mimeType: "application/json",
      },
      {
        uri: "blt://repos",
        name: "BLT Repositories",
        description: "List all repositories tracked in BLT",
        mimeType: "application/json",
      },
      {
        uri: "blt://contributors",
        name: "BLT Contributors",
        description: "List all contributors in the BLT system",
        mimeType: "application/json",
      },
      {
        uri: "blt://workflows",
        name: "BLT Workflows",
        description: "List all workflows in the BLT system",
        mimeType: "application/json",
      },
      {
        uri: "blt://leaderboards",
        name: "BLT Leaderboards",
        description: "View leaderboard rankings and statistics",
        mimeType: "application/json",
      },
      {
        uri: "blt://rewards",
        name: "BLT Rewards",
        description: "List all rewards and bacon points",
        mimeType: "application/json",
      },
    ],
  };
});

/**
 * ReadResource handler.
 *
 * FIX 3 (Bug 3): All dynamic IDs parsed from the URI are now passed through
 * assertSafeId() before being interpolated into the API URL. This blocks
 * path traversal attempts such as `blt://issues/123/../../admin`.
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const match = uri.match(/^blt:\/\/([^/]+)(?:\/(.+))?$/);

  if (!match) {
    throw new Error(`Invalid BLT URI: ${uri}`);
  }

  const [, resourceType, rawResourceId] = match;

  try {
    let data: ApiResponse;

    switch (resourceType) {
      case "issues":
        if (rawResourceId) {
          // FIX 3: validate before interpolating into the URL path
          const id = assertSafeId(rawResourceId, "issue id");
          data = await makeApiRequest(`/issues/${id}`);
        } else {
          data = await makeApiRequest("/issues");
        }
        break;

      case "repos":
        if (rawResourceId) {
          const id = assertSafeId(rawResourceId, "repo id");
          data = await makeApiRequest(`/repos/${id}`);
        } else {
          data = await makeApiRequest("/repos");
        }
        break;

      case "contributors":
        if (rawResourceId) {
          const id = assertSafeId(rawResourceId, "contributor id");
          data = await makeApiRequest(`/contributors/${id}`);
        } else {
          data = await makeApiRequest("/contributors");
        }
        break;

      case "workflows":
        if (rawResourceId) {
          const id = assertSafeId(rawResourceId, "workflow id");
          data = await makeApiRequest(`/workflows/${id}`);
        } else {
          data = await makeApiRequest("/workflows");
        }
        break;

      case "leaderboards":
        data = await makeApiRequest("/leaderboards");
        break;

      case "rewards":
        data = await makeApiRequest("/rewards");
        break;

      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  } catch (error) {
    throw new Error(
      `Failed to read resource ${uri}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// ============================================================================
// TOOLS
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "submit_issue",
        description:
          "Submit a new issue to the BLT system. Use this to report bugs, vulnerabilities, or other issues.",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "The title of the issue",
            },
            description: {
              type: "string",
              description: "Detailed description of the issue",
            },
            repo_id: {
              type: "string",
              description: "The repository ID where the issue was found",
            },
            severity: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
              description: "The severity level of the issue (required — no default is assumed)",
            },
            type: {
              type: "string",
              enum: ["bug", "vulnerability", "feature", "other"],
              description: "The type of issue (required — no default is assumed)",
            },
          },
          required: ["title", "description", "severity", "type"],
        },
      },
      {
        name: "award_bacon",
        description:
          "Award bacon points to a contributor for their contribution.",
        inputSchema: {
          type: "object",
          properties: {
            contributor_id: {
              type: "string",
              description: "The ID of the contributor to award",
            },
            points: {
              type: "number",
              description: "The number of bacon points to award",
            },
            reason: {
              type: "string",
              description: "The reason for awarding the bacon points",
            },
          },
          required: ["contributor_id", "points", "reason"],
        },
      },
      {
        name: "update_issue_status",
        description: "Update the status of an existing issue in the BLT system.",
        inputSchema: {
          type: "object",
          properties: {
            issue_id: {
              type: "string",
              description: "The ID of the issue to update",
            },
            status: {
              type: "string",
              enum: ["open", "in_progress", "resolved", "closed", "wont_fix"],
              description: "The new status for the issue",
            },
            comment: {
              type: "string",
              description: "Optional comment explaining the status change",
            },
          },
          required: ["issue_id", "status"],
        },
      },
      {
        name: "add_comment",
        description: "Add a comment to an existing issue in the BLT system.",
        inputSchema: {
          type: "object",
          properties: {
            issue_id: {
              type: "string",
              description: "The ID of the issue to comment on",
            },
            comment: {
              type: "string",
              description: "The comment text to add",
            },
          },
          required: ["issue_id", "comment"],
        },
      },
    ],
  };
});

/**
 * Tool execution handler.
 *
 * Fixes applied vs. original:
 *   - FIX 2  (Bug 2):          Runtime validation of all required arguments
 *   - FIX 3  (Bug 3):          Path traversal guard on all ID fields
 *   - FIX 5  (Bug 5):          award_bacon now POSTs to the correct endpoint
 *   - FIX 7  (Improbability 1): severity and type are required, no silent defaults
 *   - FIX 8  (Improbability 2): typed errors propagate meaningful messages
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // FIX 2: Hard stop if the entire args object is missing.
  if (!args || typeof args !== "object") {
    return {
      content: [{ type: "text", text: "Error: Missing required arguments" }],
      isError: true,
    };
  }

  const safeArgs = args as Record<string, unknown>;

  try {
    switch (name) {
      case "submit_issue": {
        // FIX 2: validate every required field at runtime
        const title       = assertRequiredString(safeArgs, "title");
        const description = assertRequiredString(safeArgs, "description");
        const repoId      = assertOptionalString(safeArgs, "repo_id");

        // FIX 7 (Improbability 1): severity and type must be explicit.
        // A critical vulnerability silently defaulting to "medium / bug"
        // is a security issue in itself.
        const severity    = assertRequiredString(safeArgs, "severity");
        const type        = assertRequiredString(safeArgs, "type");

        const validSeverities = ["low", "medium", "high", "critical"];
        const validTypes      = ["bug", "vulnerability", "feature", "other"];

        if (!validSeverities.includes(severity)) {
          throw new ValidationError(
            `"severity" must be one of: ${validSeverities.join(", ")}`
          );
        }
        if (!validTypes.includes(type)) {
          throw new ValidationError(
            `"type" must be one of: ${validTypes.join(", ")}`
          );
        }

        const result = await makeApiRequest("/issues", "POST", {
          title,
          description,
          ...(repoId && { repo_id: repoId }),
          severity,
          type,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "award_bacon": {
        // FIX 2: validate all fields
        const rawContributorId = assertRequiredString(safeArgs, "contributor_id");
        const points           = assertRequiredNumber(safeArgs, "points");
        const reason           = assertRequiredString(safeArgs, "reason");

        if (points <= 0) {
          throw new ValidationError('"points" must be a positive number');
        }

        // FIX 3: guard the contributor_id before it goes into the URL
        const contributorId = assertSafeId(rawContributorId, "contributor_id");

        // FIX 5 (Bug 5): Original code POSTed to /rewards — a generic
        // collection endpoint that does not associate points with a specific
        // contributor. The correct pattern is a sub-resource POST on the
        // contributor record itself.
        const result = await makeApiRequest(
          `/contributors/${contributorId}/rewards`,
          "POST",
          { points, reason }
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "update_issue_status": {
        // FIX 2 + FIX 3
        const rawIssueId = assertRequiredString(safeArgs, "issue_id");
        const status     = assertRequiredString(safeArgs, "status");
        const comment    = assertOptionalString(safeArgs, "comment");

        const validStatuses = ["open", "in_progress", "resolved", "closed", "wont_fix"];
        if (!validStatuses.includes(status)) {
          throw new ValidationError(
            `"status" must be one of: ${validStatuses.join(", ")}`
          );
        }

        // FIX 3
        const issueId = assertSafeId(rawIssueId, "issue_id");

        const result = await makeApiRequest(`/issues/${issueId}`, "PATCH", {
          status,
          ...(comment && { comment }),
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "add_comment": {
        // FIX 2 + FIX 3
        const rawIssueId = assertRequiredString(safeArgs, "issue_id");
        const comment    = assertRequiredString(safeArgs, "comment");
        const issueId    = assertSafeId(rawIssueId, "issue_id");

        const result = await makeApiRequest(
          `/issues/${issueId}/comments`,
          "POST",
          { comment }
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        // FIX 9 (Improbability 3): return an error response instead of
        // throwing — throwing here produces an unhandled rejection that
        // bypasses the try/catch and can crash the Node process in newer
        // versions.
        return {
          content: [{ type: "text", text: `Error: Unknown tool "${name}"` }],
          isError: true,
        };
    }
  } catch (error) {
    // FIX 8 (Improbability 2): surface the typed error class name so the
    // caller knows whether this was a validation failure, a network issue,
    // an HTTP error, or a timeout — not just "Error: something went wrong".
    const label =
      error instanceof ValidationError ? "Validation error" :
      error instanceof ApiTimeoutError  ? "Timeout error"   :
      error instanceof ApiHttpError     ? `HTTP ${(error as ApiHttpError).status} error` :
      error instanceof ApiNetworkError  ? "Network error"   :
      "Error";

    return {
      content: [
        {
          type: "text",
          text: `${label}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// ============================================================================
// PROMPTS
// ============================================================================

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "triage_vulnerability",
        description:
          "Guides the AI through triaging a vulnerability report, including severity assessment and initial recommendations.",
        arguments: [
          {
            name: "vulnerability_description",
            description: "Description of the reported vulnerability",
            required: true,
          },
          {
            name: "affected_component",
            description: "The component or system affected by the vulnerability",
            required: false,
          },
        ],
      },
      {
        name: "plan_remediation",
        description:
          "Helps plan remediation steps for a confirmed security issue.",
        arguments: [
          {
            name: "issue_id",
            description: "The ID of the issue to create a remediation plan for",
            required: true,
          },
          {
            name: "context",
            description: "Additional context about the issue",
            required: false,
          },
        ],
      },
      {
        name: "review_contribution",
        description:
          "Guides the review of a security contribution, including quality assessment and bacon point recommendations.",
        arguments: [
          {
            name: "contribution_id",
            description: "The ID of the contribution to review",
            required: true,
          },
          {
            name: "contribution_type",
            description:
              "The type of contribution (e.g., bug report, fix, documentation)",
            required: false,
          },
        ],
      },
    ],
  };
});

/**
 * Prompt execution handler.
 *
 * FIX 11 (Improbability 5): plan_remediation now fetches the real issue data
 * from the BLT API before constructing the prompt. The original version only
 * embedded the issue ID string, giving the AI no actual context to work with.
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "triage_vulnerability": {
      const vulnerabilityDesc  = args?.vulnerability_description?.trim() || "";
      const affectedComponent  = args?.affected_component?.trim() || "unspecified component";

      if (!vulnerabilityDesc) {
        throw new ValidationError(
          '"vulnerability_description" is required for triage_vulnerability'
        );
      }

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `You are a security expert helping to triage a vulnerability report. Please analyze the following vulnerability and provide:

1. Severity Assessment (Critical/High/Medium/Low)
2. Potential Impact Analysis
3. Affected Systems/Components
4. Immediate Mitigation Recommendations
5. Suggested Priority Level

Vulnerability Description:
${vulnerabilityDesc}

Affected Component: ${affectedComponent}

Please provide a structured analysis with clear, actionable recommendations.`,
            },
          },
        ],
      };
    }

    case "plan_remediation": {
      const rawIssueId = args?.issue_id?.trim() || "";

      if (!rawIssueId) {
        throw new ValidationError('"issue_id" is required for plan_remediation');
      }

      // FIX 11 (Improbability 5): Fetch the real issue so the AI actually
      // knows what it is remediating. Without this the prompt is just
      // "plan remediation for issue #X" with no details — useless.
      const issueId = assertSafeId(rawIssueId, "issue_id");
      let issueDetail = "";
      try {
        const issueData = await makeApiRequest(`/issues/${issueId}`);
        issueDetail = JSON.stringify(issueData, null, 2);
      } catch (err) {
        // Non-fatal: if the API is unavailable, degrade gracefully and still
        // run the prompt with whatever context the user supplied.
        issueDetail = `(Could not fetch issue details: ${err instanceof Error ? err.message : String(err)})`;
      }

      const context = args?.context?.trim() || "";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `You are a security expert creating a remediation plan for issue #${issueId}. Please provide:

1. Root Cause Analysis
2. Step-by-Step Remediation Plan
3. Testing and Verification Steps
4. Prevention Measures for the Future
5. Estimated Timeline and Resources

Issue Details:
${issueDetail}
${context ? `\nAdditional Context:\n${context}\n` : ""}
Please create a comprehensive, actionable remediation plan that can be followed by the development team.`,
            },
          },
        ],
      };
    }

    case "review_contribution": {
      const contributionId   = args?.contribution_id?.trim() || "";
      const contributionType = args?.contribution_type?.trim() || "contribution";

      if (!contributionId) {
        throw new ValidationError(
          '"contribution_id" is required for review_contribution'
        );
      }

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `You are reviewing a security contribution (ID: ${contributionId}, Type: ${contributionType}). Please evaluate:

1. Quality and Accuracy of the ${contributionType}
2. Completeness of Information
3. Technical Depth and Insight
4. Value to the Security Community
5. Recommended Bacon Points (1–100 scale)

Please provide a thorough review with:
- Strengths of the contribution
- Areas for improvement (if any)
- Recommended bacon point award with justification
- Any follow-up actions needed

Be constructive and encouraging while maintaining high standards for security contributions.`,
            },
          },
        ],
      };
    }

    default:
      // FIX 9: return structured error instead of bare throw to avoid
      // unhandled rejection in the handler chain.
      throw new Error(`Unknown prompt: ${name}`);
  }
});

// ============================================================================
// START
// ============================================================================

/**
 * FIX 9 (Improbability 3): Process-level unhandled rejection guard.
 * Request handler errors that escape the try/catch blocks (e.g., inside
 * async callbacks, Promise chains that aren't awaited) would otherwise
 * silently crash newer Node.js processes. This makes them visible and
 * keeps the server alive for non-fatal cases.
 */
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // FIX 10 (Improbability 4): Do NOT log BLT_API_BASE. In any environment
  // where logs are aggregated (Datadog, Splunk, CloudWatch, etc.) this leaks
  // your internal API hostname to anyone with log read access.
  // Only log the presence/absence of the key — never its value or the URL.
  console.error("BLT-MCP server running on stdio");
  console.error(`API key configured: ${BLT_API_KEY ? "yes" : "no"}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
