# Roadmap

`db-migrate` is intended to stay small, dependency-light, and focused on database migration and data portability rather than ORM behavior.

## Current priorities

- Stabilize the MongoDB, MySQL, and PostgreSQL adapter contracts.
- Expand integration coverage for supported migration directions.
- Improve schema-diff reporting and unsupported-feature diagnostics.
- Document repeatable production migration and rollback practices.
- Prepare a clearly named npm release that avoids confusion with existing migration packages.

## Planned improvements

- Additional type-mapping fixtures and edge-case coverage.
- Better progress reporting for long transfers.
- Configurable verification after migration.
- Safer handling for composite identities and tables without primary keys.
- Import and export compatibility tests across supported databases.

## Later consideration

New database adapters may be considered when they can use the existing focused interface without expanding the project into an ORM or framework.

## Out of scope

- Application model generation.
- Query builders.
- Runtime data access layers.
- Automatic conversion of every database-specific feature.
- Guaranteed reversal of destructive production changes without backups.
