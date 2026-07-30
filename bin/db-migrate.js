#!/usr/bin/env node

const { run } = require("../src/cli");

run(process.argv.slice(2)).catch((error) => {
  const { formatError } = require("../src/errors");
  console.error(formatError(error));
  process.exitCode = 1;
});
