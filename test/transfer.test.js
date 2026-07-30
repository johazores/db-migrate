const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { transferEntities } = require("../src/transfer");

test("transfers rows in batches with a lightweight adapter interface", async () => {
  const written = [];
  const batches = [
    { rows: [{ id: 1 }, { id: 2 }], done: false, nextCheckpoint: { value: 2 } },
    { rows: [{ id: 3 }], done: true, nextCheckpoint: { value: 3 } },
  ];

  const source = {
    async count() {
      return 3;
    },
    async readBatch() {
      return batches.shift() || { rows: [], done: true };
    },
  };
  const target = {
    async writeBatch(entity, rows) {
      written.push(...rows);
    },
  };
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "db-migrate-state-"));
  const config = {
    source: { type: "fake", url: "fake://source" },
    target: { type: "fake", url: "fake://target" },
    stateDirectory: directory,
    batchSize: 2,
    filters: {},
    entities: [],
    rename: {},
    resume: true,
    dryRun: false,
  };
  const logger = {
    heading() {},
    info() {},
    progress() {},
  };

  const summary = await transferEntities({
    source,
    target,
    schema: {
      entities: [
        {
          name: "users",
          sourceName: "users",
          columns: [{ name: "id", primaryKey: true }],
        },
      ],
    },
    config,
    logger,
  });

  assert.deepEqual(written, [{ id: 1 }, { id: 2 }, { id: 3 }]);
  assert.equal(summary.totalRows, 3);
});
