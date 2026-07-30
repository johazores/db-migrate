# db-migrate

A lightweight Node.js database migration and data portability toolkit for MongoDB, MySQL, and PostgreSQL.

## Quick start

```bash
npm install
node bin/db-migrate.js init
node bin/db-migrate.js validate
node bin/db-migrate.js migrate --dry-run
node bin/db-migrate.js migrate
```

The toolkit provides `init`, `validate`, `diff`, `migrate`, `export`, `import`, `seed`, and guarded `rollback` commands through one adapter-based API. It streams data in batches, supports resumable checkpoints, and avoids ORM models or application-level schema abstractions.

Run `node bin/db-migrate.js --help` for all options.
