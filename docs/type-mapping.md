# Type mapping and limitations

## Portable types

| Portable type | MySQL | PostgreSQL | MongoDB |
| --- | --- | --- | --- |
| `boolean` | `BOOLEAN` | `BOOLEAN` | Boolean |
| `integer` | `INT` | `INTEGER` | Number |
| `bigint` | `BIGINT` | `BIGINT` | Long/string marker |
| `decimal` | `DECIMAL` | `NUMERIC` | Decimal128/string marker |
| `string` | `VARCHAR` | `VARCHAR` | String |
| `text` | `LONGTEXT` | `TEXT` | String |
| `date` | `DATE` | `DATE` | Date |
| `datetime` | `DATETIME(6)` | `TIMESTAMPTZ` | Date |
| `binary` | `LONGBLOB` | `BYTEA` | Binary |
| `json` | `JSON` | `JSONB` | Object/array |
| `uuid` | `CHAR(36)` | `UUID` | String |
| `objectId` | `VARCHAR(24)` | `VARCHAR(24)` | ObjectId |

## MongoDB inference

MongoDB does not require every document to share a schema. The adapter samples documents and:

- inspects top-level fields
- makes fields nullable when they are missing or null
- widens mixed numeric values
- maps nested objects and arrays to JSON
- treats `_id` as the primary identity

Increase `sampleSize` when collections contain highly variable documents.

## Unsupported or lossy features

The following are warned about, simplified, or excluded:

- views and materialized views
- stored procedures, triggers, events, and functions
- generated columns and arbitrary default expressions
- partial, expression, text, geospatial, and database-specific indexes
- partitions, inheritance, extensions, tablespaces, and permissions
- cross-collection MongoDB relationships
- enum and set semantics beyond portable JSON/string storage
- exact timezone behavior when source types do not store timezone
- automatic destructive alteration of incompatible existing columns

Use a JavaScript transform or manual migration for domain-specific conversions.

## Mixed and unsupported types

Mixed MongoDB field types that cannot share one safe scalar SQL type are mapped to
JSON/JSONB. Unknown SQL-native values also use the portable JSON representation
rather than relying on implicit database coercion.
