const fs = require("fs");
const path = require("path");
const { createAdapter } = require("../adapters");
const { inferEntity } = require("../schema");
const { deserializeRow } = require("../utils");
const { MigrationError } = require("../errors");

async function loadRows(filePath) {
  const content = fs.readFileSync(filePath, "utf8").trim();

  if (!content) return [];

  if (filePath.endsWith(".json")) {
    const rows = JSON.parse(content);
    return Array.isArray(rows) ? rows : [rows];
  }

  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map(deserializeRow);
}

async function run({ config, logger, flags }) {
  if (!flags.file || !flags.entity) {
    throw new MigrationError("seed requires --file and --entity", {
      code: "MISSING_SEED_INPUT",
      hint: "Example: db-migrate seed --entity users --file seeds/users.ndjson",
    });
  }

  const filePath = path.resolve(flags.file);
  const rows = await loadRows(filePath);

  if (!rows.length) {
    throw new MigrationError(`Seed file is empty: ${filePath}`, {
      code: "EMPTY_SEED",
    });
  }

  const entity = inferEntity(flags.entity, rows, "table");
  const schema = {
    version: 1,
    database: {
      type: "seed",
      name: filePath,
    },
    entities: [entity],
  };
  const target = createAdapter(config.target, logger);
  await target.connect();

  try {
    await target.prepare(schema, {
      dryRun: config.dryRun,
      strict: config.strict,
    });

    let processed = 0;

    for (let index = 0; index < rows.length; index += config.batchSize) {
      const batch = rows.slice(index, index + config.batchSize);
      await target.writeBatch(entity, batch, {
        dryRun: config.dryRun,
        strict: config.strict,
      });
      processed += batch.length;
      logger.progress(entity.name, processed, rows.length);
    }

    logger.success(`Seed complete: ${processed} rows`);
    return { processed };
  } finally {
    await target.disconnect();
  }
}

module.exports = {
  loadRows,
  run,
};
