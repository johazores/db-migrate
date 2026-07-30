const { deserializeValue, serializeValue } = require("../utils");

function buildFilter(filter, quote, placeholder) {
  if (!filter || Object.keys(filter).length === 0) {
    return { sql: "", values: [] };
  }

  const values = [];
  const clauses = Object.entries(filter).map(([column, value]) => {
    values.push(value);
    return `${quote(column)} = ${placeholder(values.length)}`;
  });

  return {
    sql: clauses.join(" AND "),
    values,
  };
}

function sqlValue(value, column) {
  value = deserializeValue(value);

  if (value === undefined || value === null) return null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date || Buffer.isBuffer(value)) return value;

  const constructorName =
    value && value.constructor && value.constructor.name;

  if (constructorName === "ObjectId" && value.toHexString) {
    return value.toHexString();
  }

  if (["Decimal128", "Long"].includes(constructorName)) {
    return value.toString();
  }

  if (column && ["json", "unknown"].includes(column.type)) {
    return JSON.stringify(serializeValue(value));
  }

  if (value && typeof value === "object") {
    if (Object.hasOwn(value, "$objectId")) return value.$objectId;
    if (Object.hasOwn(value, "$decimal128")) return value.$decimal128;
    if (Object.hasOwn(value, "$long")) return value.$long;
    if (Object.hasOwn(value, "$bigint")) return value.$bigint;

    return JSON.stringify(serializeValue(value));
  }

  return value;
}

function safeDefault(defaultValue, databaseType) {
  if (defaultValue === null || defaultValue === undefined) {
    return "";
  }

  const value = String(defaultValue).trim();
  const upper = value.toUpperCase();

  if (
    ["CURRENT_TIMESTAMP", "CURRENT_TIMESTAMP()", "NOW()", "TRUE", "FALSE"].includes(
      upper
    )
  ) {
    if (upper === "NOW()") {
      return " DEFAULT CURRENT_TIMESTAMP";
    }
    return ` DEFAULT ${upper}`;
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return ` DEFAULT ${value}`;
  }

  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    const unquoted = value.slice(1, -1).replace(/'/g, "''");
    return ` DEFAULT '${unquoted}'`;
  }

  return "";
}

function primaryKeys(entity) {
  return (entity.columns || [])
    .filter((column) => column.primaryKey)
    .map((column) => column.name);
}

module.exports = {
  buildFilter,
  primaryKeys,
  safeDefault,
  sqlValue,
};
