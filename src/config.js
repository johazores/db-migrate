const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { MigrationError } = require("./errors");
const {
  parseBoolean,
  parseJson,
  parseList,
  parseNumber,
} = require("./utils");

function loadEnvFile(filePath = path.resolve(".env")) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return values;
}

async function loadConfigFile(configPath) {
  const resolved = path.resolve(configPath);

  if (!fs.existsSync(resolved)) {
    throw new MigrationError(`Configuration file not found: ${resolved}`, {
      code: "CONFIG_NOT_FOUND",
      hint: "Run db-migrate init to create db-migrate.config.js.",
    });
  }

  if (resolved.endsWith(".json")) {
    return JSON.parse(fs.readFileSync(resolved, "utf8"));
  }

  delete require.cache[resolved];

  try {
    const loaded = require(resolved);
    return loaded && loaded.default ? loaded.default : loaded;
  } catch (error) {
    if (error.code !== "ERR_REQUIRE_ESM") {
      throw error;
    }

    const loaded = await import(`${pathToFileURL(resolved).href}?t=${Date.now()}`);
    return loaded.default || loaded;
  }
}

function findConfigPath(explicitPath) {
  if (explicitPath) {
    return explicitPath;
  }

  const candidates = [
    "db-migrate.config.js",
    "db-migrate.config.cjs",
    "db-migrate.config.json",
  ];

  return candidates.find((candidate) => fs.existsSync(path.resolve(candidate)));
}

function envDatabase(prefix) {
  return {
    type: process.env[`DB_MIGRATE_${prefix}_TYPE`],
    url: process.env[`DB_MIGRATE_${prefix}_URL`],
    database: process.env[`DB_MIGRATE_${prefix}_DATABASE`],
    schema: process.env[`DB_MIGRATE_${prefix}_SCHEMA`],
  };
}

function compact(value) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(([, item]) => item !== undefined)
  );
}

function mergeDatabase(...values) {
  return Object.assign({}, ...values.map(compact));
}

function legacyConfig() {
  if (!process.env.SOURCE_MONGODB_URI && !process.env.TARGET_MONGODB_URI) {
    return {};
  }

  return {
    source: {
      type: "mongodb",
      url: process.env.SOURCE_MONGODB_URI,
      database: process.env.DB_NAME,
    },
    target: {
      type: "mongodb",
      url: process.env.TARGET_MONGODB_URI,
      database: process.env.DB_NAME,
    },
    batchSize: process.env.BATCH_SIZE,
    drop: process.env.DROP_TARGET,
  };
}

async function loadConfig(flags = {}, options = {}) {
  loadEnvFile(flags.envFile || options.envFile);

  const configPath = findConfigPath(flags.config);
  const fileConfig = configPath ? await loadConfigFile(configPath) : {};
  const legacy = legacyConfig();

  const envConfig = {
    source: envDatabase("SOURCE"),
    target: envDatabase("TARGET"),
    batchSize: process.env.DB_MIGRATE_BATCH_SIZE,
    resume: process.env.DB_MIGRATE_RESUME,
    strict: process.env.DB_MIGRATE_STRICT,
    entities: process.env.DB_MIGRATE_ENTITIES,
  };

  const flagConfig = {
    source: {
      type: flags.sourceType,
      url: flags.sourceUrl,
      database: flags.sourceDatabase,
      schema: flags.sourceSchema,
    },
    target: {
      type: flags.targetType,
      url: flags.targetUrl,
      database: flags.targetDatabase,
      schema: flags.targetSchema,
    },
    batchSize: flags.batchSize,
    resume: flags.resume,
    strict: flags.strict,
    drop: flags.drop,
    entities: flags.entities,
    filters: flags.filter ? parseJson(flags.filter, "filter JSON") : undefined,
    output: flags.output,
    input: flags.input,
    sampleSize: flags.sampleSize,
  };

  const config = Object.assign(
    {},
    compact(legacy),
    compact(envConfig),
    compact(fileConfig),
    compact(flagConfig),
    {
      source: mergeDatabase(
        legacy.source,
        envConfig.source,
        fileConfig.source,
        flagConfig.source
      ),
      target: mergeDatabase(
        legacy.target,
        envConfig.target,
        fileConfig.target,
        flagConfig.target
      ),
    }
  );

  config.batchSize = parseNumber(config.batchSize, 500);
  config.sampleSize = parseNumber(config.sampleSize, 100);
  config.resume = parseBoolean(config.resume, true);
  config.strict = parseBoolean(config.strict, false);
  config.drop = parseBoolean(config.drop, false);
  config.entities = parseList(config.entities);
  config.filters = config.filters || {};
  config.rename = config.rename || {};
  config.configPath = configPath ? path.resolve(configPath) : undefined;

  if (typeof config.transform !== "function") {
    config.transform = undefined;
  }

  return config;
}

function validateDatabaseConfig(database, label) {
  const supported = new Set(["mongodb", "mysql", "postgres"]);

  if (!database || !database.type) {
    throw new MigrationError(`${label} database type is required`, {
      code: "MISSING_DATABASE_TYPE",
      hint: `Set ${label}.type in db-migrate.config.js or use --${label}-type.`,
    });
  }

  database.type = database.type === "postgresql" ? "postgres" : database.type;

  if (!supported.has(database.type)) {
    throw new MigrationError(
      `Unsupported ${label} database type: ${database.type}`,
      {
        code: "UNSUPPORTED_DATABASE",
        hint: "Supported types are mongodb, mysql, and postgres.",
      }
    );
  }

  if (!database.url) {
    throw new MigrationError(`${label} database URL is required`, {
      code: "MISSING_DATABASE_URL",
      hint: `Set ${label}.url or use --${label}-url.`,
    });
  }

  if (database.type === "mongodb" && !database.database) {
    throw new MigrationError(`${label} MongoDB database name is required`, {
      code: "MISSING_DATABASE_NAME",
      hint: `Set ${label}.database or use --${label}-database.`,
    });
  }

  if (database.type === "postgres" && !database.schema) {
    database.schema = "public";
  }

  return database;
}

function validateConfig(config, command) {
  const sourceCommands = new Set(["migrate", "export", "validate", "diff"]);
  const targetCommands = new Set([
    "migrate",
    "import",
    "validate",
    "diff",
    "seed",
    "rollback",
  ]);

  if (sourceCommands.has(command)) {
    validateDatabaseConfig(config.source, "source");
  }

  if (targetCommands.has(command)) {
    validateDatabaseConfig(config.target, "target");
  }

  return config;
}

module.exports = {
  findConfigPath,
  loadConfig,
  loadConfigFile,
  loadEnvFile,
  validateConfig,
  validateDatabaseConfig,
};
