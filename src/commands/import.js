const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { createAdapter } = require("../adapters");
const { deserializeRow, readJson, selectEntities } = require("../utils");
const { loadCheckpoint, saveCheckpoint, clearCheckpoint, writeHistory } = require("../state");
const { MigrationError } = require("../errors");

async function readEntity(filePath, skip, batchSize, onBatch) {
  const input = fs.createReadStream(filePath);
  const lines = readline.createInterface({
    input,
    crlfDelay: Infinity,
  });
  let lineNumber = 0;
  let batch = [];

  for await (const line of lines) {
    if (!line.trim()) continue;
    lineNumber += 1;

    if (lineNumber <= skip) {
      continue;
    }

    batch.push(deserializeRow(line));

    if (batch.length >= batchSize) {
      await onBatch(batch, lineNumber);
      batch = [];
    }
  }

  if (batch.length) {
    await onBatch(batch, lineNumber);
  }

  return lineNumber;
}

async function run({ config, logger }) {
  const inputDirectory = path.resolve(config.input || "");
  const manifestPath = path.join(inputDirectory, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    throw new MigrationError(`Export manifest not found: ${manifestPath}`, {
      code: "MANIFEST_NOT_FOUND",
      hint: "Use --input with a directory created by db-migrate export.",
    });
  }

  const manifest = readJson(manifestPath);
  let schema = selectEntities(manifest.schema, config.entities);
  const target = createAdapter(config.target, logger);
  await target.connect();

  try {
    const preparation = await target.prepare(schema, {
      drop: config.drop,
      dryRun: config.dryRun,
      strict: config.strict,
    });
    const checkpoint = config.dryRun
      ? { operation: "import", entities: {} }
      : loadCheckpoint(config, "import");
    let totalRows = 0;

    for (const entity of schema.entities) {
      const manifestEntity = manifest.entities.find(
        (item) => item.name === entity.name
      );

      if (!manifestEntity) {
        logger.warn(`No data file listed for ${entity.name}`);
        continue;
      }

      const entityState = checkpoint.entities[entity.name] || {
        processed: 0,
        complete: false,
      };

      if (entityState.complete) {
        totalRows += entityState.processed;
        continue;
      }

      const filePath = path.join(inputDirectory, manifestEntity.dataFile);

      await readEntity(
        filePath,
        entityState.processed,
        config.batchSize,
        async (rows, lineNumber) => {
          await target.writeBatch(entity, rows, {
            dryRun: config.dryRun,
            strict: config.strict,
          });
          entityState.processed = lineNumber;
          checkpoint.entities[entity.name] = entityState;
          if (!config.dryRun) {
            saveCheckpoint(config, checkpoint, "import");
          }
          logger.progress(entity.name, entityState.processed, manifestEntity.rows);
        }
      );

      entityState.complete = true;
      checkpoint.entities[entity.name] = entityState;
      if (!config.dryRun) {
        saveCheckpoint(config, checkpoint, "import");
      }
      totalRows += entityState.processed;
    }

    await target.finalize(schema, {
      dryRun: config.dryRun,
      strict: config.strict,
    });

    if (!config.dryRun) {
      clearCheckpoint(config, "import");
      writeHistory(config, {
        operation: "import",
        input: inputDirectory,
        schema,
        createdEntities: preparation.createdEntities,
        existingEntities: preparation.existingEntities,
        summary: {
          totalRows,
        },
        destructive: config.drop,
      });
    }

    logger.success(`Import complete: ${totalRows} rows`);
    return { totalRows };
  } finally {
    await target.disconnect();
  }
}

module.exports = {
  readEntity,
  run,
};
