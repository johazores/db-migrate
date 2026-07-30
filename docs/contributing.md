# Contributing

Thank you for helping improve `db-migrate`.

## Development setup

```bash
npm install
npm test
npm run check
```

Integration tests run only when matching database credentials are available. Never use production databases for contributor testing.

## Branches

Use focused branches:

```text
feat/<feature-name>
fix/<issue-name>
docs/<topic>
```

## Commits

Use focused Conventional Commits such as `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, and `chore:`.

## Design principles

- Keep the toolkit small and dependency-light.
- Prefer native database drivers.
- Add abstractions only when multiple adapters need them.
- Keep adapter behavior consistent.
- Document unsupported database behavior.
- Preserve safe defaults for destructive operations.
- Do not add or modify GitHub Actions without a separate workflow and cost review.

## Pull requests

Include:

- what changed;
- why it changed;
- testing performed;
- breaking changes, when applicable.

New adapter behavior should include focused unit coverage and a practical integration scenario.
