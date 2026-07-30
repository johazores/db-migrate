const fs = require("fs");
const path = require("path");
const { createAdapter } = require("../adapters");
const { mapSchema, safeFileName, selectEntities, serializeRow, writeJson, writeLine, ensureDirectory } = require("../utils");
const { loadCheckpoint, saveCheckpoint, clearCheckpoint } = require("../state");
const { applyTransform } = require("../transfer");

function defaultOutput() {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
  return `db-export-${timestamp}`;
}

async function run({ config, logger }) {
  const source = createAdapter(config.source, logger);
  await source.connect();

  try {
    let schema = await source.inspectSchema({
      sampleSize: config.sampleSize,
    });
    schema = selectEntities(schema, config.entities);
    schema = mapSchema(schema, config.rename);

    const output = path.resolve(config.output || defaultOutput());
    config.output = output;
    ensureDirectory(path.join(output, "data"));
    const checkpoint = loadCheckpoint(config, "export");
    const manifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      source: schema.database,
      schema,
      entities: [],
    };

    for (const entity of schema.entities) {
      const dataFile = path.join("data", `${safeFileName(entity.name)}.ndjson`);
      const absoluteFile = path.join(output, dataFile);
      const entityState = checkpoint.entities[entity.name] || {
        processed: 0,
        checkpoint: undefined,
        complete: false,
        written: 0,
      };
      entityState.written = Number(entityState.written || 0);

      const stream = fs.createWriteStream(absoluteFile, {
        flags: entityState.processed > 0 ? "a" : "w",
      });
      const filter = config.filters[entity.sourceName || entity.name] || {};

      try {
        while (!entityState.complete) {
          const batch = await source.readBatch(entity, {
            batchSize: config.batchSize,
            checkpoint: entityState.checkpoint,
            filter,
          });

          const rows = await applyTransform(batch.rows, entity, config);

          for (const row of rows) {
            await writeLine(stream, serializeRow(row));
          }

          entityState.processed += batch.rows.length;
          entityState.written += rows.length;
          entityState.checkpoint = batch.nextCheckpoint;
          entityState.complete = batch.done || batch.rows.length === 0;
          checkpoint.entities[entity.name] = entityState;
          saveCheckpoint(config, checkpoint, "export");
          logger.progress(entity.name, entityState.processed);

          if (!batch.rows.length) break;
        }
      } finally {
        await new Promise((resolve, reject) => {
          stream.once("error", reject);
          stream.end(resolve);
        });
      }

      manifest.entities.push({
        name: entity.name,
        dataFile,
        rows: entityState.written,
        sourceRows: entityState.processed,
      });
    }

    writeJson(path.join(output, "manifest.json"), manifest);
    clearCheckpoint(config, "export");
    logger.success(`Export complete: ${output}`);

    return {
      output,
      manifest,
    };
  } finally {
    await source.disconnect();
  }
}

module.exports = {
  run,
};
