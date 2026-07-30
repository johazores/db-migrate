const { createAdapter, supportedDatabases } = require("./adapters");
const { loadConfig, validateConfig } = require("./config");
const { compareSchemas, inferEntity } = require("./schema");
const { transferEntities } = require("./transfer");

module.exports = {
  compareSchemas,
  createAdapter,
  inferEntity,
  loadConfig,
  supportedDatabases,
  transferEntities,
  validateConfig,
};
