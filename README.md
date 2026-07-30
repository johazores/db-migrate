# db-migrate

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)
[![Version](https://img.shields.io/badge/version-2.0.0-informational.svg)](package.json)

A lightweight Node.js toolkit for migrating schemas and data across MongoDB, MySQL, and PostgreSQL.

It focuses on migration, export, import, transformation, and practical data portability. It is not an ORM and does not add a model layer to your application.

> **Status:** Active open-source development. Test migrations against a copy and maintain an independent backup before using production data.

## Features

- One focused adapter interface for MongoDB, MySQL, and PostgreSQL
- Direct database-to-database migration
- Portable NDJSON export and import
- Schema inspection, automatic type mapping, and schema diff
- Batched, low-memory data transfer
- Resumable migration checkpoints
- Entity filters, renaming, and JavaScript transforms
- Dry runs, validation, seeding, migration history, and guarded rollback
- Legacy support for the original MongoDB environment variables

## Requirements

- Node.js 20 or newer
- Access to the source and target databases
- A verified backup before destructive production work

## Installation

```bash
npm install
```

Run locally:

```bash
node bin/db-migrate.js --help
```

After linking or publishing the package:

```bash
db-migrate --help
```

## Quick start

Create a starter configuration:

```bash
db-migrate init
```

Configure the connections:

```env
DB_MIGRATE_SOURCE_URL=mongodb://localhost:27017
DB_MIGRATE_SOURCE_DATABASE=app
DB_MIGRATE_TARGET_URL=postgresql://postgres:postgres@localhost:5432/app
DB_MIGRATE_TARGET_SCHEMA=public
```

Validate both databases and preview the migration:

```bash
db-migrate validate
db-migrate migrate --dry-run
```

Run the migration:

```bash
db-migrate migrate
```

## Configuration

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

Configuration priority is CLI flags, configuration file, environment variables, then defaults. JSON configuration is supported, but JavaScript is required for transforms.

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

See the [CLI reference](docs/cli.md) for all options.

## Migration examples

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

MongoDB collections become tables. Top-level fields are inferred from a configurable sample, while nested objects and arrays use `JSONB`.

### MySQL to PostgreSQL

```bash
db-migrate migrate \
  --source-type mysql \
  --source-url mysql://root:password@localhost/source_db \
  --target-type postgres \
  --target-url postgresql://postgres:password@localhost/target_db
```

Compatible tables, columns, primary keys, indexes, and foreign keys are copied.

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

SQL primary keys are used for idempotent upserts when possible.

## Export and import

```bash
db-migrate export --entities users,orders --output ./backup
db-migrate import --input ./backup
```

The portable format preserves dates, binary values, big integers, MongoDB ObjectIds, Decimal128, and Long values through explicit JSON markers.

## Architecture

The toolkit contains four small layers:

1. CLI and configuration parsing
2. Database adapters
3. Canonical schema representation
4. Migration, export, import, validation, diff, seed, and rollback commands

The adapter interface stays intentionally small so another database can be added without changing the entire CLI. Read the [architecture guide](docs/architecture.md) for details.

## Project structure

```text
bin/                  command-line entry point
src/adapters/         MongoDB, MySQL, and PostgreSQL adapters
src/commands/         migration and portability commands
src/                  configuration, schema, transfer, and state modules
test/                 unit and integration-oriented tests
docs/                 user, architecture, project, and community documentation
```

## Important limitations

Automatic cross-database conversion is intentionally conservative.

- MongoDB schema inference samples top-level fields.
- Stored procedures, triggers, views, generated expressions, partitions, extensions, and database permissions are not migrated.
- Complex database-specific indexes may be skipped.
- Foreign keys cannot be enforced in MongoDB.
- Tables without primary keys are not guaranteed to be idempotent.
- Existing incompatible column types are reported rather than changed destructively.

Use `--strict` to fail when an index or constraint cannot be created.

## Development and testing

```bash
npm test
npm run check
```

Integration tests run only when matching credentials are supplied:

```env
TEST_MONGODB_URL=mongodb://localhost:27017
TEST_MONGODB_DATABASE=db_migrate_test
TEST_MYSQL_URL=mysql://root:password@localhost/db_migrate_test
TEST_POSTGRES_URL=postgresql://postgres:password@localhost/db_migrate_test
```

## Documentation

- [Documentation index](docs/index.md)
- [CLI reference](docs/cli.md)
- [Configuration](docs/configuration.md)
- [Architecture](docs/architecture.md)
- [Type mapping and limitations](docs/type-mapping.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Roadmap](docs/roadmap.md)
- [Changelog](docs/changelog.md)
- [Contributing](docs/contributing.md)
- [Security policy](docs/security.md)
- [Code of conduct](docs/code-of-conduct.md)

## License

MIT. See [LICENSE](LICENSE).

## Author

Created and maintained by [Johanssen Azores](https://github.com/johazores).
