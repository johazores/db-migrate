const ANSI = {
  reset: "\u001b[0m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  blue: "\u001b[34m",
  gray: "\u001b[90m",
  bold: "\u001b[1m",
};

function createLogger(options = {}) {
  const enabled =
    options.color !== false &&
    !process.env.NO_COLOR &&
    Boolean(process.stdout.isTTY);

  const paint = (color, value) =>
    enabled ? `${ANSI[color]}${value}${ANSI.reset}` : value;

  const write = (stream, prefix, message) => {
    stream.write(`${prefix}${message}\n`);
  };

  return {
    info(message) {
      write(process.stdout, paint("blue", "• "), message);
    },
    success(message) {
      write(process.stdout, paint("green", "✓ "), message);
    },
    warn(message) {
      write(process.stderr, paint("yellow", "! "), message);
    },
    error(message) {
      write(process.stderr, paint("red", "✗ "), message);
    },
    debug(message) {
      if (options.debug || options.verbose) {
        write(process.stderr, paint("gray", "  "), message);
      }
    },
    heading(message) {
      write(process.stdout, "", paint("bold", message));
    },
    progress(entity, processed, total) {
      const suffix = Number.isFinite(total) ? `/${total}` : "";
      write(process.stdout, paint("blue", "  → "), `${entity}: ${processed}${suffix}`);
    },
  };
}

module.exports = {
  createLogger,
};
