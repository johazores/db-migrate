const { createAdapter } = require("../adapters");
const { mapSchema, selectEntities } = require("../utils");
const { transferEntities } = require("../transfer");
const { writeHistory } = require("../state");

async function run({ config, logger }) {
  const source = createAdapter(config.source, logger);
  const target = createAdapter(config.target, logger);

  await source.connect();
  await target.connect();

  try {
    let schema = await source.inspectSchema({
      sampleSize: config.sampleSize,
    });
    schema = selectEntities(schema, config.entities);
    schema = mapSchema(schema, config.rename);

    logger.heading(
      `${config.dryRun ? "Dry run: " : ""}${config.source.type} → ${config.target.type}`
    );
    logger.info(`${schema.entities.length} entities selected`);

    const preparation = await target.prepare(schema, {
      drop: config.drop,
      dryRun: config.dryRun,
      strict: config.strict,
    });

    let summary;

    if (config.dryRun) {
      const entities = [];
      let totalRows = 0;

      for (const entity of schema.entities) {
        const filter = config.filters[entity.sourceName || entity.name] || {};
        const rows = await source.count(entity, filter).catch(() => undefined);
        entities.push({ name: entity.name, rows });

        if (Number.isFinite(rows)) {
          totalRows += rows;
        }
      }

      summary = { entities, totalRows };
    } else {
      summary = await transferEntities({
        source,
        target,
        schema,
        config,
        logger,
        operation: "migrate",
      });
    }

    await target.finalize(schema, {
      dryRun: config.dryRun,
      strict: config.strict,
    });

    if (!config.dryRun) {
      writeHistory(config, {
        operation: "migrate",
        schema,
        createdEntities: preparation.createdEntities,
        existingEntities: preparation.existingEntities,
        summary,
        destructive: config.drop,
      });
    }

    logger.success(
      `${config.dryRun ? "Dry run complete" : "Migration complete"}: ${
        summary.totalRows
      } rows`
    );

    return summary;
  } finally {
    await Promise.allSettled([source.disconnect(), target.disconnect()]);
  }
}

module.exports = {
  run,
};
