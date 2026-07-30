const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { once } = require("events");
const { MigrationError } = require("./errors");

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new MigrationError(`Expected a positive number, received "${value}"`, {
      code: "INVALID_NUMBER",
    });
  }

  return parsed;
}

function parseList(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(parseList);
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJson(value, label = "JSON value") {
  if (!value) {
    return undefined;
  }

  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch (error) {
    throw new MigrationError(`Invalid ${label}`, {
      code: "INVALID_JSON",
      hint: "Use valid JSON with double-quoted keys and string values.",
      cause: error,
    });
  }
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function writeJson(filePath, value) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new MigrationError(`Unable to read JSON file: ${filePath}`, {
      code: "INVALID_JSON_FILE",
      cause: error,
    });
  }
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function safeFileName(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function restoreFileName(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function maskUrl(value) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    if (url.username) url.username = "***";
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    return String(value).replace(/\/\/([^@]+)@/, "//***@");
  }
}

async function writeLine(stream, value) {
  if (!stream.write(`${value}\n`)) {
    await once(stream, "drain");
  }
}

function selectEntities(schema, names) {
  if (!names || names.length === 0) {
    return schema;
  }

  const selected = new Set(names);
  const entities = schema.entities.filter((entity) => selected.has(entity.name));
  const missing = names.filter(
    (name) => !schema.entities.some((entity) => entity.name === name)
  );

  if (missing.length) {
    throw new MigrationError(`Unknown entities: ${missing.join(", ")}`, {
      code: "UNKNOWN_ENTITY",
      hint: "Run db-migrate validate or diff to inspect available entities.",
    });
  }

  return {
    ...schema,
    entities,
  };
}

function mapSchema(schema, rename = {}) {
  const entities = schema.entities.map((entity) => {
    const targetName = rename[entity.name] || entity.name;

    return {
      ...entity,
      sourceName: entity.sourceName || entity.name,
      name: targetName,
      foreignKeys: (entity.foreignKeys || []).map((foreignKey) => ({
        ...foreignKey,
        referencedEntity:
          rename[foreignKey.referencedEntity] || foreignKey.referencedEntity,
      })),
    };
  });

  return {
    ...schema,
    entities,
  };
}

function serializeValue(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "bigint") return { $bigint: value.toString() };
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Buffer.isBuffer(value)) return { $binary: value.toString("base64") };
  if (Array.isArray(value)) return value.map(serializeValue);

  if (typeof value === "object") {
    const name = value.constructor && value.constructor.name;

    if (name === "ObjectId" && typeof value.toHexString === "function") {
      return { $objectId: value.toHexString() };
    }

    if (name === "Decimal128" || name === "Long") {
      return { [`$${name.toLowerCase()}`]: value.toString() };
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeValue(item)])
    );
  }

  return value;
}

function deserializeValue(value) {
  if (Array.isArray(value)) return value.map(deserializeValue);
  if (value instanceof Date || Buffer.isBuffer(value)) return value;

  if (value && typeof value === "object") {
    const constructorName = value.constructor && value.constructor.name;

    if (["ObjectId", "Decimal128", "Long"].includes(constructorName)) {
      return value;
    }
    if (Object.hasOwn(value, "$date")) return new Date(value.$date);
    if (Object.hasOwn(value, "$binary")) return Buffer.from(value.$binary, "base64");
    if (Object.hasOwn(value, "$bigint")) return value.$bigint;
    if (Object.hasOwn(value, "$objectId")) return value;
    if (Object.hasOwn(value, "$decimal128")) return value;
    if (Object.hasOwn(value, "$long")) return value;

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deserializeValue(item)])
    );
  }

  return value;
}

function serializeRow(row) {
  return JSON.stringify(serializeValue(row));
}

function deserializeRow(line) {
  return deserializeValue(JSON.parse(line));
}

module.exports = {
  deserializeRow,
  deserializeValue,
  ensureDirectory,
  hash,
  mapSchema,
  maskUrl,
  parseBoolean,
  parseJson,
  parseList,
  parseNumber,
  readJson,
  restoreFileName,
  safeFileName,
  selectEntities,
  serializeRow,
  serializeValue,
  writeJson,
  writeLine,
};
