const test = require("node:test");
const assert = require("node:assert/strict");
const {
  compareSchemas,
  inferColumns,
  mysqlType,
  postgresType,
} = require("../src/schema");

test("infers portable columns from mixed documents", () => {
  const columns = inferColumns([
    { _id: "507f1f77bcf86cd799439011", name: "Ada", active: true },
    { _id: "507f191e810c19729de860ea", name: "Grace", profile: { role: "admin" } },
  ]);

  const byName = new Map(columns.map((column) => [column.name, column]));
  assert.equal(byName.get("_id").type, "objectId");
  assert.equal(byName.get("_id").primaryKey, true);
  assert.equal(byName.get("active").nullable, true);
  assert.equal(byName.get("profile").type, "json");
});

test("maps canonical types to SQL", () => {
  assert.equal(mysqlType({ type: "objectId" }), "VARCHAR(24)");
  assert.equal(postgresType({ type: "json" }), "JSONB");
});

test("diff reports missing columns and type mismatches", () => {
  const source = {
    entities: [
      {
        name: "users",
        columns: [
          { name: "id", type: "integer" },
          { name: "email", type: "string" },
        ],
      },
    ],
  };
  const target = {
    entities: [
      {
        name: "users",
        columns: [{ name: "id", type: "bigint" }],
      },
    ],
  };

  const changes = compareSchemas(source, target);
  assert.equal(changes.length, 2);
  assert.equal(changes[0].type, "type_mismatch");
  assert.equal(changes[1].type, "missing_column");
});


test("maps incompatible document field types to JSON", () => {
  const columns = inferColumns([
    { value: true },
    { value: 42 },
  ]);

  assert.equal(columns[0].type, "json");
});
