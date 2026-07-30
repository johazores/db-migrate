# Configuration Security

## Credentials

Supply connection strings through environment variables or another secure runtime mechanism. Do not commit `.env` files, database passwords, private hostnames, or production connection examples.

## Permissions

Use database accounts with only the permissions required for the operation. Separate read-only source access from target write access when practical.

## Logs and state

Review verbose and debug output before sharing it. The project masks credentials in migration history and avoids placing URLs in checkpoint names, but users should still treat generated logs and exports as sensitive.

## Configuration files

JavaScript configuration can execute code through transforms. Only run trusted configuration files. Do not accept unreviewed migration configuration from external users or unknown repositories.

## Production use

Validate configuration against disposable copies before production execution. Confirm backups, target capacity, maintenance windows, and post-migration checks independently of the tool.
