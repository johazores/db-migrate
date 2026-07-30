# Testing

## Standard checks

```bash
npm test
npm run check
```

## Integration databases

Provide only disposable local or isolated test databases:

```env
TEST_MONGODB_URL=mongodb://localhost:27017
TEST_MONGODB_DATABASE=db_migrate_test
TEST_MYSQL_URL=mysql://root:password@localhost/db_migrate_test
TEST_POSTGRES_URL=postgresql://postgres:password@localhost/db_migrate_test
```

## Test expectations

Changes should cover the smallest relevant layer:

- pure schema and value mapping with unit tests;
- adapter behavior with integration tests;
- command behavior with safe temporary directories and disposable databases;
- checkpoint and export formats with repeatable fixtures;
- destructive behavior with explicit safety assertions.

Never point automated tests at production databases.
