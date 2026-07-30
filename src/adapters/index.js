const { MigrationError } = require("../errors");

const factories = {
  mongodb: () => require("./mongodb"),
  mysql: () => require("./mysql"),
  postgres: () => require("./postgres"),
};

function createAdapter(config, logger) {
  const type = config.type === "postgresql" ? "postgres" : config.type;
  const factory = factories[type];

  if (!factory) {
    throw new MigrationError(`Unsupported database adapter: ${type}`, {
      code: "UNSUPPORTED_DATABASE",
    });
  }

  return factory().create(config, logger);
}

function supportedDatabases() {
  return Object.keys(factories);
}

module.exports = {
  createAdapter,
  supportedDatabases,
};
