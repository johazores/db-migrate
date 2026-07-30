const fs = require("fs");
const path = require("path");
const {
  ensureDirectory,
  hash,
  maskUrl,
  readJson,
  serializeValue,
  writeJson,
} = require("./utils");

function stateDirectory(config) {
  return path.resolve(config.stateDirectory || ".db-migrate");
}

function migrationId(config, operation = "migrate") {
  return hash(
    JSON.stringify({
      operation,
      source: config.source && {
        type: config.source.type,
        url: config.source.url,
        database: config.source.database,
        schema: config.source.schema,
      },
      target: config.target && {
        type: config.target.type,
        url: config.target.url,
        database: config.target.database,
        schema: config.target.schema,
      },
      entities: config.entities,
      rename: config.rename,
      filters: config.filters,
      input: config.input,
      output: config.output,
      drop: config.drop,
      transform: config.transform ? String(config.transform) : undefined,
    })
  );
}

function checkpointPath(config, operation = "migrate") {
  return path.join(
    stateDirectory(config),
    "checkpoints",
    `${operation}-${migrationId(config, operation)}.json`
  );
}

function loadCheckpoint(config, operation = "migrate") {
  const filePath = checkpointPath(config, operation);

  if (!config.resume || !fs.existsSync(filePath)) {
    return {
      operation,
      entities: {},
    };
  }

  return readJson(filePath);
}

function saveCheckpoint(config, checkpoint, operation = "migrate") {
  writeJson(checkpointPath(config, operation), serializeValue(checkpoint));
}

function clearCheckpoint(config, operation = "migrate") {
  const filePath = checkpointPath(config, operation);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function writeHistory(config, value) {
  const directory = ensureDirectory(path.join(stateDirectory(config), "history"));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(directory, `${timestamp}-${value.operation}.json`);

  const history = {
    version: 1,
    createdAt: new Date().toISOString(),
    source: config.source
      ? {
          ...config.source,
          url: maskUrl(config.source.url),
          options: undefined,
        }
      : undefined,
    target: config.target
      ? {
          ...config.target,
          url: maskUrl(config.target.url),
          options: undefined,
        }
      : undefined,
    ...value,
  };

  writeJson(filePath, history);
  return filePath;
}

function latestHistory(config, operation = "migrate") {
  const directory = path.join(stateDirectory(config), "history");

  if (!fs.existsSync(directory)) {
    return undefined;
  }

  const files = fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .reverse();

  for (const file of files) {
    const history = readJson(path.join(directory, file));
    if (history.operation === operation && !history.rolledBackAt) {
      return {
        filePath: path.join(directory, file),
        history,
      };
    }
  }

  return undefined;
}

module.exports = {
  checkpointPath,
  clearCheckpoint,
  latestHistory,
  loadCheckpoint,
  migrationId,
  saveCheckpoint,
  stateDirectory,
  writeHistory,
};
