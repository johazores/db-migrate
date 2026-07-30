# Architecture

The toolkit has four small layers:

1. **CLI and config** parse commands and merge flags, files, and environment values.
2. **Adapters** expose the same focused operations for MongoDB, MySQL, and PostgreSQL.
3. **Canonical schema** represents entities, columns, indexes, and foreign keys without ORM models.
4. **Commands** compose adapters for direct migration, export/import, validation, diff, seed, and rollback.

Adapter interface:

```js
{
  connect(),
  disconnect(),
  ping(),
  listEntityNames(),
  inspectSchema(),
  count(entity, filter),
  readBatch(entity, options),
  prepare(schema, options),
  writeBatch(entity, rows, options),
  finalize(schema, options),
  dropEntities(names, options),
}
```

The interface is intentionally small. Adding another database should require one adapter rather than changes throughout the CLI.

## Transfer order

1. Inspect source.
2. Select and rename entities.
3. Create missing target entities.
4. Stream data in batches.
5. Create compatible indexes.
6. Create compatible foreign keys.
7. Save migration history.
8. Remove successful checkpoints.

Indexes and foreign keys are applied after data to improve bulk transfer performance and avoid table ordering problems.

## State

Local state is under `.db-migrate`:

```text
.db-migrate/
  checkpoints/
  history/
```

Checkpoint IDs are hashes. URLs and credentials are not stored in filenames. History masks URL credentials.

## Extending

A future adapter should:

- map native schema metadata to the canonical schema
- read bounded batches
- write idempotently when an identity exists
- clearly report unsupported features
- avoid adding cross-database abstractions unless at least two adapters need them
