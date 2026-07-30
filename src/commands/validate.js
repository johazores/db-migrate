const { createAdapter } = require("../adapters");
const { maskUrl } = require("../utils");

async function connectAndValidate(label, database, logger) {
  const adapter = createAdapter(database, logger);
  logger.info(`Connecting to ${label} ${database.type}: ${maskUrl(database.url)}`);

  await adapter.connect();

  try {
    await adapter.ping();
    const names = await adapter.listEntityNames();
    logger.success(`${label} connection is valid (${names.length} entities)`);

    return {
      adapter,
      result: {
        type: adapter.type,
        entities: names.length,
        capabilities: adapter.capabilities,
      },
    };
  } catch (error) {
    await adapter.disconnect();
    throw error;
  }
}

async function run({ config, logger }) {
  const source = await connectAndValidate("source", config.source, logger);
  let target;

  try {
    target = await connectAndValidate("target", config.target, logger);

    logger.heading("Validation summary");
    logger.info(
      `${source.result.type} → ${target.result.type}, batch size ${config.batchSize}`
    );

    if (
      source.result.capabilities.foreignKeys &&
      !target.result.capabilities.foreignKeys
    ) {
      logger.warn("Target does not enforce relational foreign keys.");
    }

    if (config.resume) {
      logger.success("Resumable checkpoints are enabled");
    }

    return {
      source: source.result,
      target: target.result,
    };
  } finally {
    await source.adapter.disconnect();
    if (target) await target.adapter.disconnect();
  }
}

module.exports = {
  run,
};
