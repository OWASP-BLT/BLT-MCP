import assert from "node:assert";
import { parseQuery } from "./query.js";

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

console.log("✅ query tests passed");