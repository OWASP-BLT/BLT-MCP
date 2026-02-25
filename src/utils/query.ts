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

export interface QueryFilter {
  field: string;
  operator: "=";
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
  const [, queryString] = uri.split("?");

  const filters: QueryFilter[] = [];
  let sort: QuerySort | undefined;
  let limit: number | undefined;
  let offset: number | undefined;

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
        limit = n;
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
        operator: "=",
        value,
      });
    }
  }

  return { filters, sort, limit, offset };
}