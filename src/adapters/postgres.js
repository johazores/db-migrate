const { canonicalType, postgresType } = require("../schema");
const { MigrationError } = require("../errors");
const {
  buildFilter,
  primaryKeys,
  safeDefault,
  sqlValue,
} = require("./sql-utils");

function requireDriver() {
  try {
    return require("pg");
  } catch (error) {
    throw new MigrationError("PostgreSQL driver is not installed", {
      code: "MISSING_DRIVER",
      hint: "Run npm install pg.",
      cause: error,
    });
  }
}

function quote(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function create(config, logger) {
  const { Pool } = requireDriver();
  const pool = new Pool({
    connectionString: config.url,
    max: 4,
    ...(config.options || {}),
  });
  const schemaName = config.schema || "public";

  function table(name) {
    return `${quote(schemaName)}.${quote(name)}`;
  }

  async function connect() {
    try {
      await pool.query("SELECT 1");
    } catch (error) {
      throw new MigrationError("Unable to connect to PostgreSQL", {
        code: "CONNECTION_FAILED",
        hint: "Check the URL, schema, network access, and credentials.",
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
    const result = await pool.query(
      `SELECT table_name AS name
       FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [schemaName]
    );

    return result.rows.map((row) => row.name);
  }

  async function inspectSchema() {
    const names = await listEntityNames();
    const entities = [];

    for (const name of names) {
      const columnsResult = await pool.query(
        `SELECT c.column_name, c.data_type, c.udt_name, c.is_nullable,
                c.column_default, c.character_maximum_length,
                c.numeric_precision, c.numeric_scale, c.is_identity,
                EXISTS (
                  SELECT 1
                  FROM information_schema.table_constraints tc
                  JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                   AND tc.table_schema = kcu.table_schema
                  WHERE tc.constraint_type = 'PRIMARY KEY'
                    AND tc.table_schema = c.table_schema
                    AND tc.table_name = c.table_name
                    AND kcu.column_name = c.column_name
                ) AS primary_key
         FROM information_schema.columns c
         WHERE c.table_schema = $1 AND c.table_name = $2
         ORDER BY c.ordinal_position`,
        [schemaName, name]
      );

      const indexesResult = await pool.query(
        `SELECT i.relname AS index_name,
                ix.indisunique AS unique,
                am.amname AS method,
                array_agg(a.attname ORDER BY ord.ordinality) AS columns
         FROM pg_class t
         JOIN pg_namespace n ON n.oid = t.relnamespace
         JOIN pg_index ix ON t.oid = ix.indrelid
         JOIN pg_class i ON i.oid = ix.indexrelid
         JOIN pg_am am ON am.oid = i.relam
         JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY ord(attnum, ordinality)
           ON true
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ord.attnum
         WHERE n.nspname = $1 AND t.relname = $2 AND NOT ix.indisprimary
         GROUP BY i.relname, ix.indisunique, am.amname
         ORDER BY i.relname`,
        [schemaName, name]
      );

      const foreignKeysResult = await pool.query(
        `SELECT con.conname AS constraint_name,
                array_agg(source_attribute.attname ORDER BY keys.ordinality) AS columns,
                target_table.relname AS referenced_table,
                array_agg(target_attribute.attname ORDER BY keys.ordinality) AS referenced_columns
         FROM pg_constraint con
         JOIN pg_class source_table ON source_table.oid = con.conrelid
         JOIN pg_namespace source_namespace
           ON source_namespace.oid = source_table.relnamespace
         JOIN pg_class target_table ON target_table.oid = con.confrelid
         JOIN LATERAL unnest(con.conkey, con.confkey)
           WITH ORDINALITY AS keys(source_attnum, target_attnum, ordinality)
           ON true
         JOIN pg_attribute source_attribute
           ON source_attribute.attrelid = source_table.oid
          AND source_attribute.attnum = keys.source_attnum
         JOIN pg_attribute target_attribute
           ON target_attribute.attrelid = target_table.oid
          AND target_attribute.attnum = keys.target_attnum
         WHERE con.contype = 'f'
           AND source_namespace.nspname = $1
           AND source_table.relname = $2
         GROUP BY con.conname, target_table.relname`,
        [schemaName, name]
      );

      entities.push({
        name,
        sourceName: name,
        kind: "table",
        columns: columnsResult.rows.map((column) => ({
          name: column.column_name,
          nativeType: column.data_type,
          type: canonicalType("postgres", column.data_type, {
            length: column.character_maximum_length,
          }),
          nullable: column.is_nullable === "YES",
          defaultValue: column.column_default,
          primaryKey: column.primary_key,
          autoIncrement:
            column.is_identity === "YES" ||
            String(column.column_default || "").includes("nextval"),
          length: column.character_maximum_length
            ? Number(column.character_maximum_length)
            : undefined,
          precision: column.numeric_precision
            ? Number(column.numeric_precision)
            : undefined,
          scale: column.numeric_scale
            ? Number(column.numeric_scale)
            : undefined,
        })),
        indexes: indexesResult.rows
          .filter((index) => index.method === "btree")
          .map((index) => ({
            name: index.index_name,
            unique: index.unique,
            columns: index.columns.map((column) => ({
              name: column,
              order: 1,
            })),
          })),
        foreignKeys: foreignKeysResult.rows.map((foreignKey) => ({
          name: foreignKey.constraint_name,
          columns: foreignKey.columns,
          referencedEntity: foreignKey.referenced_table,
          referencedColumns: foreignKey.referenced_columns,
        })),
        options: {
          unsupportedIndexes: indexesResult.rows
            .filter((index) => index.method !== "btree")
            .map((index) => index.index_name),
        },
      });

      const unsupportedIndexes = indexesResult.rows
        .filter((index) => index.method !== "btree")
        .map((index) => index.index_name);

      if (unsupportedIndexes.length) {
        logger.warn(
          `PostgreSQL-specific indexes on ${name} require manual migration: ${unsupportedIndexes.join(
            ", "
          )}`
        );
      }
    }

    return {
      version: 1,
      database: {
        type: "postgres",
        name: schemaName,
      },
      entities,
    };
  }

  async function count(entity, filter = {}) {
    const where = buildFilter(filter, quote, (position) => `$${position}`);
    const result = await pool.query(
      `SELECT COUNT(*)::bigint AS total FROM ${table(
        entity.sourceName || entity.name
      )}${where.sql ? ` WHERE ${where.sql}` : ""}`,
      where.values
    );
    return Number(result.rows[0].total);
  }

  async function readBatch(entity, options = {}) {
    const keys = primaryKeys(entity);
    const key = keys.length === 1 ? keys[0] : null;
    const where = buildFilter(options.filter, quote, (position) => `$${position}`);
    const values = [...where.values];
    const clauses = where.sql ? [where.sql] : [];
    const checkpoint = options.checkpoint || {
      mode: key ? "keyset" : "offset",
      value: 0,
    };

    if (key && checkpoint.value !== undefined && checkpoint.value !== 0) {
      const keyColumn = (entity.columns || []).find(
        (column) => column.name === key
      );
      values.push(sqlValue(checkpoint.value, keyColumn));
      clauses.push(`${quote(key)} > $${values.length}`);
    }

    const offset = !key ? Number(checkpoint.value || 0) : 0;
    values.push(Number(options.batchSize));
    const limitPlaceholder = `$${values.length}`;

    if (!key) {
      values.push(offset);
    }

    const result = await pool.query(
      `SELECT * FROM ${table(entity.sourceName || entity.name)}${
        clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""
      }${key ? ` ORDER BY ${quote(key)}` : ""} LIMIT ${limitPlaceholder}${
        !key ? ` OFFSET $${values.length}` : ""
      }`,
      values
    );

    const rows = result.rows;
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

  function columnDefinition(column) {
    const parts = [quote(column.name), postgresType(column)];

    if (
      column.autoIncrement &&
      ["integer", "bigint"].includes(column.type)
    ) {
      parts.push("GENERATED BY DEFAULT AS IDENTITY");
    }

    if (!column.nullable) parts.push("NOT NULL");

    const defaultSql = safeDefault(column.defaultValue, "postgres");
    if (defaultSql && !column.autoIncrement) parts.push(defaultSql.trim());

    return parts.join(" ");
  }

  async function prepare(schema, options = {}) {
    logger.debug(
      `${options.dryRun ? "Would create" : "Ensuring"} schema ${schemaName}`
    );
    if (!options.dryRun) {
      await pool.query(`CREATE SCHEMA IF NOT EXISTS ${quote(schemaName)}`);
    }
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
          await pool.query(`DROP TABLE ${table(entity.name)} CASCADE`);
        }
        existing.delete(entity.name);
        existingByName.delete(entity.name);
      }

      if (!existing.has(entity.name)) {
        createdEntities.push(entity.name);
        const definitions = entity.columns.map(columnDefinition);
        const keys = primaryKeys(entity);

        if (keys.length) {
          definitions.push(`PRIMARY KEY (${keys.map(quote).join(", ")})`);
        }

        const sql = `CREATE TABLE ${table(entity.name)} (${definitions.join(", ")})`;
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
          const safeColumn = {
            ...column,
            nullable: true,
            primaryKey: false,
            autoIncrement: false,
          };
          const sql = `ALTER TABLE ${table(entity.name)} ADD COLUMN ${columnDefinition(
            safeColumn
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
      const sql = `ALTER TABLE ${table(entity.name)} ADD COLUMN ${columnDefinition(
        column
      )}`;
      logger.warn(
        `Schema drift detected on ${entity.name}.${name}; preserving it as JSONB`
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
        return `$${values.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    const keys = primaryKeys(entity);
    const updateColumns = columns.filter((column) => !keys.includes(column));
    const conflict = keys.length
      ? updateColumns.length
        ? ` ON CONFLICT (${keys.map(quote).join(", ")}) DO UPDATE SET ${updateColumns
            .map((column) => `${quote(column)} = EXCLUDED.${quote(column)}`)
            .join(", ")}`
        : ` ON CONFLICT (${keys.map(quote).join(", ")}) DO NOTHING`
      : "";

    const sql = `INSERT INTO ${table(entity.name)} (${columns
      .map(quote)
      .join(", ")}) VALUES ${groups.join(", ")}${conflict}`;

    try {
      await pool.query(sql, values);
      return rows.length;
    } catch (error) {
      throw new MigrationError(`Failed writing table ${entity.name}`, {
        code: error.code === "23505" ? "DUPLICATE_KEY" : "WRITE_FAILED",
        hint:
          error.code === "23505"
            ? "Review primary keys, unique indexes, and duplicate source rows."
            : "Run with --debug for driver details.",
        cause: error,
      });
    }
  }

  async function finalize(schema, options = {}) {
    for (const entity of schema.entities) {
      for (const index of entity.indexes || []) {
        const sql = `CREATE ${index.unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS ${quote(
          index.name
        )} ON ${table(entity.name)} (${index.columns
          .map((column) => quote(column.name))
          .join(", ")})`;

        if (!options.dryRun) {
          try {
            await pool.query(sql);
          } catch (error) {
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
        const sql = `ALTER TABLE ${table(entity.name)} ADD CONSTRAINT ${quote(
          foreignKey.name
        )} FOREIGN KEY (${foreignKey.columns.map(quote).join(", ")}) REFERENCES ${table(
          foreignKey.referencedEntity
        )} (${foreignKey.referencedColumns.map(quote).join(", ")})`;

        if (!options.dryRun) {
          try {
            await pool.query(sql);
          } catch (error) {
            if (error.code === "42710") continue;
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
    for (const name of [...names].reverse()) {
      logger.warn(`${options.dryRun ? "Would drop" : "Dropping"} table ${name}`);
      if (!options.dryRun) {
        await pool.query(`DROP TABLE IF EXISTS ${table(name)} CASCADE`);
      }
    }
  }

  return {
    type: "postgres",
    capabilities: {
      schemas: true,
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
