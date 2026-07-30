const test = require("node:test");
const assert = require("node:assert/strict");
const { parseArguments } = require("../src/cli");

test("parses command and migration flags", () => {
  const parsed = parseArguments([
    "migrate",
    "--source-type",
    "mongodb",
    "--target-type=postgres",
    "--dry-run",
    "-e",
    "users,posts",
  ]);

  assert.equal(parsed.command, "migrate");
  assert.equal(parsed.flags.sourceType, "mongodb");
  assert.equal(parsed.flags.targetType, "postgres");
  assert.equal(parsed.flags.dryRun, true);
  assert.equal(parsed.flags.entities, "users,posts");
});

test("--no-resume disables resume", () => {
  const parsed = parseArguments(["migrate", "--no-resume"]);
  assert.equal(parsed.flags.resume, false);
});
