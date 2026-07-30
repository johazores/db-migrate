# Data Safety

Database migration can change or destroy data when configuration, schema assumptions, or target state are incorrect.

## Required safeguards

- Maintain independent source and target backups.
- Verify restore procedures before migration.
- Use disposable copies for the first complete run.
- Review schema differences and warnings.
- Use restricted database credentials.
- Validate application behavior after transfer.

## Rollback limits

The automatic rollback command only removes eligible entities created by the latest migration. It does not reconstruct overwritten rows, reverse arbitrary updates, or replace a complete database backup.

## Exports

Portable exports may contain personal, financial, authentication, or business data. Protect output directories with appropriate filesystem permissions and remove them when no longer needed.

## Reporting

Do not attach production exports, connection strings, or customer data to public issues.
