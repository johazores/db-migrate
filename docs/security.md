# Security Policy

## Supported versions

Security fixes are applied to the latest released version and the current default branch.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability involving credentials, connection strings, destructive migration behavior, data exposure, or command execution.

Contact the maintainer through the GitHub profile and include:

- the affected command or module;
- the database adapters involved;
- the smallest safe reproduction;
- the expected and actual behavior;
- the potential impact.

Remove passwords, tokens, private hostnames, and production data from all examples.

## Security boundaries

`db-migrate` connects directly to databases using credentials supplied by the operator. Users are responsible for database permissions, network access, backups, and reviewing destructive commands before execution.

Use restricted database accounts whenever possible. Test migrations against disposable copies before using production data. Never commit `.env` files or connection strings.

## Destructive operations

Rollback and drop behavior is intentionally limited. A migration tool cannot guarantee recovery from every cross-database conversion. Maintain an independent backup and verify it before running destructive operations.
