## Why

Normalized text removes spacing and layout details that are important for documents such as lab reports. The worker should persist the exact extracted/OCR text only, so database records remain faithful to the source output.

## What Changes

- **BREAKING**: Remove persisted `normalizedText` document and page text fields.
- Store only raw extracted/OCR text for document-level and page-level text records.
- Stop running normalization as part of the persistence path.
- Compute any retained metrics from raw text rather than normalized text.
- Update tests, docs, and example SQL queries to use `rawText`.
- Add a migration that drops normalized text columns from PostgreSQL after preserving existing `rawText`.

## Capabilities

### New Capabilities

- `raw-document-text-storage`: Store extracted/OCR document text exactly as raw text without normalized text copies.

### Modified Capabilities

- None.

## Impact

- Changes Prisma schema and database migration for `DocumentText` and `DocumentPageText`.
- Updates worker result types, PDF/OCR processing, persistence, tests, and documentation.
- Removes or scopes normalization helpers so they are not used to create persisted text.
- Existing normalized text values will be discarded by the migration; existing raw text remains.
