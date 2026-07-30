# Configuration

The default file is `db-migrate.config.js`. `.cjs` and `.json` are also supported.

```js
module.exports = {
  source: {
    type: "mysql",
    url: process.env.DB_MIGRATE_SOURCE_URL,
  },
  target: {
    type: "postgres",
    url: process.env.DB_MIGRATE_TARGET_URL,
    schema: "public",
  },
  batchSize: 500,
  sampleSize: 100,
  resume: true,
  strict: false,
  drop: false,
  entities: [],
  filters: {},
  rename: {},
};
```

## Database objects

Each source or target uses a small object:

```js
{
  type: "mongodb" | "mysql" | "postgres",
  url: "...",
  database: "...", // required for MongoDB; optional for MySQL URLs
  schema: "public", // PostgreSQL only
  options: {}, // passed to the native driver
}
```

## Environment variables

```env
DB_MIGRATE_SOURCE_TYPE=mongodb
DB_MIGRATE_SOURCE_URL=mongodb://localhost:27017
DB_MIGRATE_SOURCE_DATABASE=app
DB_MIGRATE_SOURCE_SCHEMA=public

DB_MIGRATE_TARGET_TYPE=postgres
DB_MIGRATE_TARGET_URL=postgresql://localhost/app
DB_MIGRATE_TARGET_DATABASE=app
DB_MIGRATE_TARGET_SCHEMA=public

DB_MIGRATE_BATCH_SIZE=500
DB_MIGRATE_RESUME=true
DB_MIGRATE_STRICT=false
DB_MIGRATE_ENTITIES=users,orders
```

`.env` is loaded with a small built-in parser. Existing process environment values are not overwritten.

## Precedence

1. CLI flags
2. Config file
3. Environment variables
4. Defaults

## Filters

Filters are grouped by source entity:

```js
filters: {
  users: { active: true },
  orders: { status: "paid" },
}
```

SQL values are parameterized. MongoDB filters are passed as equality objects.

## Rename

```js
rename: {
  users: "customers",
}
```

Foreign-key references are renamed with their related tables.

## Transform

A JavaScript config may transform or remove each row:

```js
async transform({ entity, row, source, target }) {
  if (entity === "users" && row.deleted) {
    return null;
  }

  return {
    ...row,
    migratedAt: new Date(),
  };
}
```

Keep transforms deterministic so resumed migrations produce the same result.
