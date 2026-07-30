# Documentation Style

Use clear English, short sections, and practical examples.

## File organization

- Keep supporting Markdown documentation under `docs/`.
- Use lowercase kebab-case filenames.
- Keep `README.md` at the repository root because GitHub uses it as the project landing page.
- Keep automated GitHub templates under `.github/` only when GitHub requires that location.

## Content rules

- Describe current behavior before planned behavior.
- Mark planned features clearly.
- Avoid duplicate setup instructions.
- Link to one authoritative document for detailed subjects.
- Use fenced code blocks with the correct language.
- Never include real credentials, private hosts, or production data.
- Avoid generated-by notices, assistant signatures, or tooling attribution.

## Maintenance

Update affected documentation in the same pull request as behavior changes. Archive historical reviews when they no longer describe the current implementation.
