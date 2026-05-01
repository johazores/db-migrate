require("dotenv").config();

const dns = require("dns");
const { MongoClient } = require("mongodb");

// Override DNS servers
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const SOURCE_URI = process.env.SOURCE_MONGODB_URI;
const TARGET_URI = process.env.TARGET_MONGODB_URI;
const DB_NAME = process.env.DB_NAME;
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 500);
const DROP_TARGET = process.env.DROP_TARGET === "true";

if (!SOURCE_URI || !TARGET_URI) {
  console.error("Missing SOURCE_MONGODB_URI or TARGET_MONGODB_URI in .env");
  process.exit(1);
}

async function copyIndexes(sourceCollection, targetCollection) {
  const indexes = await sourceCollection.indexes();

  for (const index of indexes) {
    if (index.name === "_id_") continue;

    const { key, name, ns, v, ...options } = index;

    try {
      await targetCollection.createIndex(key, {
        ...options,
        name,
      });
      console.log(`  Index copied: ${name}`);
    } catch (error) {
      console.warn(`  Failed to copy index ${name}: ${error.message}`);
    }
  }
}

async function migrateCollection(sourceDb, targetDb, collectionName) {
  console.log(`\nMigrating collection: ${collectionName}`);

  const sourceCollection = sourceDb.collection(collectionName);
  const targetCollection = targetDb.collection(collectionName);

  if (DROP_TARGET) {
    try {
      await targetCollection.drop();
      console.log("  Target collection dropped");
    } catch (error) {
      if (error.codeName !== "NamespaceNotFound") {
        throw error;
      }
    }
  }

  const totalDocuments = await sourceCollection.countDocuments();
  console.log(`  Documents found: ${totalDocuments}`);

  if (totalDocuments === 0) {
    await targetDb.createCollection(collectionName).catch(() => {});
    await copyIndexes(sourceCollection, targetCollection);
    console.log("  Done: empty collection created");
    return;
  }

  const cursor = sourceCollection.find({});
  let batch = [];
  let copied = 0;

  for await (const document of cursor) {
    batch.push(document);

    if (batch.length >= BATCH_SIZE) {
      const bulkOps = batch.map((doc) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      }));
      await targetCollection.bulkWrite(bulkOps);
      copied += batch.length;
      console.log(`  Copied ${copied}/${totalDocuments}`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    const bulkOps = batch.map((doc) => ({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    }));
    await targetCollection.bulkWrite(bulkOps);
    copied += batch.length;
    console.log(`  Copied ${copied}/${totalDocuments}`);
  }

  await copyIndexes(sourceCollection, targetCollection);
  console.log(`  Done: ${collectionName}`);
}

async function migrateDatabase() {
  const sourceClient = new MongoClient(SOURCE_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 60000,
    family: 4,
    retryWrites: true,
    authSource: "admin",
  });
  const targetClient = new MongoClient(TARGET_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 60000,
    family: 4,
    retryWrites: true,
    authSource: "admin",
  });

  try {
    console.log("Connecting to source MongoDB...");
    await sourceClient.connect();

    console.log("Connecting to target MongoDB...");
    await targetClient.connect();

    const sourceDb = sourceClient.db(DB_NAME);
    const targetDb = targetClient.db(DB_NAME);

    const collections = await sourceDb.listCollections().toArray();

    if (!collections.length) {
      console.log(`No collections found in database: ${DB_NAME}`);
      return;
    }

    console.log(`Found ${collections.length} collection(s)`);

    for (const collection of collections) {
      await migrateCollection(sourceDb, targetDb, collection.name);
    }

    console.log("\nDatabase migration complete");
  } catch (error) {
    console.error("\nMigration failed:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await sourceClient.close();
    await targetClient.close();
  }
}

migrateDatabase();
