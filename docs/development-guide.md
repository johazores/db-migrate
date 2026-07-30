# Development Guide

## Setup

```bash
npm install
npm test
npm run check
```

Run the CLI from the repository:

```bash
node bin/db-migrate.js --help
```

## Architecture rules

- Keep the adapter interface focused.
- Keep database-specific behavior inside adapters.
- Keep canonical schema logic database-neutral.
- Keep commands responsible for orchestration rather than native database details.
- Add shared abstractions only when at least two adapters require them.

## Adding behavior

1. Define the expected cross-database behavior and limitations.
2. Add focused pure-function coverage where possible.
3. Implement adapter-specific behavior behind the existing interface.
4. Add a practical integration scenario.
5. Update affected user and architecture documentation.

## Local state

Generated checkpoints and migration history are stored under `.db-migrate/` and must not be committed.
