const { inferEntity, mergeTypes } = require("../schema");
const { MigrationError } = require("../errors");
const { deserializeValue, serializeValue } = require("../utils");

function requireDriver() {
  try {
    return require("mongodb");
  } catch (error) {
    throw new MigrationError("MongoDB driver is not installed", {
      code: "MISSING_DRIVER",
      hint: "Run npm install mongodb.",
      cause: error,
    });
  }
}

function mongoValue(value, mongodb) {
  if (Array.isArray(value)) {
    return value.map((item) => mongoValue(item, mongodb));
  }

  if (value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    const constructorName = value.constructor && value.constructor.name;

    if (["ObjectId", "Decimal128", "Long"].includes(constructorName)) {
      return value;
    }
    if (Object.hasOwn(value, "$objectId")) {
      return new mongodb.ObjectId(value.$objectId);
    }

    if (Object.hasOwn(value, "$decimal128")) {
      return mongodb.Decimal128.fromString(value.$decimal128);
    }

    if (Object.hasOwn(value, "$long")) {
      return mongodb.Long.fromString(value.$long);
    }

    if (Object.hasOwn(value, "$bigint")) {
      return mongodb.Long.fromString(value.$bigint);
    }

    if (Object.hasOwn(value, "$date")) {
      return new Date(value.$date);
    }

    if (Object.hasOwn(value, "$binary")) {
      return Buffer.from(value.$binary, "base64");
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, mongoValue(item, mongodb)])
    );
  }

  return value;
}

function create(config, logger) {
  const mongodb = requireDriver();
  const client = new mongodb.MongoClient(config.url, {
    serverSelectionTimeoutMS: 30000,
    ...(config.options || {}),
  });
  let database;

  async function connect() {
    try {
      await client.connect();
      database = client.db(config.database);
    } catch (error) {
      throw new MigrationError(`Unable to connect to MongoDB ${config.database}`, {
        code: "CONNECTION_FAILED",
        hint: "Check the URL, database name, network access, and credentials.",
        cause: error,
      });
    }
  }

  async function disconnect() {
    await client.close();
  }

  async function ping() {
    await database.command({ ping: 1 });
  }

  async function listEntityNames() {
    const collections = await database
      .listCollections({}, { nameOnly: true })
      .toArray();

    return collections.map((collection) => collection.name);
  }

  async function inspectSchema(options = {}) {
    const collections = (await database.listCollections().toArray()).filter(
      (collection) => collection.type === "collection"
    );
    const entities = [];

    for (const collectionInfo of collections) {
      const collection = database.collection(collectionInfo.name);
      const rows = await collection
        .find({})
        .limit(options.sampleSize || 100)
        .toArray();
      const entity = inferEntity(collectionInfo.name, rows, "collection");
      const indexes = await collection.indexes();

      if (!entity.columns.length) {
        entity.columns.push({
          name: "_id",
          type: "objectId",
          nullable: false,
          primaryKey: true,
          autoIncrement: false,
          length: 24,
        });
      }

      entity.options = {
        validator: collectionInfo.options && collectionInfo.options.validator,
        validationLevel:
          collectionInfo.options && collectionInfo.options.validationLevel,
        validationAction:
          collectionInfo.options && collectionInfo.options.validationAction,
      };

      const portableIndexes = indexes.filter(
        (index) =>
          index.name !== "_id_" &&
          Object.values(index.key).every((order) => order === 1 || order === -1)
      );
      const unsupportedIndexes = indexes
        .filter(
          (index) =>
            index.name !== "_id_" &&
            !Object.values(index.key).every(
              (order) => order === 1 || order === -1
            )
        )
        .map((index) => index.name);

      entity.indexes = portableIndexes.map((index) => ({
        name: index.name,
        unique: Boolean(index.unique),
        sparse: Boolean(index.sparse),
        columns: Object.entries(index.key).map(([name, order]) => ({
          name,
          order,
        })),
      }));
      entity.options.unsupportedIndexes = unsupportedIndexes;

      if (unsupportedIndexes.length) {
        logger.warn(
          `MongoDB-specific indexes on ${entity.name} require manual migration: ${unsupportedIndexes.join(
            ", "
          )}`
        );
      }

      entities.push(entity);
    }

    return {
      version: 1,
      database: {
        type: "mongodb",
        name: config.database,
      },
      entities,
    };
  }

  async function count(entity, filter = {}) {
    const collection = database.collection(entity.sourceName || entity.name);

    if (!filter || Object.keys(filter).length === 0) {
      return collection.estimatedDocumentCount();
    }

    return collection.countDocuments(filter);
  }

  async function readBatch(entity, options = {}) {
    const collection = database.collection(entity.sourceName || entity.name);
    const filter = { ...(options.filter || {}) };
    const checkpoint = options.checkpoint || {};
    const useOffset = Object.hasOwn(filter, "_id");
    let cursor = collection.find(filter);

    if (useOffset) {
      const offset = Number(checkpoint.value || 0);
      cursor = cursor.skip(offset).limit(options.batchSize);
      const rows = await cursor.toArray();

      return {
        rows,
        done: rows.length < options.batchSize,
        nextCheckpoint: {
          mode: "offset",
          value: offset + rows.length,
        },
      };
    }

    if (checkpoint.value !== undefined) {
      filter._id = {
        $gt: mongoValue(deserializeValue(checkpoint.value), mongodb),
      };
      cursor = collection.find(filter);
    }

    const rows = await cursor
      .sort({ _id: 1 })
      .limit(options.batchSize)
      .toArray();
    const last = rows[rows.length - 1];

    return {
      rows,
      done: rows.length < options.batchSize,
      nextCheckpoint: last
        ? { mode: "keyset", value: serializeValue(last._id) }
        : checkpoint,
    };
  }

  async function prepare(schema, options = {}) {
    const foreignKeys = schema.entities.flatMap((entity) =>
      (entity.foreignKeys || []).map((foreignKey) => ({
        entity: entity.name,
        name: foreignKey.name,
      }))
    );

    if (foreignKeys.length) {
      const names = foreignKeys
        .map((foreignKey) => `${foreignKey.entity}.${foreignKey.name}`)
        .join(", ");

      if (options.strict) {
        throw new MigrationError(
          `MongoDB cannot enforce relational foreign keys: ${names}`,
          { code: "UNSUPPORTED_CONSTRAINT" }
        );
      }

      logger.warn(`MongoDB will not enforce relational foreign keys: ${names}`);
    }

    const existing = new Set(await listEntityNames());
    const existingSelected = schema.entities
      .filter((entity) => existing.has(entity.name) && !options.drop)
      .map((entity) => entity.name);
    const createdEntities = [];

    for (const entity of schema.entities) {
      if (options.drop && existing.has(entity.name)) {
        if (!options.dryRun) {
          await database.collection(entity.name).drop();
        }
        existing.delete(entity.name);
        logger.warn(`${options.dryRun ? "Would drop" : "Dropped"} collection ${entity.name}`);
      }

      if (!existing.has(entity.name)) {
        createdEntities.push(entity.name);
        logger.debug(`${options.dryRun ? "Would create" : "Creating"} collection ${entity.name}`);

        if (!options.dryRun) {
          const collectionOptions = {};
          const sourceOptions = entity.options || {};

          if (sourceOptions.validator) collectionOptions.validator = sourceOptions.validator;
          if (sourceOptions.validationLevel) {
            collectionOptions.validationLevel = sourceOptions.validationLevel;
          }
          if (sourceOptions.validationAction) {
            collectionOptions.validationAction = sourceOptions.validationAction;
          }

          await database.createCollection(entity.name, collectionOptions);
        }
      }
    }

    return {
      createdEntities,
      existingEntities: existingSelected,
    };
  }

  async function writeBatch(entity, rows, options = {}) {
    if (!rows.length || options.dryRun) {
      return rows.length;
    }

    const collection = database.collection(entity.name);
    const primaryKeys = (entity.columns || [])
      .filter((column) => column.primaryKey)
      .map((column) => column.name);

    const operations = rows.map((row) => {
      const document = mongoValue(row, mongodb);
      let filter;

      if (document._id !== undefined) {
        filter = { _id: document._id };
      } else if (primaryKeys.length) {
        filter = Object.fromEntries(
          primaryKeys.map((column) => [column, document[column]])
        );
      }

      if (!filter || Object.values(filter).some((value) => value === undefined)) {
        return {
          insertOne: {
            document,
          },
        };
      }

      return {
        replaceOne: {
          filter,
          replacement: document,
          upsert: true,
        },
      };
    });

    try {
      await collection.bulkWrite(operations, { ordered: false });
      return rows.length;
    } catch (error) {
      throw new MigrationError(`Failed writing collection ${entity.name}`, {
        code: error.code === 11000 ? "DUPLICATE_KEY" : "WRITE_FAILED",
        hint:
          error.code === 11000
            ? "Review unique indexes and source identity values."
            : "Run with --debug for driver details.",
        cause: error,
      });
    }
  }

  async function finalize(schema, options = {}) {
    for (const entity of schema.entities) {
      const collection = database.collection(entity.name);

      for (const index of entity.indexes || []) {
        const key = Object.fromEntries(
          index.columns.map((column) => [column.name, column.order || 1])
        );

        logger.debug(
          `${options.dryRun ? "Would create" : "Creating"} index ${index.name} on ${entity.name}`
        );

        if (!options.dryRun) {
          try {
            await collection.createIndex(key, {
              name: index.name,
              unique: index.unique,
              sparse: index.sparse,
            });
          } catch (error) {
            if (options.strict) {
              throw new MigrationError(
                `Failed creating index ${index.name} on ${entity.name}`,
                {
                  code: "INDEX_FAILED",
                  cause: error,
                }
              );
            }

            logger.warn(
              `Skipped index ${index.name} on ${entity.name}: ${error.message}`
            );
          }
        }
      }
    }
  }

  async function dropEntities(names, options = {}) {
    for (const name of names) {
      logger.warn(`${options.dryRun ? "Would drop" : "Dropping"} collection ${name}`);
      if (!options.dryRun) {
        await database.collection(name).drop().catch((error) => {
          if (error.codeName !== "NamespaceNotFound") throw error;
        });
      }
    }
  }

  return {
    type: "mongodb",
    capabilities: {
      schemas: false,
      foreignKeys: false,
      transactions: true,
      nativeJson: true,
    },
    connect,
    count,
    disconnect,
    dropEntities,
    finalize,
    inspectSchema,
    listEntityNames,
    ping,
    prepare,
    readBatch,
    writeBatch,
  };
}

module.exports = {
  create,
};
