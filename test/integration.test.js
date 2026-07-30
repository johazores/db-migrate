const test = require("node:test");
const assert = require("node:assert/strict");
const { createAdapter } = require("../src/adapters");

const databases = [
  ["mongodb", process.env.TEST_MONGODB_URL, process.env.TEST_MONGODB_DATABASE],
  ["mysql", process.env.TEST_MYSQL_URL],
  ["postgres", process.env.TEST_POSTGRES_URL],
];

for (const [type, url, database] of databases) {
  test(
    `${type} adapter connects when integration credentials are provided`,
    { skip: !url },
    async () => {
      const adapter = createAdapter(
        {
          type,
          url,
          database,
          schema: "public",
        },
        {
          debug() {},
          warn() {},
        }
      );

      await adapter.connect();
      try {
        await adapter.ping();
        assert.ok(Array.isArray(await adapter.listEntityNames()));
      } finally {
        await adapter.disconnect();
      }
    }
  );
}
