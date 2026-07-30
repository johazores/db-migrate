# Release Process

## Before release

1. Run `npm test`.
2. Run `npm run check`.
3. Test representative migrations against disposable MongoDB, MySQL, and PostgreSQL databases.
4. Confirm the changelog describes user-visible and breaking changes.
5. Confirm package metadata, documentation, and supported Node.js versions are accurate.
6. Verify that no credentials, generated backups, or migration state files are included.

## Versioning

Use semantic versioning:

- patch for backward-compatible fixes;
- minor for backward-compatible features;
- major for breaking configuration, command, adapter, or data-format changes.

## Release notes

Release notes should summarize:

- supported migration directions;
- important fixes and new features;
- breaking changes;
- known limitations;
- upgrade or migration steps.

Do not describe the package as production-safe without recommending backups and test migrations.
