## Context

The repository currently contains an OpenSpec scaffold and no application runtime. This change introduces the first Node.js TypeScript service: a Telegram bot that receives documents/photos, stores file bytes in S3-compatible object storage, and writes upload metadata to PostgreSQL. Local development is optimized for MinIO and PostgreSQL through Docker Compose while keeping the storage client compatible with cloud object storage later.

## Goals / Non-Goals

**Goals:**

- Run a Telegram bot with long polling for the v1 ingestion flow.
- Accept Telegram `document` and `photo` uploads from configured allowlisted users.
- Store accepted file bytes in S3-compatible object storage.
- Persist upload status, Telegram metadata, and object storage references in PostgreSQL.
- Provide local development configuration, migrations, tests, and scripts.

**Non-Goals:**

- OCR, text extraction, antivirus scanning, previews, or file transformations.
- Public HTTP API or Telegram webhook deployment.
- Multi-tenant authorization, admin UI, or search interface.
- Automatic cleanup of stored objects when later database writes fail.

## Decisions

- Use Node.js TypeScript because the repo is already Node-based and type safety helps across Telegram, storage, and database boundaries. Python was considered but would diverge from the current project scaffold.
- Use Telegraf long polling for v1 because it keeps local and server deployment simple. Webhooks can be added later if the service needs horizontally scalable deployment.
- Use Prisma for PostgreSQL access because it provides migrations, a generated client, and typed persistence in a small service.
- Use `@aws-sdk/client-s3` with endpoint/path-style configuration so MinIO is the default local target and cloud S3-compatible providers remain possible.
- Persist failed accepted upload attempts in PostgreSQL when possible. Unauthorized messages are not recorded because they are rejected before file processing.
- Generate object keys as `telegram/YYYY/MM/DD/<chatId>/<messageId>/<safeFileNameOrFileId>` so objects are traceable without relying on user-provided names alone.

## Risks / Trade-offs

- Object can remain in storage if PostgreSQL fails after upload -> report failure and record the implementation limitation; a future cleanup job can reconcile orphaned objects.
- Long polling limits multi-instance deployment -> acceptable for v1; move to webhooks before scaling horizontally.
- Telegram-provided MIME metadata can be absent or inaccurate -> store it as metadata only and do not infer trusted content type.
- Allowlist configuration mistakes can block legitimate users -> fail fast on invalid configuration and document the expected comma-separated numeric IDs.

## Migration Plan

- Add the Prisma schema and initial migration for upload records.
- Add Docker Compose services for local PostgreSQL and MinIO.
- Run migrations before starting the bot in a new environment.
- Roll back by stopping the bot service; stored objects and database records are additive.

## Open Questions

- None for v1.
