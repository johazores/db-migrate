const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { loadCheckpoint, saveCheckpoint } = require("../src/state");

test("checkpoint files preserve database-specific identity values", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "db-migrate-checkpoint-"));
  const config = {
    source: { type: "mongodb", url: "mongodb://source", database: "app" },
    target: { type: "postgres", url: "postgresql://target/app" },
    stateDirectory: directory,
    resume: true,
    entities: [],
    rename: {},
    filters: {},
  };
  const objectId = {
    constructor: { name: "ObjectId" },
    toHexString() {
      return "507f1f77bcf86cd799439011";
    },
  };

  saveCheckpoint(config, {
    operation: "export",
    entities: { users: { checkpoint: { value: objectId } } },
  }, "export");

  const checkpoint = loadCheckpoint(config, "export");
  assert.deepEqual(checkpoint.entities.users.checkpoint.value, {
    $objectId: "507f1f77bcf86cd799439011",
  });
});
