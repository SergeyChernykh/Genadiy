## 1. Schema and Migration

- [x] 1.1 Remove `normalizedText` from `DocumentText` and `DocumentPageText` in the Prisma schema.
- [x] 1.2 Add a Prisma migration that drops the `normalizedText` columns from PostgreSQL.
- [x] 1.3 Regenerate and validate the Prisma client after schema changes.

## 2. Worker Processing

- [x] 2.1 Remove `normalizedText` from document/page processing result types.
- [x] 2.2 Update PDF text extraction to return and persist only raw text.
- [x] 2.3 Update image/OCR extraction to return and persist only raw text.
- [x] 2.4 Keep any internal usability checks from writing transformed text into persistence payloads.
- [x] 2.5 Compute retained text metrics from raw text.

## 3. Persistence and Documentation

- [x] 3.1 Update processing repository writes so `DocumentText` and `DocumentPageText` only receive `rawText`.
- [x] 3.2 Update worker documentation and example SQL queries to use `rawText`.
- [x] 3.3 Remove or narrow normalization helpers and tests that are no longer part of persisted output.

## 4. Verification

- [x] 4.1 Update unit tests for processing, persistence, and text metrics.
- [x] 4.2 Run OpenSpec validation, Prisma validation/generation, unit tests, and TypeScript build.
