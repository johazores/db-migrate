# Migration Checklist

## Before migration

- [ ] Back up the source and target databases.
- [ ] Verify that backups can be restored.
- [ ] Confirm source read and target write permissions.
- [ ] Review type mappings and unsupported features.
- [ ] Run `db-migrate validate`.
- [ ] Run the migration with `--dry-run`.
- [ ] Test the workflow against disposable copies.
- [ ] Confirm available storage and maintenance time.

## During migration

- [ ] Keep checkpoints enabled when appropriate.
- [ ] Record the exact configuration and version used.
- [ ] Monitor failures, skipped constraints, and warnings.
- [ ] Avoid unrelated schema or application changes.

## After migration

- [ ] Compare entity and row counts.
- [ ] Validate important relationships and indexes.
- [ ] Test application reads and writes.
- [ ] Review migration history and warnings.
- [ ] Keep the source and backups until acceptance is complete.
