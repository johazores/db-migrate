const { createAdapter } = require("../adapters");
const { latestHistory } = require("../state");
const { maskUrl, writeJson } = require("../utils");
const { MigrationError } = require("../errors");

async function run({ config, logger, flags }) {
  const latest = latestHistory(config, flags.operation || "migrate");

  if (!latest) {
    throw new MigrationError("No migration history is available to roll back", {
      code: "NO_HISTORY",
    });
  }

  const expectedTarget = latest.history.target || {};
  const currentTarget = config.target || {};

  if (
    expectedTarget.type !== currentTarget.type ||
    expectedTarget.url !== maskUrl(currentTarget.url)
  ) {
    throw new MigrationError(
      "The latest migration history belongs to a different target database",
      {
        code: "TARGET_MISMATCH",
        hint: "Use the same target configuration that was used for the migration.",
      }
    );
  }

  if (latest.history.destructive) {
    throw new MigrationError(
      "Migrations run with --drop cannot be rolled back automatically",
      {
        code: "ROLLBACK_UNSAFE",
        hint: "Restore the previous target data from a backup.",
      }
    );
  }

  const names = latest.history.createdEntities || [];

  if (!names.length) {
    throw new MigrationError(
      "The latest migration changed existing entities and cannot be safely rolled back automatically",
      {
        code: "ROLLBACK_UNSAFE",
        hint: "Restore from a database backup or reverse the changes manually.",
      }
    );
  }

  if (!flags.yes && !config.dryRun) {
    throw new MigrationError(
      `Rollback would drop ${names.length} entities: ${names.join(", ")}`,
      {
        code: "CONFIRMATION_REQUIRED",
        hint: "Review the list and run again with --yes.",
      }
    );
  }

  if ((latest.history.existingEntities || []).length) {
    logger.warn(
      "Only newly created entities will be removed. Changes to existing entities are not reversible."
    );
  }

  const target = createAdapter(config.target, logger);
  await target.connect();

  try {
    await target.dropEntities(names, {
      dryRun: config.dryRun,
    });

    if (!config.dryRun) {
      latest.history.rolledBackAt = new Date().toISOString();
      writeJson(latest.filePath, latest.history);
    }

    logger.success(`${config.dryRun ? "Rollback preview" : "Rollback"} complete`);
    return { dropped: names };
  } finally {
    await target.disconnect();
  }
}

module.exports = {
  run,
};
