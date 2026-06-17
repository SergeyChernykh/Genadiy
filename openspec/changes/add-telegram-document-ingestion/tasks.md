## 1. Project Setup

- [x] 1.1 Add TypeScript runtime, test, lint/build, Telegram, Prisma, PostgreSQL, and S3 dependencies.
- [x] 1.2 Add TypeScript, Vitest, environment, and development scripts.
- [x] 1.3 Add local Docker Compose services and `.env.example` for PostgreSQL and MinIO.

## 2. Persistence and Storage

- [x] 2.1 Add Prisma upload record schema and initial PostgreSQL migration.
- [x] 2.2 Implement configuration parsing and allowlist validation.
- [x] 2.3 Implement object key generation, filename sanitization, and S3 upload service.
- [x] 2.4 Implement upload record persistence service.

## 3. Telegram Bot Flow

- [x] 3.1 Implement Telegram document/photo extraction and size checks.
- [x] 3.2 Implement authorized upload handling, file download, storage, database write, and user replies.
- [x] 3.3 Implement unauthorized, unsupported message, storage failure, and persistence failure behavior.

## 4. Verification

- [x] 4.1 Add unit tests for configuration, authorization, object keys, file metadata mapping, and bot failure paths.
- [x] 4.2 Add integration smoke coverage for S3-compatible storage and PostgreSQL record creation using mocked Telegram download input.
- [x] 4.3 Run OpenSpec validation, tests, and TypeScript build.
