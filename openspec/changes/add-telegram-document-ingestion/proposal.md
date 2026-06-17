## Why

Users need a simple way to send business documents to a Telegram bot and have those files durably stored with searchable metadata. This change creates the first ingestion path by combining Telegram uploads, S3-compatible object storage, and PostgreSQL records.

## What Changes

- Add a TypeScript Telegram bot service that runs with long polling.
- Accept `document` and `photo` messages from configured allowlisted Telegram users.
- Store received files in S3-compatible object storage, optimized for local MinIO in development.
- Persist one PostgreSQL upload record per accepted Telegram message/file.
- Add local Docker Compose services for PostgreSQL and MinIO.
- Add configuration, tests, and developer scripts for running and validating the service.

## Capabilities

### New Capabilities

- `telegram-document-ingestion`: Receive Telegram file uploads, store the file object, and record upload metadata.

### Modified Capabilities

- None.

## Impact

- Adds Node.js TypeScript application code, Prisma schema/migration, and tests.
- Adds runtime dependencies for Telegram handling, PostgreSQL persistence, S3-compatible storage, and environment validation.
- Adds Docker Compose development infrastructure for PostgreSQL and MinIO.
