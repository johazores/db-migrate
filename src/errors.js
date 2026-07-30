class MigrationError extends Error {
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = "MigrationError";
    this.code = options.code || "MIGRATION_ERROR";
    this.hint = options.hint;
    this.details = options.details;
  }
}

function formatError(error) {
  const lines = [`Error: ${error.message || String(error)}`];

  if (error.code) {
    lines.push(`Code: ${error.code}`);
  }

  if (error.hint) {
    lines.push(`Hint: ${error.hint}`);
  }

  if (error.details) {
    lines.push(
      `Details: ${
        typeof error.details === "string"
          ? error.details
          : JSON.stringify(error.details, null, 2)
      }`
    );
  }

  if (process.env.DB_MIGRATE_DEBUG === "true" && error.stack) {
    lines.push(error.stack);
  }

  return lines.join("\n");
}

module.exports = {
  MigrationError,
  formatError,
};
