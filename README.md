# db-migrate

A small Node.js toolkit for moving schemas and data between MongoDB, MySQL, and PostgreSQL.

It is designed for migration, export/import, and practical data portability. It is not an ORM and does not add a model layer to your application.

## Features

- MongoDB, MySQL, and PostgreSQL through one adapter interface
- Direct database-to-database migration
- Portable NDJSON export and import
- Schema inspection, automatic type mapping, and schema diff
- Batched, low-memory data transfer
- Checkpoints for resumable migrations
- Entity selection, per-entity filters, renaming, and JavaScript transforms
- Dry runs, verbose/debug output, validation, seeding, and guarded rollback
- Legacy support for the original MongoDB environment variables

## Install

```bash
npm install
```

Run locally:

```bash
node bin/db-migrate.js --help
```

After publishing or linking the package:

```bash
db-migrate --help
```

Requires Node.js 20 or newer.

## Quick start

Create a starter configuration:

```bash
db-migrate init
```

Update `.env`:

```env
DB_MIGRATE_SOURCE_URL=mongodb://localhost:27017
DB_MIGRATE_SOURCE_DATABASE=app
DB_MIGRATE_TARGET_URL=postgresql://postgres:postgres@localhost:5432/app
DB_MIGRATE_TARGET_SCHEMA=public
```

Validate both connections:

```bash
db-migrate validate
```

Preview the migration:

```bash
db-migrate migrate --dry-run
```

Run it:

```bash
db-migrate migrate
```

## Configuration

`db-migrate.config.js`:

```js
module.exports = {
  source: {
    type: "mongodb",
    url: process.env.DB_MIGRATE_SOURCE_URL,
    database: process.env.DB_MIGRATE_SOURCE_DATABASE,
  },
  target: {
    type: "postgres",
    url: process.env.DB_MIGRATE_TARGET_URL,
    schema: "public",
  },
  batchSize: 500,
  resume: true,
  strict: false,
  entities: ["users", "orders"],
  filters: {
    orders: { status: "paid" },
  },
  rename: {
    users: "customers",
  },
  async transform({ entity, row }) {
    if (entity === "users") {
      return {
        ...row,
        email: row.email && row.email.toLowerCase(),
      };
    }

    return row;
  },
};
```

Configuration priority is CLI flags, config file, environment variables, then defaults.

JSON configuration is supported, but JavaScript configuration is required for `transform`.

## Database examples

### MongoDB to PostgreSQL

```bash
db-migrate migrate \
  --source-type mongodb \
  --source-url mongodb://localhost:27017 \
  --source-database app \
  --target-type postgres \
  --target-url postgresql://postgres:postgres@localhost:5432/app \
  --target-schema public
```

MongoDB collections become tables. Top-level fields are inferred from a sample. Nested objects and arrays use `JSONB`.

### MySQL to PostgreSQL

```bash
db-migrate migrate \
  --source-type mysql \
  --source-url mysql://root:password@localhost/source_db \
  --target-type postgres \
  --target-url postgresql://postgres:password@localhost/target_db
```

Tables, columns, primary keys, indexes, and compatible foreign keys are copied.

### PostgreSQL to MongoDB

```bash
db-migrate migrate \
  --source-type postgres \
  --source-url postgresql://postgres:password@localhost/source_db \
  --source-schema public \
  --target-type mongodb \
  --target-url mongodb://localhost:27017 \
  --target-database target_db
```

Tables become collections. SQL primary keys are used for idempotent upserts when possible.

### MongoDB to MySQL

```bash
db-migrate migrate \
  --source-type mongodb \
  --source-url mongodb://localhost:27017 \
  --source-database app \
  --target-type mysql \
  --target-url mysql://root:password@localhost/app
```

Nested values map to MySQL `JSON`.

## Commands

```text
db-migrate init
db-migrate validate
db-migrate diff
db-migrate migrate
db-migrate export
db-migrate import
db-migrate seed
db-migrate rollback
```

See [docs/cli.md](docs/cli.md) for all options and
[docs/repository-review.md](docs/repository-review.md) for the original project audit and implementation priorities.

## Export and import

Export selected data:

```bash
db-migrate export --entities users,orders --output ./backup
```

The output is a directory containing:

```text
backup/
  manifest.json
  data/
    <entity>.ndjson
```

Import it:

```bash
db-migrate import --input ./backup
```

The format preserves dates, binary values, big integers, MongoDB ObjectIds, Decimal128, and Long values using portable JSON markers.

## Filtering

Filters are equality filters and are parameterized for SQL databases.

Config:

```js
filters: {
  users: { active: true },
  orders: { status: "paid" },
}
```

CLI:

```bash
db-migrate export --filter '{"users":{"active":true}}'
```

For more advanced filtering, use a JavaScript `transform` to discard rows by returning `null`.

## Resume behavior

Checkpoints are saved under `.db-migrate/checkpoints`.

- MongoDB uses `_id` keyset pagination.
- SQL tables with one primary key use keyset pagination.
- Tables without a single primary key use offset pagination.
- Completed checkpoints are removed after success.
- Connection URLs are never stored in checkpoint filenames or migration history.

Use `--no-resume` to ignore a checkpoint. For resumable exports, pass an explicit
`--output` directory so a later run resolves to the same checkpoint and data files.

## Rollback safety

Rollback only drops entities that were newly created by the latest migration:

```bash
db-migrate rollback --yes
```

It does not try to reverse updates to existing tables or collections because doing so safely requires a backup or a full change log. Migrations run with `--drop` are marked destructive and cannot be rolled back automatically.

## Important limitations

Automatic cross-database conversion is intentionally conservative.

- MongoDB schema inference uses top-level fields from a configurable sample. Fields found after sampling are preserved in dynamically added JSON/JSONB columns.
- Stored procedures, triggers, views, generated expressions, partitions, extensions, and database-specific permissions are not migrated.
- Complex or database-specific index options may be skipped.
- Foreign keys cannot be enforced in MongoDB.
- Tables without primary keys are not guaranteed to be idempotent.
- Existing incompatible column types are reported by `diff`; they are not destructively changed.
- Large production migrations should be tested against a copy and backed up first.

Use `--strict` to fail instead of warning when an index or constraint cannot be created.

## Legacy MongoDB configuration

The original variables still work:

```env
SOURCE_MONGODB_URI=mongodb://localhost:27017
TARGET_MONGODB_URI=mongodb://localhost:27018
DB_NAME=app
BATCH_SIZE=500
DROP_TARGET=false
```

The global DNS override and forced `authSource`, IPv4, and retry settings from the original script were removed. Driver options can be supplied explicitly through `source.options` or `target.options`.

## Documentation

- [CLI reference](docs/cli.md)
- [Configuration](docs/configuration.md)
- [Architecture](docs/architecture.md)
- [Type mapping and limitations](docs/type-mapping.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Contributing](CONTRIBUTING.md)

## Development

```bash
npm test
npm run check
```

Integration tests run only when matching credentials are provided:

```env
TEST_MONGODB_URL=mongodb://localhost:27017
TEST_MONGODB_DATABASE=db_migrate_test
TEST_MYSQL_URL=mysql://root:password@localhost/db_migrate_test
TEST_POSTGRES_URL=postgresql://postgres:password@localhost/db_migrate_test
```

## License

MIT
