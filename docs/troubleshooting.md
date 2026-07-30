# Troubleshooting

## Connection failed

Run:

```bash
db-migrate validate --debug
```

Check the connection URL, credentials, firewall rules, database name, and PostgreSQL schema.

The toolkit does not override system DNS or force MongoDB `authSource`, IPv4, or retry settings. Supply required native options in the config:

```js
source: {
  type: "mongodb",
  url: process.env.DB_MIGRATE_SOURCE_URL,
  database: "app",
  options: {
    authSource: "admin",
    family: 4,
  },
}
```

## Duplicate key

A unique index or primary key conflicts with source data.

- inspect duplicate source identities
- run `diff`
- migrate into an empty target
- use a transform to normalize identity values

## Unsupported type

Run `diff --json` to inspect the portable type mismatch. Add a transform for values that cannot be mapped automatically.

## Migration stopped

Run the same command again. Checkpoints resume completed batches.

Use `--no-resume` to restart progress tracking. This does not remove previously written target rows.

## Index or constraint skipped

Run with `--strict` to fail immediately. Without strict mode, data migration completes and reports unsupported indexes or constraints.

## Rollback refused

Rollback is intentionally limited. It only removes entities created by the latest migration. Updates to existing entities require a backup or a manual reverse migration.
