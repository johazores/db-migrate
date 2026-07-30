const { createAdapter } = require("../adapters");
const { compareSchemas } = require("../schema");
const { mapSchema, selectEntities } = require("../utils");

async function run({ config, logger, flags }) {
  const source = createAdapter(config.source, logger);
  const target = createAdapter(config.target, logger);

  await Promise.all([source.connect(), target.connect()]);

  try {
    let sourceSchema = await source.inspectSchema({
      sampleSize: config.sampleSize,
    });
    sourceSchema = selectEntities(sourceSchema, config.entities);
    sourceSchema = mapSchema(sourceSchema, config.rename);
    const targetSchema = await target.inspectSchema({
      sampleSize: config.sampleSize,
    });
    const changes = compareSchemas(sourceSchema, targetSchema);

    if (flags.json) {
      process.stdout.write(`${JSON.stringify(changes, null, 2)}\n`);
      return changes;
    }

    if (!changes.length) {
      logger.success("No schema differences found");
      return changes;
    }

    logger.heading(`Schema differences (${changes.length})`);
    for (const change of changes) {
      logger.warn(change.message);
    }

    return changes;
  } finally {
    await Promise.allSettled([source.disconnect(), target.disconnect()]);
  }
}

module.exports = {
  run,
};
