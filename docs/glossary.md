# Glossary

## Adapter

A database-specific implementation of the shared connection, schema inspection, batch reading, writing, and cleanup operations.

## Canonical schema

The database-neutral representation used to compare and prepare entities, columns, indexes, and foreign keys.

## Checkpoint

Saved local progress that allows a supported migration or export operation to continue after interruption.

## Entity

A MongoDB collection or SQL table handled as one transferable unit.

## Identity

A primary key or comparable source value used for pagination and idempotent writes.

## Migration history

A local record of completed migration activity with sensitive connection details masked.

## Portable export

A manifest and NDJSON data files that preserve supported special values through explicit markers.

## Strict mode

A mode that fails instead of warning when compatible indexes or constraints cannot be created.
