const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { run } = require("../src/commands/init");

test("init creates a valid JSON configuration", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "db-migrate-init-"));
  const previous = process.cwd();
  process.chdir(directory);

  try {
    await run({
      flags: { config: "db-migrate.config.json" },
      logger: { success() {}, info() {} },
    });

    const config = JSON.parse(
      fs.readFileSync(path.join(directory, "db-migrate.config.json"), "utf8")
    );
    assert.equal(config.source.type, "mongodb");
    assert.equal(config.target.type, "postgres");
    assert.match(config.source.url, /^mongodb:/);
    assert.ok(fs.existsSync(path.join(directory, ".env")));
  } finally {
    process.chdir(previous);
  }
});
