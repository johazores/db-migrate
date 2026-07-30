const { loadConfig, validateConfig } = require("./config");
const { createLogger } = require("./logger");
const { MigrationError } = require("./errors");

const commands = {
  init: () => require("./commands/init"),
  validate: () => require("./commands/validate"),
  diff: () => require("./commands/diff"),
  migrate: () => require("./commands/migrate"),
  export: () => require("./commands/export"),
  import: () => require("./commands/import"),
  seed: () => require("./commands/seed"),
  rollback: () => require("./commands/rollback"),
};

const aliases = {
  c: "config",
  b: "batch-size",
  o: "output",
  i: "input",
  e: "entities",
  v: "verbose",
  h: "help",
};

const booleanFlags = new Set([
  "help",
  "version",
  "dry-run",
  "verbose",
  "debug",
  "strict",
  "drop",
  "resume",
  "no-resume",
  "no-color",
  "force",
  "json",
  "yes",
]);

function camelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function parseArguments(args) {
  const flags = {};
  const positional = [];

  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];

    if (item === "--") {
      positional.push(...args.slice(index + 1));
      break;
    }

    if (!item.startsWith("-")) {
      positional.push(item);
      continue;
    }

    const withoutPrefix = item.replace(/^-+/, "");
    const [rawName, inlineValue] = withoutPrefix.split(/=(.*)/s);
    const name = aliases[rawName] || rawName;
    const key = camelCase(name);

    if (booleanFlags.has(name)) {
      if (name === "no-resume") {
        flags.resume = false;
      } else {
        flags[key] = true;
      }
      continue;
    }

    const value = inlineValue !== undefined ? inlineValue : args[index + 1];

    if (value === undefined || value.startsWith("-")) {
      throw new MigrationError(`Missing value for --${name}`, {
        code: "MISSING_FLAG_VALUE",
      });
    }

    flags[key] = value;
    if (inlineValue === undefined) index += 1;
  }

  return {
    command: positional[0],
    positional: positional.slice(1),
    flags,
  };
}

function helpText() {
  return `db-migrate - lightweight database migration toolkit

Usage:
  db-migrate <command> [options]

Commands:
  init       Create a starter configuration
  validate   Validate configuration and database connections
  migrate    Stream schema and data from source to target
  export     Export schema and data to an NDJSON directory
  import     Import a previous export
  diff       Compare source and target schemas
  seed       Load JSON or NDJSON data into one target entity
  rollback   Remove entities created by the latest migration

Connection options:
  --config <path>             Config file path
  --source-type <type>        mongodb, mysql, or postgres
  --source-url <url>          Source connection URL
  --source-database <name>    MongoDB/MySQL source database
  --source-schema <name>      PostgreSQL source schema
  --target-type <type>        mongodb, mysql, or postgres
  --target-url <url>          Target connection URL
  --target-database <name>    MongoDB/MySQL target database
  --target-schema <name>      PostgreSQL target schema

Migration options:
  -b, --batch-size <number>   Rows/documents per batch (default: 500)
  -e, --entities <names>      Comma-separated tables or collections
  --filter <json>             Per-entity filters
  --sample-size <number>      MongoDB schema sample size (default: 100)
  --drop                      Drop selected target entities first
  --dry-run                   Preview schema actions without writing
  --no-resume                 Ignore saved checkpoints
  --strict                    Fail on unsupported indexes or constraints
  --verbose                   Show detailed progress
  --debug                     Show debug output and stack traces
  --no-color                  Disable ANSI colors

Export/import:
  -o, --output <directory>    Export directory
  -i, --input <directory>     Import directory

Seed:
  --entity <name>             Target table or collection
  --file <path>               JSON or NDJSON seed file

Rollback:
  --operation <name>          History type: migrate or import (default: migrate)
  --yes                       Confirm destructive rollback

Other:
  -h, --help                  Show help
  --version                   Show package version
`;
}

async function run(args = []) {
  const parsed = parseArguments(args);

  if (parsed.flags.version) {
    process.stdout.write(`${require("../package.json").version}\n`);
    return;
  }

  if (parsed.flags.help || !parsed.command) {
    process.stdout.write(helpText());
    return;
  }

  const commandFactory = commands[parsed.command];

  if (!commandFactory) {
    throw new MigrationError(`Unknown command: ${parsed.command}`, {
      code: "UNKNOWN_COMMAND",
      hint: "Run db-migrate --help to list available commands.",
    });
  }

  if (parsed.flags.debug) {
    process.env.DB_MIGRATE_DEBUG = "true";
  }

  const logger = createLogger({
    color: !parsed.flags.noColor,
    debug: parsed.flags.debug,
    verbose: parsed.flags.verbose,
  });

  if (parsed.command === "init") {
    return commandFactory().run({
      flags: parsed.flags,
      logger,
    });
  }

  const config = await loadConfig(parsed.flags);
  config.dryRun = Boolean(parsed.flags.dryRun);
  validateConfig(config, parsed.command);

  return commandFactory().run({
    config,
    flags: parsed.flags,
    logger,
    positional: parsed.positional,
  });
}

module.exports = {
  helpText,
  parseArguments,
  run,
};
