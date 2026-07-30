const { serializeValue } = require("./utils");
const {
  clearCheckpoint,
  loadCheckpoint,
  saveCheckpoint,
} = require("./state");

async function applyTransform(rows, entity, config) {
  if (!config.transform) {
    return rows;
  }

  const transformed = [];

  for (const row of rows) {
    const result = await config.transform({
      entity: entity.sourceName || entity.name,
      targetEntity: entity.name,
      row,
      source: config.source,
      target: config.target,
    });

    if (result !== null && result !== undefined) {
      transformed.push(result);
    }
  }

  return transformed;
}

async function transferEntities({
  source,
  target,
  schema,
  config,
  logger,
  operation = "migrate",
}) {
  const checkpoint = loadCheckpoint(config, operation);
  const summary = {
    entities: [],
    totalRows: 0,
  };

  for (const entity of schema.entities) {
    const entityState = checkpoint.entities[entity.name] || {
      processed: 0,
      checkpoint: undefined,
      complete: false,
    };
    const resumed = entityState.processed > 0;

    if (entityState.complete) {
      logger.info(`Skipping completed entity ${entity.name}`);
      summary.entities.push({
        name: entity.name,
        rows: entityState.processed,
        resumed: true,
      });
      summary.totalRows += entityState.processed;
      continue;
    }

    const filter = config.filters[entity.sourceName || entity.name] || {};
    let total;

    try {
      total = await source.count(entity, filter);
    } catch {
      total = undefined;
    }

    logger.heading(`Migrating ${entity.sourceName || entity.name} → ${entity.name}`);

    while (true) {
      const batch = await source.readBatch(entity, {
        batchSize: config.batchSize,
        checkpoint: entityState.checkpoint,
        filter,
      });

      if (!batch.rows.length) {
        entityState.complete = true;
        checkpoint.entities[entity.name] = entityState;
        saveCheckpoint(config, checkpoint, operation);
        break;
      }

      const rows = await applyTransform(batch.rows, entity, config);
      await target.writeBatch(entity, rows, {
        dryRun: config.dryRun,
        strict: config.strict,
      });

      entityState.processed += batch.rows.length;
      entityState.checkpoint = serializeValue(batch.nextCheckpoint);
      checkpoint.entities[entity.name] = entityState;
      saveCheckpoint(config, checkpoint, operation);
      logger.progress(entity.name, entityState.processed, total);

      if (batch.done) {
        entityState.complete = true;
        checkpoint.entities[entity.name] = entityState;
        saveCheckpoint(config, checkpoint, operation);
        break;
      }
    }

    summary.entities.push({
      name: entity.name,
      rows: entityState.processed,
      resumed,
    });
    summary.totalRows += entityState.processed;
  }

  if (!config.dryRun) {
    clearCheckpoint(config, operation);
  }

  return summary;
}

module.exports = {
  applyTransform,
  transferEntities,
};
