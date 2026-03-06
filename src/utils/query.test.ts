import assert from "node:assert";
import { parseQuery } from "./query.js";
import { applyQueryToCollection } from "../index.js";

/* --- Filters --- */

let q = parseQuery("blt://issues");
assert.deepStrictEqual(q.filters, []);

q = parseQuery("blt://issues?severity=high&status=open");
assert.deepStrictEqual(q.filters, [
  { field: "severity", operator: "=", value: "high" },
  { field: "status", operator: "=", value: "open" },
]);

/* --- Sorting --- */

let asc = parseQuery("blt://issues?sort=created_at");
assert.deepStrictEqual(asc.sort, {
  field: "created_at",
  direction: "asc",
});

let desc = parseQuery("blt://issues?sort=-points");
assert.deepStrictEqual(desc.sort, {
  field: "points",
  direction: "desc",
});

/* --- Pagination --- */

q = parseQuery("blt://issues?limit=10&offset=5");
assert.strictEqual(q.limit, 10);
assert.strictEqual(q.offset, 5);

/* --- Limit rules --- */

// clamp
q = parseQuery("blt://issues?limit=9999");
assert.strictEqual(q.limit, 100);

// invalid values ignored
q = parseQuery("blt://issues?limit=abc");
assert.strictEqual(q.limit, undefined);

q = parseQuery("blt://issues?limit=-5");
assert.strictEqual(q.limit, undefined);

q = parseQuery("blt://issues?limit=0");
assert.strictEqual(q.limit, undefined);

/* --- Offset rules --- */

q = parseQuery("blt://issues?offset=-3");
assert.strictEqual(q.offset, undefined);

q = parseQuery("blt://issues?offset=abc");
assert.strictEqual(q.offset, undefined);

q = parseQuery("blt://issues?offset=0");
assert.strictEqual(q.offset, 0);

/* --- Mixed params --- */

q = parseQuery("blt://issues?severity=high&limit=abc&sort=-created_at&offset=10");

assert.deepStrictEqual(q.filters, [
  { field: "severity", operator: "=", value: "high" },
]);

assert.deepStrictEqual(q.sort, {
  field: "created_at",
  direction: "desc",
});

assert.strictEqual(q.limit, undefined);
assert.strictEqual(q.offset, 10);

/* Edge case: additional '?' becomes part of the value */

q = parseQuery("blt://issues?severity=high?extra=dropped");

assert.deepStrictEqual(q.filters, [
  { field: "severity", operator: "=", value: "high?extra=dropped" },
]);

/* --- Collection query application --- */

const issueAllowedFields = new Set([
  "id",
  "severity",
  "status",
  "created_at",
]);

type Issue = {
  id: number;
  severity: string;
  status: string;
  created_at: string;
};

const sampleIssues: Issue[] = [
  { id: 10, severity: "low", status: "open", created_at: "2026-01-10" },
  { id: 2, severity: "high", status: "open", created_at: "2026-01-02" },
  { id: 1, severity: "high", status: "closed", created_at: "2026-01-01" },
];

// Filter with allowlisted field -> returns filtered results
let filtered = applyQueryToCollection(
  sampleIssues,
  "blt://issues?severity=high",
  issueAllowedFields
);
assert.deepStrictEqual(
  filtered.map((item) => item.id),
  [2, 1]
);

// Filter with disallowed field -> throws
assert.throws(
  () =>
    applyQueryToCollection(
      sampleIssues,
      "blt://issues?__proto__=pollute",
      issueAllowedFields
    ),
  /Unsupported filter field: __proto__/
);

// Sort with disallowed field -> throws
assert.throws(
  () =>
    applyQueryToCollection(sampleIssues, "blt://issues?sort=points", issueAllowedFields),
  /Unsupported sort field: points/
);

// Pagination with limit/offset and no sort -> stable ordering by id (numeric)
let paged = applyQueryToCollection(
  sampleIssues,
  "blt://issues?offset=1&limit=1",
  issueAllowedFields
);
assert.deepStrictEqual(
  paged.map((item) => item.id),
  [2]
);

// Empty input array -> returns empty array without error
let empty = applyQueryToCollection([], "blt://issues?limit=5&offset=2", issueAllowedFields);
assert.deepStrictEqual(empty, []);

console.log("✅ query tests passed");