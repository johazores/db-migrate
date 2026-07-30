const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { loadConfig, loadEnvFile } = require("../src/config");

test("loads simple env files without a dependency", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "db-migrate-env-"));
  const envPath = path.join(directory, ".env");
  fs.writeFileSync(envPath, 'TEST_DB_MIGRATE_VALUE="hello"\n');

  const values = loadEnvFile(envPath);
  assert.equal(values.TEST_DB_MIGRATE_VALUE, "hello");
});

test("CLI flags override environment values", async () => {
  const previous = process.env.DB_MIGRATE_BATCH_SIZE;
  process.env.DB_MIGRATE_BATCH_SIZE = "100";

  try {
    const config = await loadConfig({
      batchSize: "25",
      sourceType: "mongodb",
      sourceUrl: "mongodb://localhost",
      sourceDatabase: "source",
      targetType: "postgres",
      targetUrl: "postgresql://localhost/target",
    });

    assert.equal(config.batchSize, 25);
    assert.equal(config.source.type, "mongodb");
    assert.equal(config.target.schema, undefined);
  } finally {
    if (previous === undefined) {
      delete process.env.DB_MIGRATE_BATCH_SIZE;
    } else {
      process.env.DB_MIGRATE_BATCH_SIZE = previous;
    }
  }
});


test("preserves config file values while applying CLI overrides", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "db-migrate-config-"));
  const configPath = path.join(directory, "db-migrate.config.json");
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      source: {
        type: "mongodb",
        url: "mongodb://config-source",
        database: "app",
      },
      target: {
        type: "mysql",
        url: "mysql://root@localhost/config_target",
      },
      filters: { users: { active: true } },
      rename: { users: "customers" },
      batchSize: 200,
    })
  );

  const config = await loadConfig({
    config: configPath,
    targetType: "postgres",
    targetUrl: "postgresql://localhost/target",
  });

  assert.equal(config.source.database, "app");
  assert.equal(config.target.type, "postgres");
  assert.deepEqual(config.filters, { users: { active: true } });
  assert.deepEqual(config.rename, { users: "customers" });
  assert.equal(config.batchSize, 200);
});
