/**
 * Query parsing utility for BLT-MCP resource URIs.
 *
 * Supports:
 * - Equality filtering: field=value
 * - Sorting: sort=field or sort=-field
 * - Pagination: limit, offset
 *
 * Example:
 * blt://issues?severity=high&status=open&sort=-created_at&limit=10
 */

/**
 * QueryFilter: Used for equality filtering (field=value).
 * The operator field is reserved for future extensibility (e.g., >, <, !=).
 */
export interface QueryFilter {
  field: string;
  operator: "="; // Reserved for future: >, <, !=, etc.
  value: string;
}

export interface QuerySort {
  field: string;
  direction: "asc" | "desc";
}

export interface ParsedQuery {
  filters: QueryFilter[];
  sort?: QuerySort;
  limit?: number;
  offset?: number;
}

/**
 * Parses a BLT-MCP resource URI and extracts query parameters.
 *
 * @param uri Full resource URI (e.g., blt://issues?severity=high&sort=-created_at)
 * @returns ParsedQuery object
 */
export function parseQuery(uri: string): ParsedQuery {
  // Preserve everything after the first '?' to avoid silently dropping params.
  const queryString = uri.split("?").slice(1).join("?") ?? "";

  const filters: QueryFilter[] = [];
  let sort: QuerySort | undefined;
  let limit: number | undefined;
  let offset: number | undefined;
  const MAX_LIMIT = 100;

  if (!queryString) {
    return { filters };
  }

  const params = new URLSearchParams(queryString);

  for (const [key, value] of params.entries()) {
    if (key === "sort") {
      // sort=-field (desc) or sort=field (asc)
      if (value.startsWith("-")) {
        sort = {
          field: value.slice(1),
          direction: "desc",
        };
      } else {
        sort = {
          field: value,
          direction: "asc",
        };
      }
    } else if (key === "limit") {
      const n = Number(value);
      if (!isNaN(n) && n > 0) {
        // Clamp limit to MAX_LIMIT
        limit = Math.min(n, MAX_LIMIT);
      }
    } else if (key === "offset") {
      const n = Number(value);
      if (!isNaN(n) && n >= 0) {
        offset = n;
      }
    } else {
      // Default equality filter: field=value
      filters.push({
        field: key,
        operator: "=", // Reserved for future: >, <, !=, etc.
        value,
      });
    }
  }

  return { filters, sort, limit, offset };
}