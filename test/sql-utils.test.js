const test = require("node:test");
const assert = require("node:assert/strict");
const { sqlValue } = require("../src/adapters/sql-utils");

test("serializes unknown portable values as JSON", () => {
  assert.equal(
    sqlValue("custom-enum-value", { type: "unknown" }),
    '"custom-enum-value"'
  );
});

test("preserves portable BSON marker values", () => {
  assert.equal(
    sqlValue({ $objectId: "507f1f77bcf86cd799439011" }, { type: "objectId" }),
    "507f1f77bcf86cd799439011"
  );
});
