# Repository review and implementation plan

## Original state

The repository began as one MongoDB-to-MongoDB script with environment-only
configuration. It copied documents in batches and recreated basic indexes, but it
was not yet structured as a reusable package or CLI.

The initial review found:

- one executable module with connection, schema, transfer, and logging concerns mixed together
- MongoDB-only configuration and behavior
- a process-wide DNS override and hard-coded connection options
- no command parser, public API, adapter boundary, tests, migration history, or checkpoints
- index failures reported only as warnings with no strict mode
- documentation limited to the original MongoDB copy workflow
- no reliable rollback boundary or cross-database type conversion model

## Research conclusions

The useful conventions from established migration tools are predictable commands,
a small configuration file, explicit migration state, dry runs, status/diff output,
reversible operations where safety permits, and clear generated migration summaries.

The complexity intentionally avoided here includes ORM models, application schema
generation, environment-specific configuration trees, plugin containers, and hidden
automatic destructive changes.

## Prioritized implementation

1. Add a dependency-light CLI and deterministic configuration precedence.
2. Define one small adapter contract for MongoDB, MySQL, and PostgreSQL.
3. Introduce a conservative canonical schema and documented type mapping.
4. Stream data in batches with resumable checkpoints and idempotent writes where keys exist.
5. Add export/import, validation, diff, seeding, guarded rollback, transforms, and filters.
6. Cover pure behavior with the built-in Node.js test runner and provide opt-in database integration scenarios.
7. Rewrite the documentation around real workflows, limitations, and extension points.

## Resulting boundaries

The toolkit migrates collections/tables, top-level fields/columns, common indexes,
compatible foreign keys, and row/document data. Database-specific procedures,
triggers, views, partitions, permissions, extensions, and specialty index semantics
remain outside the automatic portability layer and are reported as limitations rather
than guessed or silently rewritten.

Future database support should require one adapter implementing the existing contract
and type mappings, without changing the transfer engine or CLI command model.
