const { canonicalType, mysqlType } = require("../schema");
const { MigrationError } = require("../errors");
const {
  buildFilter,
  primaryKeys,
  safeDefault,
  sqlValue,
} = require("./sql-utils");

function requireDriver() {
  try {
    return require("mysql2/promise");
  } catch (error) {
    throw new MigrationError("MySQL driver is not installed", {
      code: "MISSING_DRIVER",
      hint: "Run npm install mysql2.",
      cause: error,
    });
  }
}

function quote(value) {
  return `\`${String(value).replace(/`/g, "``")}\``;
}

function create(config, logger) {
  const mysql = requireDriver();
  const connectionUrl = new URL(config.url);
  const pool = mysql.createPool({
    host: connectionUrl.hostname,
    port: connectionUrl.port ? Number(connectionUrl.port) : 3306,
    user: decodeURIComponent(connectionUrl.username),
    password: decodeURIComponent(connectionUrl.password),
    database:
      config.database ||
      decodeURIComponent(connectionUrl.pathname.replace(/^\//, "")),
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: false,
    connectionLimit: 4,
    ...(config.options || {}),
  });
  let databaseName =
    config.database ||
    decodeURIComponent(connectionUrl.pathname.replace(/^\//, ""));

  async function connect() {
    try {
      const [rows] = await pool.query("SELECT DATABASE() AS database_name");
      databaseName = databaseName || rows[0].database_name;

      if (!databaseName) {
        throw new Error("No database selected");
      }
    } catch (error) {
      throw new MigrationError("Unable to connect to MySQL", {
        code: "CONNECTION_FAILED",
        hint: "Check the URL, selected database, network access, and credentials.",
        cause: error,
      });
    }
  }

  async function disconnect() {
    await pool.end();
  }

  async function ping() {
    await pool.query("SELECT 1");
  }

  async function listEntityNames() {
    const [rows] = await pool.query(
      `SELECT TABLE_NAME AS name
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [databaseName]
    );

    return rows.map((row) => row.name);
  }

  async function inspectSchema() {
    const names = await listEntityNames();
    const entities = [];

    for (const name of names) {
      const [columns] = await pool.query(
        `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE,
                COLUMN_DEFAULT, COLUMN_KEY, EXTRA,
                CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [databaseName, name]
      );

      const [indexes] = await pool.query(
        `SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX, COLLATION,
                INDEX_TYPE, SUB_PART
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
        [databaseName, name]
      );

      const [foreignKeys] = await pool.query(
        `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME,
                REFERENCED_COLUMN_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
           AND REFERENCED_TABLE_NAME IS NOT NULL
         ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION`,
        [databaseName, name]
      );

      const groupedIndexes = new Map();
      const unsupportedIndexes = new Set();

      for (const index of indexes) {
        if (index.INDEX_NAME === "PRIMARY") continue;

        if (index.INDEX_TYPE !== "BTREE" || index.SUB_PART !== null) {
          unsupportedIndexes.add(index.INDEX_NAME);
          continue;
        }

        const current = groupedIndexes.get(index.INDEX_NAME) || {
          name: index.INDEX_NAME,
          unique: index.NON_UNIQUE === 0,
          columns: [],
        };
        current.columns.push({
          name: index.COLUMN_NAME,
          order: index.COLLATION === "D" ? -1 : 1,
        });
        groupedIndexes.set(index.INDEX_NAME, current);
      }

      const groupedForeignKeys = new Map();
      for (const foreignKey of foreignKeys) {
        const current = groupedForeignKeys.get(foreignKey.CONSTRAINT_NAME) || {
          name: foreignKey.CONSTRAINT_NAME,
          columns: [],
          referencedEntity: foreignKey.REFERENCED_TABLE_NAME,
          referencedColumns: [],
        };
        current.columns.push(foreignKey.COLUMN_NAME);
        current.referencedColumns.push(foreignKey.REFERENCED_COLUMN_NAME);
        groupedForeignKeys.set(foreignKey.CONSTRAINT_NAME, current);
      }

      entities.push({
        name,
        sourceName: name,
        kind: "table",
        columns: columns.map((column) => ({
          name: column.COLUMN_NAME,
          nativeType: column.COLUMN_TYPE,
          type: canonicalType("mysql", column.DATA_TYPE, {
            columnType: column.COLUMN_TYPE,
            length: column.CHARACTER_MAXIMUM_LENGTH,
          }),
          nullable: column.IS_NULLABLE === "YES",
          defaultValue: column.COLUMN_DEFAULT,
          primaryKey: column.COLUMN_KEY === "PRI",
          autoIncrement: String(column.EXTRA).includes("auto_increment"),
          length: column.CHARACTER_MAXIMUM_LENGTH
            ? Number(column.CHARACTER_MAXIMUM_LENGTH)
            : undefined,
          precision: column.NUMERIC_PRECISION
            ? Number(column.NUMERIC_PRECISION)
            : undefined,
          scale: column.NUMERIC_SCALE
            ? Number(column.NUMERIC_SCALE)
            : undefined,
        })),
        indexes: [...groupedIndexes.values()],
        foreignKeys: [...groupedForeignKeys.values()],
        options: {
          unsupportedIndexes: [...unsupportedIndexes],
        },
      });

      if (unsupportedIndexes.size) {
        logger.warn(
          `MySQL-specific indexes on ${name} require manual migration: ${[
            ...unsupportedIndexes,
          ].join(", ")}`
        );
      }
    }

    return {
      version: 1,
      database: {
        type: "mysql",
        name: databaseName,
      },
      entities,
    };
  }

  async function count(entity, filter = {}) {
    const where = buildFilter(filter, quote, () => "?");
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS total FROM ${quote(entity.sourceName || entity.name)}${
        where.sql ? ` WHERE ${where.sql}` : ""
      }`,
      where.values
    );
    return Number(rows[0].total);
  }

  async function readBatch(entity, options = {}) {
    const keys = primaryKeys(entity);
    const key = keys.length === 1 ? keys[0] : null;
    const where = buildFilter(options.filter, quote, () => "?");
    const values = [...where.values];
    const clauses = where.sql ? [where.sql] : [];
    const checkpoint = options.checkpoint || { mode: key ? "keyset" : "offset", value: 0 };

    if (key && checkpoint.value !== undefined && checkpoint.value !== 0) {
      clauses.push(`${quote(key)} > ?`);
      const keyColumn = (entity.columns || []).find(
        (column) => column.name === key
      );
      values.push(sqlValue(checkpoint.value, keyColumn));
    }

    const order = key ? ` ORDER BY ${quote(key)}` : "";
    const offset = !key ? Number(checkpoint.value || 0) : 0;
    const sql = `SELECT * FROM ${quote(entity.sourceName || entity.name)}${
      clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""
    }${order} LIMIT ${Number(options.batchSize)}${
      !key ? ` OFFSET ${offset}` : ""
    }`;

    const [rows] = await pool.query(sql, values);
    const last = rows[rows.length - 1];

    return {
      rows,
      done: rows.length < options.batchSize,
      nextCheckpoint: key
        ? last
          ? { mode: "keyset", value: last[key] }
          : checkpoint
        : { mode: "offset", value: offset + rows.length },
    };
  }

  function columnDefinition(column, includePrimary = false) {
    const parts = [quote(column.name), mysqlType(column)];

    if (!column.nullable) parts.push("NOT NULL");
    if (column.autoIncrement && ["integer", "bigint"].includes(column.type)) {
      parts.push("AUTO_INCREMENT");
    }

    const defaultSql = safeDefault(column.defaultValue, "mysql");
    if (defaultSql) parts.push(defaultSql.trim());

    if (includePrimary && column.primaryKey) parts.push("PRIMARY KEY");

    return parts.join(" ");
  }

  async function prepare(schema, options = {}) {
    const existing = new Set(await listEntityNames());
    const existingSchema = await inspectSchema();
    const existingByName = new Map(
      existingSchema.entities.map((entity) => [entity.name, entity])
    );
    const existingSelected = schema.entities
      .filter((entity) => existing.has(entity.name) && !options.drop)
      .map((entity) => entity.name);
    const createdEntities = [];

    for (const entity of schema.entities) {
      if (options.drop && existing.has(entity.name)) {
        logger.warn(`${options.dryRun ? "Would drop" : "Dropping"} table ${entity.name}`);
        if (!options.dryRun) {
          await pool.query("SET FOREIGN_KEY_CHECKS = 0");
          try {
            await pool.query(`DROP TABLE ${quote(entity.name)}`);
          } finally {
            await pool.query("SET FOREIGN_KEY_CHECKS = 1");
          }
        }
        existing.delete(entity.name);
        existingByName.delete(entity.name);
      }

      if (!existing.has(entity.name)) {
        createdEntities.push(entity.name);
        const definitions = entity.columns.map((column) =>
          columnDefinition(column)
        );
        const keys = primaryKeys(entity);

        if (keys.length) {
          definitions.push(`PRIMARY KEY (${keys.map(quote).join(", ")})`);
        }

        const sql = `CREATE TABLE ${quote(entity.name)} (${definitions.join(", ")})`;

        logger.debug(`${options.dryRun ? "Would run" : "Running"}: ${sql}`);
        if (!options.dryRun) {
          await pool.query(sql);
        }
        continue;
      }

      const targetEntity = existingByName.get(entity.name);
      const targetColumns = new Set(
        ((targetEntity && targetEntity.columns) || []).map(
          (column) => column.name
        )
      );

      for (const column of entity.columns) {
        if (!targetColumns.has(column.name)) {
          const sql = `ALTER TABLE ${quote(entity.name)} ADD COLUMN ${columnDefinition(
            {
              ...column,
              nullable: true,
              primaryKey: false,
              autoIncrement: false,
            }
          )}`;
          logger.debug(`${options.dryRun ? "Would run" : "Running"}: ${sql}`);
          if (!options.dryRun) {
            await pool.query(sql);
          }
        }
      }
    }

    return {
      createdEntities,
      existingEntities: existingSelected,
    };
  }

  async function ensureDynamicColumns(entity, rows, options = {}) {
    const known = new Set(entity.columns.map((column) => column.name));
    const missing = [
      ...new Set(rows.flatMap((row) => Object.keys(row))),
    ].filter((name) => !known.has(name));

    for (const name of missing) {
      const column = {
        name,
        type: "json",
        nullable: true,
        primaryKey: false,
        autoIncrement: false,
      };
      const sql = `ALTER TABLE ${quote(entity.name)} ADD COLUMN ${columnDefinition(
        column
      )}`;
      logger.warn(
        `Schema drift detected on ${entity.name}.${name}; preserving it as JSON`
      );
      if (!options.dryRun) {
        await pool.query(sql);
      }
      entity.columns.push(column);
    }
  }

  async function writeBatch(entity, rows, options = {}) {
    if (!rows.length) return 0;

    await ensureDynamicColumns(entity, rows, options);
    if (options.dryRun) return rows.length;

    const columns = entity.columns.map((column) => column.name);
    const columnMap = new Map(entity.columns.map((column) => [column.name, column]));
    const values = [];
    const groups = rows.map((row) => {
      const placeholders = columns.map((column) => {
        values.push(sqlValue(row[column], columnMap.get(column)));
        return "?";
      });
      return `(${placeholders.join(", ")})`;
    });
    const keys = primaryKeys(entity);
    const updateColumns = columns.filter((column) => !keys.includes(column));
    const upsert = keys.length
      ? updateColumns.length
        ? ` ON DUPLICATE KEY UPDATE ${updateColumns
            .map((column) => `${quote(column)} = VALUES(${quote(column)})`)
            .join(", ")}`
        : ""
      : "";

    const sql = `INSERT INTO ${quote(entity.name)} (${columns
      .map(quote)
      .join(", ")}) VALUES ${groups.join(", ")}${upsert}`;

    try {
      await pool.query(sql, values);
      return rows.length;
    } catch (error) {
      throw new MigrationError(`Failed writing table ${entity.name}`, {
        code: error.code === "ER_DUP_ENTRY" ? "DUPLICATE_KEY" : "WRITE_FAILED",
        hint:
          error.code === "ER_DUP_ENTRY"
            ? "Review primary keys, unique indexes, and duplicate source rows."
            : "Run with --debug for driver details.",
        cause: error,
      });
    }
  }

  async function finalize(schema, options = {}) {
    for (const entity of schema.entities) {
      for (const index of entity.indexes || []) {
        const sql = `CREATE ${index.unique ? "UNIQUE " : ""}INDEX ${quote(
          index.name
        )} ON ${quote(entity.name)} (${index.columns
          .map((column) => quote(column.name))
          .join(", ")})`;

        if (!options.dryRun) {
          try {
            await pool.query(sql);
          } catch (error) {
            if (error.code === "ER_DUP_KEYNAME") continue;
            if (options.strict) {
              throw new MigrationError(
                `Failed creating index ${index.name} on ${entity.name}`,
                { code: "INDEX_FAILED", cause: error }
              );
            }
            logger.warn(`Skipped index ${index.name}: ${error.message}`);
          }
        }
      }

      for (const foreignKey of entity.foreignKeys || []) {
        const sql = `ALTER TABLE ${quote(entity.name)} ADD CONSTRAINT ${quote(
          foreignKey.name
        )} FOREIGN KEY (${foreignKey.columns.map(quote).join(", ")}) REFERENCES ${quote(
          foreignKey.referencedEntity
        )} (${foreignKey.referencedColumns.map(quote).join(", ")})`;

        if (!options.dryRun) {
          try {
            await pool.query(sql);
          } catch (error) {
            if (error.code === "ER_FK_DUP_NAME") continue;
            if (options.strict) {
              throw new MigrationError(
                `Failed creating foreign key ${foreignKey.name}`,
                { code: "CONSTRAINT_FAILED", cause: error }
              );
            }
            logger.warn(`Skipped foreign key ${foreignKey.name}: ${error.message}`);
          }
        }
      }
    }
  }

  async function dropEntities(names, options = {}) {
    if (options.dryRun) {
      for (const name of names) {
        logger.warn(`Would drop table ${name}`);
      }
      return;
    }

    await pool.query("SET FOREIGN_KEY_CHECKS = 0");
    try {
      for (const name of names) {
        logger.warn(`Dropping table ${name}`);
        await pool.query(`DROP TABLE IF EXISTS ${quote(name)}`);
      }
    } finally {
      await pool.query("SET FOREIGN_KEY_CHECKS = 1");
    }
  }

  return {
    type: "mysql",
    capabilities: {
      schemas: false,
      foreignKeys: true,
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
