# Project Overview

`db-migrate` is a lightweight Node.js database migration and portability toolkit.

It supports direct transfers and portable exports across MongoDB, MySQL, and PostgreSQL through one small adapter contract. It is designed for controlled migrations, development data movement, backups, transformations, and cross-database portability.

The project intentionally does not provide application models, runtime query APIs, or ORM behavior.

## Intended users

- developers moving an application between supported databases;
- teams creating portable development or migration exports;
- maintainers consolidating data from separate systems;
- engineers who need custom row transformation without adopting a full ETL platform.

## Safety position

The tool uses conservative conversion and rollback behavior, but no migration utility can remove the need for backups, staging validation, database permissions, and post-migration verification.
