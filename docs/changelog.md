# Changelog

Notable changes to `db-migrate` are documented here.

The project follows semantic versioning after the first stable release. Until then, releases may include breaking changes when clearly documented.

## Unreleased

### Added

- Open-source security and repository governance documentation.

## 2.0.0

### Added

- MongoDB, MySQL, and PostgreSQL adapters.
- Direct database-to-database migration.
- Portable NDJSON export and import.
- Schema inspection, diffing, type mapping, and validation.
- Batched transfers, resumable checkpoints, filters, renaming, and transforms.
- Conservative rollback support and migration history.

### Changed

- Expanded the original MongoDB-only script into a database portability toolkit.
- Removed global DNS overrides and forced connection behavior.

### Security

- Connection credentials are excluded from checkpoint names and masked in migration history.
- SQL filters use parameterized queries.
