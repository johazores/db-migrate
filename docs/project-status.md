# Project Status

`db-migrate` is under active development.

## Current maturity

- The MongoDB, MySQL, and PostgreSQL adapter architecture is implemented.
- Direct migration, export, import, diff, validation, seeding, checkpoints, and guarded rollback are available.
- Unit tests cover core mapping and migration behavior.
- Integration tests require locally supplied database credentials.

## Before broader adoption

- Complete repeatable adapter integration coverage.
- Finalize package and CLI naming before npm publication.
- Publish versioned releases with upgrade notes.
- Validate representative large-data migrations.
- Expand post-migration verification and diagnostics.

The project should be presented as a capable open-source toolkit in active development, not as a guarantee against data loss or database-specific conversion limitations.
