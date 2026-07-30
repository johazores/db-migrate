function inferValueType(value) {
  if (value === null || value === undefined) return "unknown";
  if (Buffer.isBuffer(value)) return "binary";
  if (value instanceof Date) return "datetime";
  if (Array.isArray(value)) return "json";

  if (typeof value === "boolean") return "boolean";
  if (typeof value === "bigint") return "bigint";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "decimal";
  }

  if (typeof value === "string") {
    if (/^[0-9a-f]{24}$/i.test(value)) return "objectId";
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
    ) {
      return "uuid";
    }
    return value.length > 255 ? "text" : "string";
  }

  if (typeof value === "object") {
    const name = value.constructor && value.constructor.name;
    if (name === "ObjectId") return "objectId";
    if (name === "Decimal128") return "decimal";
    if (name === "Long") return "bigint";
    return "json";
  }

  return "unknown";
}

function mergeTypes(first, second) {
  if (!first || first === "unknown") return second || "unknown";
  if (!second || second === "unknown") return first;
  if (first === second) return first;

  const numeric = new Set(["integer", "bigint", "decimal"]);
  if (numeric.has(first) && numeric.has(second)) {
    if (first === "decimal" || second === "decimal") return "decimal";
    if (first === "bigint" || second === "bigint") return "bigint";
    return "integer";
  }

  if (
    (first === "string" && second === "text") ||
    (first === "text" && second === "string")
  ) {
    return "text";
  }

  const temporal = new Set(["date", "datetime"]);
  if (temporal.has(first) && temporal.has(second)) return "datetime";

  const textual = new Set(["string", "text"]);
  if (
    (textual.has(first) && ["objectId", "uuid"].includes(second)) ||
    (textual.has(second) && ["objectId", "uuid"].includes(first))
  ) {
    return first === "text" || second === "text" ? "text" : "string";
  }

  return "json";
}

function inferColumns(rows) {
  const columns = new Map();
  const rowCount = rows.length;

  for (const row of rows) {
    const present = new Set(Object.keys(row));

    for (const [name, value] of Object.entries(row)) {
      const existing = columns.get(name) || {
        name,
        type: "unknown",
        nullable: false,
        seen: 0,
        maxLength: 0,
      };

      existing.type = mergeTypes(existing.type, inferValueType(value));
      existing.nullable ||= value === null || value === undefined;
      existing.seen += 1;

      if (typeof value === "string") {
        existing.maxLength = Math.max(existing.maxLength, value.length);
      }

      columns.set(name, existing);
    }

    for (const [name, column] of columns) {
      if (!present.has(name)) {
        column.nullable = true;
      }
    }
  }

  return [...columns.values()].map((column) => ({
    name: column.name,
    type: column.type === "unknown" ? "json" : column.type,
    nullable: column.nullable || column.seen < rowCount,
    length:
      column.type === "string"
        ? Math.min(Math.max(column.maxLength || 1, 32), 65535)
        : undefined,
    primaryKey: column.name === "_id",
    autoIncrement: false,
  }));
}

function inferEntity(name, rows, kind = "collection") {
  return {
    name,
    sourceName: name,
    kind,
    columns: inferColumns(rows),
    indexes: [],
    foreignKeys: [],
    options: {},
  };
}

function canonicalType(databaseType, nativeType, details = {}) {
  const value = String(nativeType || "").toLowerCase();

  if (databaseType === "postgres") {
    if (["smallint", "integer", "int2", "int4", "serial", "smallserial"].includes(value)) return "integer";
    if (["bigint", "int8", "bigserial"].includes(value)) return "bigint";
    if (["numeric", "decimal", "real", "double precision", "float4", "float8", "money"].includes(value)) return "decimal";
    if (["boolean", "bool"].includes(value)) return "boolean";
    if (value === "date") return "date";
    if (value.includes("timestamp") || value.includes("time")) return "datetime";
    if (["bytea", "bit", "bit varying"].includes(value)) return "binary";
    if (["json", "jsonb", "array"].includes(value) || value.endsWith("[]")) return "json";
    if (value === "uuid") return "uuid";
    if (["text", "xml"].includes(value)) return "text";
    if (["character varying", "varchar", "character", "char", "name", "citext"].includes(value)) {
      return Number(details.length) > 255 ? "text" : "string";
    }
  }

  if (databaseType === "mysql") {
    if (["tinyint", "smallint", "mediumint", "int", "integer"].includes(value)) {
      return details.columnType === "tinyint(1)" ? "boolean" : "integer";
    }
    if (value === "bigint") return "bigint";
    if (["decimal", "numeric", "float", "double", "real"].includes(value)) return "decimal";
    if (["bool", "boolean"].includes(value)) return "boolean";
    if (value === "date") return "date";
    if (["datetime", "timestamp", "time", "year"].includes(value)) return "datetime";
    if (["binary", "varbinary", "blob", "tinyblob", "mediumblob", "longblob"].includes(value)) return "binary";
    if (["json", "enum", "set"].includes(value)) return "json";
    if (["text", "tinytext", "mediumtext", "longtext"].includes(value)) return "text";
    if (["char", "varchar"].includes(value)) {
      return Number(details.length) > 255 ? "text" : "string";
    }
  }

  return "unknown";
}

function mysqlType(column) {
  switch (column.type) {
    case "boolean":
      return "BOOLEAN";
    case "integer":
      return "INT";
    case "bigint":
      return "BIGINT";
    case "decimal":
      return `DECIMAL(${column.precision || 38}, ${column.scale || 10})`;
    case "date":
      return "DATE";
    case "datetime":
      return "DATETIME(6)";
    case "binary":
      return "LONGBLOB";
    case "json":
      return "JSON";
    case "uuid":
      return "CHAR(36)";
    case "objectId":
      return "VARCHAR(24)";
    case "text":
      return "LONGTEXT";
    case "string":
      return `VARCHAR(${Math.min(column.length || 255, 65535)})`;
    default:
      return "JSON";
  }
}

function postgresType(column) {
  switch (column.type) {
    case "boolean":
      return "BOOLEAN";
    case "integer":
      return "INTEGER";
    case "bigint":
      return "BIGINT";
    case "decimal":
      return `NUMERIC(${column.precision || 38}, ${column.scale || 10})`;
    case "date":
      return "DATE";
    case "datetime":
      return "TIMESTAMPTZ";
    case "binary":
      return "BYTEA";
    case "json":
      return "JSONB";
    case "uuid":
      return "UUID";
    case "objectId":
      return "VARCHAR(24)";
    case "text":
      return "TEXT";
    case "string":
      return `VARCHAR(${Math.min(column.length || 255, 10485760)})`;
    default:
      return "JSONB";
  }
}

function compareSchemas(source, target) {
  const targetEntities = new Map(
    target.entities.map((entity) => [entity.name, entity])
  );
  const sourceEntities = new Map(
    source.entities.map((entity) => [entity.name, entity])
  );
  const changes = [];

  for (const sourceEntity of source.entities) {
    const targetEntity = targetEntities.get(sourceEntity.name);

    if (!targetEntity) {
      changes.push({
        type: "missing_entity",
        entity: sourceEntity.name,
        message: `Target is missing ${sourceEntity.name}`,
      });
      continue;
    }

    const targetColumns = new Map(
      (targetEntity.columns || []).map((column) => [column.name, column])
    );

    for (const sourceColumn of sourceEntity.columns || []) {
      const targetColumn = targetColumns.get(sourceColumn.name);

      if (!targetColumn) {
        changes.push({
          type: "missing_column",
          entity: sourceEntity.name,
          column: sourceColumn.name,
          message: `Target is missing ${sourceEntity.name}.${sourceColumn.name}`,
        });
      } else if (
        sourceColumn.type !== "unknown" &&
        targetColumn.type !== "unknown" &&
        sourceColumn.type !== targetColumn.type
      ) {
        changes.push({
          type: "type_mismatch",
          entity: sourceEntity.name,
          column: sourceColumn.name,
          sourceType: sourceColumn.type,
          targetType: targetColumn.type,
          message: `${sourceEntity.name}.${sourceColumn.name}: ${sourceColumn.type} → ${targetColumn.type}`,
        });
      }
    }
  }

  for (const targetEntity of target.entities) {
    if (!sourceEntities.has(targetEntity.name)) {
      changes.push({
        type: "extra_entity",
        entity: targetEntity.name,
        message: `Target has extra entity ${targetEntity.name}`,
      });
    }
  }

  return changes;
}

module.exports = {
  canonicalType,
  compareSchemas,
  inferColumns,
  inferEntity,
  inferValueType,
  mergeTypes,
  mysqlType,
  postgresType,
};
