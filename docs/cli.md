# CLI reference

## Global connection flags

| Option | Description |
| --- | --- |
| `--config <path>` | JavaScript, CommonJS, or JSON config file |
| `--source-type <type>` | `mongodb`, `mysql`, or `postgres` |
| `--source-url <url>` | Source connection URL |
| `--source-database <name>` | MongoDB or MySQL database |
| `--source-schema <name>` | PostgreSQL source schema |
| `--target-type <type>` | `mongodb`, `mysql`, or `postgres` |
| `--target-url <url>` | Target connection URL |
| `--target-database <name>` | MongoDB or MySQL database |
| `--target-schema <name>` | PostgreSQL target schema |

## Migration flags

| Option | Description |
| --- | --- |
| `--batch-size <number>` | Rows or documents per batch |
| `--entities <names>` | Comma-separated entity list |
| `--filter <json>` | Per-entity equality filters |
| `--sample-size <number>` | MongoDB inference sample |
| `--drop` | Drop selected target entities first |
| `--dry-run` | Preview target schema actions |
| `--no-resume` | Ignore saved checkpoints |
| `--strict` | Fail when indexes or constraints cannot be copied |
| `--verbose` | Detailed operational output |
| `--debug` | Debug output and stack traces |
| `--no-color` | Disable ANSI color |

## `init`

Creates `db-migrate.config.js` and creates `.env` only when it does not exist.

```bash
db-migrate init
db-migrate init --force
```

## `validate`

Checks configuration, connects to both databases, pings them, and reports adapter capabilities.

```bash
db-migrate validate
```

## `migrate`

Inspects the source schema, prepares the target, transfers data in batches, then creates indexes and compatible foreign keys.

```bash
db-migrate migrate
db-migrate migrate --entities users,orders --dry-run
```

## `export`

Writes `manifest.json` and one NDJSON data file per entity.

```bash
db-migrate export --output ./backup
```

## `import`

Imports a directory created by `export`.

```bash
db-migrate import --input ./backup
```

## `diff`

Reports missing entities, missing columns, extra target entities, and portable type differences.

```bash
db-migrate diff
db-migrate diff --json
```

## `seed`

Loads a JSON array, JSON object, or NDJSON file into one target table or collection.

```bash
db-migrate seed --entity users --file ./seeds/users.json
```

## `rollback`

Drops only entities recorded as newly created by the latest migration.

```bash
db-migrate rollback --yes
db-migrate rollback --operation import --yes
db-migrate rollback --dry-run
```
