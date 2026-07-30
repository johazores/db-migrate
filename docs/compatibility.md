# Compatibility

## Runtime

- Node.js 20 or newer
- CommonJS configuration and module loading

## Databases

The project supports current driver-compatible releases of:

- MongoDB
- MySQL
- PostgreSQL

Exact database-server compatibility depends on the installed native driver versions and the schema features used by the source database.

## Compatibility policy

- Document database-specific limitations instead of silently approximating behavior.
- Preserve portable data values where a safe representation exists.
- Warn or fail when indexes, constraints, or types cannot be represented.
- Avoid destructive type changes to existing target columns.

Compatibility reports should include the database server versions, Node.js version, migration direction, and smallest safe schema reproduction.
