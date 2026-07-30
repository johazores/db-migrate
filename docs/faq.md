# Frequently Asked Questions

## Is this an ORM?

No. It does not provide application models or a runtime query layer.

## Which databases are supported?

MongoDB, MySQL, and PostgreSQL.

## Can every schema feature be converted?

No. Stored procedures, triggers, views, generated expressions, partitions, extensions, permissions, and some database-specific index behavior are outside automatic conversion.

## Is rollback a replacement for backups?

No. Rollback is deliberately limited and cannot reconstruct arbitrary overwritten data.

## Can migrations resume?

Yes. Supported commands save local checkpoints when resume behavior is enabled.

## Are nested MongoDB values supported in SQL targets?

Nested objects and arrays are preserved through JSON or JSONB columns where supported.

## Can rows be transformed?

Yes. JavaScript configuration can provide a transform function and may return `null` to discard a row.

## Should it be tested with production data first?

No. Test with disposable copies and verify backups before production use.
