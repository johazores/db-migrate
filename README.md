# MongoDB Migration Tool

Simple Node.js script to migrate one MongoDB database to another MongoDB database.

## Setup

```bash
npm install
```

Copy the example env file:

```bash
cp .env.example .env
```

Update `.env` with your real MongoDB connection strings:

```env
SOURCE_MONGODB_URI="mongodb+srv://USER:PASSWORD@HOST1/database?retryWrites=true&w=majority"
TARGET_MONGODB_URI="mongodb+srv://USER:PASSWORD@HOST2/database?retryWrites=true&w=majority"
DB_NAME="database"
BATCH_SIZE=500
DROP_TARGET=false
```

## Run migration

```bash
npm run migrate
```

## Migration Strategy

This tool uses upsert-based migration for safe, idempotent operations:

- Documents are matched by `_id` and replaced if they exist
- New documents are inserted, existing ones are updated
- Safe to re-run multiple times without duplicating data
- If migration fails halfway, simply re-run to pick up where it left off
- All indexes are copied after documents are migrated

## Configuration

- `BATCH_SIZE`: Number of documents to process per batch (default: 500)
- `DROP_TARGET`: Set to true to drop the target collection before migrating (not recommended - use upsert instead)
- `DB_NAME`: The database name to migrate

## DNS Issues on Windows

If you encounter DNS errors like `querySrv ECONNREFUSED`, the script automatically uses Google and Cloudflare DNS servers. If needed, you can manually set DNS in your system network settings:

- Primary: 8.8.8.8 (Google)
- Secondary: 1.1.1.1 (Cloudflare)

## Notes

- This script copies collections, documents, and indexes
- Make sure both MongoDB clusters allow your IP address in Network Access
- If your MongoDB password has special characters like `@`, `#`, `/`, `:`, encode it in the URI
- Uses bulk write operations for performance optimization
