# Architecture Decisions

## Native drivers

Use native database drivers instead of introducing an ORM. Migration behavior needs access to database-specific metadata and bulk operations without adding an application model layer.

## Canonical schema

Represent common entities, columns, indexes, and foreign keys in one small canonical schema. Preserve database-specific limitations rather than pretending every feature maps safely.

## Adapter boundary

Each database implements the same focused operations for connection, inspection, batching, preparation, writes, finalization, and cleanup.

## Portable exports

Use NDJSON and explicit value markers so exports remain streamable and preserve non-standard values such as ObjectIds, binary data, dates, decimals, and large integers.

## Conservative rollback

Automatically remove only entities created by the latest eligible migration. Do not claim to reverse arbitrary updates without backups or a complete change log.

## Local checkpoints

Store resumable progress locally with hashed identifiers and masked credentials. Never place connection strings in checkpoint paths.
