const fs = require("fs");
const path = require("path");
const { MigrationError } = require("../errors");

const configTemplate = `module.exports = {
  source: {
    type: "mongodb",
    url: process.env.DB_MIGRATE_SOURCE_URL,
    database: process.env.DB_MIGRATE_SOURCE_DATABASE,
  },
  target: {
    type: "postgres",
    url: process.env.DB_MIGRATE_TARGET_URL,
    schema: process.env.DB_MIGRATE_TARGET_SCHEMA || "public",
  },
  batchSize: 500,
  resume: true,
  strict: false,
  entities: [],
  filters: {},
  rename: {},
};
`;

const envTemplate = `DB_MIGRATE_SOURCE_URL=mongodb://localhost:27017
DB_MIGRATE_SOURCE_DATABASE=source_database
DB_MIGRATE_TARGET_URL=postgresql://postgres:postgres@localhost:5432/target_database
DB_MIGRATE_TARGET_SCHEMA=public
`;

async function run({ flags, logger }) {
  const configPath = path.resolve(flags.config || "db-migrate.config.js");
  const envPath = path.resolve(".env");

  if (fs.existsSync(configPath) && !flags.force) {
    throw new MigrationError(`Configuration already exists: ${configPath}`, {
      code: "FILE_EXISTS",
      hint: "Use --force to replace it.",
    });
  }

  const configContent = configPath.endsWith(".json")
    ? `${JSON.stringify(
        {
          source: {
            type: "mongodb",
            url: "mongodb://localhost:27017",
            database: "source_database",
          },
          target: {
            type: "postgres",
            url: "postgresql://postgres:postgres@localhost:5432/target_database",
            schema: "public",
          },
          batchSize: 500,
          resume: true,
          strict: false,
          entities: [],
          filters: {},
          rename: {},
        },
        null,
        2
      )}\n`
    : configTemplate;

  fs.writeFileSync(configPath, configContent);
  const createdEnv = !fs.existsSync(envPath);

  if (createdEnv) {
    fs.writeFileSync(envPath, envTemplate);
  }

  logger.success(`Created ${path.basename(configPath)}`);
  logger.success(createdEnv ? "Created .env" : "Existing .env was preserved");
  logger.info("Update the connection URLs, then run db-migrate validate.");
}

module.exports = {
  run,
};
