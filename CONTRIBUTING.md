# Contributing

## Principles

- keep the toolkit small and dependency-light
- prefer native database drivers
- add abstractions only when multiple adapters need them
- keep adapters consistent and error messages actionable
- do not add workflows or CI configuration
- document unsupported database behavior

## Setup

```bash
npm install
npm test
npm run check
```

## Branches

Use:

```text
feat/<feature-name>
```

## Commits

Use focused Conventional Commits:

```text
feat:
fix:
refactor:
docs:
test:
chore:
```

Do not include co-author or tooling attribution trailers.

## Tests

Unit tests use Node.js `node:test`.

Integration tests are skipped unless database URLs are supplied. New adapter behavior should include a practical integration scenario and focused unit coverage for pure mapping logic.

## Pull requests

Keep the description concise:

- What changed
- Why it changed
- Testing performed
- Breaking changes, when applicable
