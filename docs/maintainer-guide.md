# Maintainer Guide

## Review priorities

Review changes in this order:

1. data safety and destructive behavior;
2. adapter consistency;
3. migration correctness and idempotency;
4. clear unsupported-feature reporting;
5. test coverage and documentation;
6. dependency and maintenance cost.

## Pull requests

Keep pull requests focused. Prefer changes that preserve the existing adapter contract and avoid introducing framework-level abstractions.

## Issues

Ask reporters to provide sanitized configuration, database versions, source and target directions, and the smallest reproducible schema or data sample.

## Security

Move reports involving credentials, data exposure, unsafe destructive behavior, or command execution to a private channel immediately.

## Releases

Use the release process in [release-process.md](release-process.md) and update [changelog.md](changelog.md) before publishing.
