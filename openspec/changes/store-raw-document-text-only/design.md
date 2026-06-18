## Context

The document processing worker currently stores both raw extracted/OCR text and normalized text at document and page levels. Normalization trims and collapses whitespace, repairs hyphenation, and removes repeated blank lines. That is useful for simple search, but it damages layout-sensitive documents such as medical and lab reports where spacing and line breaks carry meaning.

This change makes raw extracted/OCR output the only persisted text representation. The worker may still inspect text internally to decide whether a PDF page has usable embedded text, but it must not persist a normalized text copy.

## Goals / Non-Goals

**Goals:**

- Persist only raw extracted/OCR text in `DocumentText` and `DocumentPageText`.
- Remove `normalizedText` fields from Prisma models and PostgreSQL tables.
- Stop producing normalized text in worker processing result types and persistence payloads.
- Keep document/page metadata, statuses, OCR confidence, process timings, and failure handling unchanged.
- Compute retained metrics from raw text.
- Update docs and tests so all examples query `rawText`.

**Non-Goals:**

- Changing Telegram upload ingestion behavior.
- Changing Object Storage layout.
- Adding table parsing, semantic extraction, OCR tuning, or search indexing.
- Preserving existing normalized text values during migration.
- Removing raw text metrics unless implementation proves they are tightly coupled to normalization.

## Decisions

- Drop `normalizedText` columns instead of leaving them nullable. The user requirement is explicit: only raw text should be stored.
- Keep `rawText` column names. They already describe the desired representation and avoid a broader rename/migration.
- Keep `characterCount` and `wordCount` on `DocumentText` if they are computed from raw text. They are metadata, not stored text copies.
- Remove `normalizedText` from TypeScript processing result types. This prevents accidental future persistence of normalized text.
- Keep a minimal text usability helper if needed for deciding whether a PDF text layer is non-empty. That helper must not create persisted normalized text.
- Make migration rollback explicit: restoring normalized columns would require recomputing them from raw text or restoring from backup.

## Risks / Trade-offs

- Existing code or SQL queries that select `normalizedText` will fail -> update docs/tests and mention the breaking change.
- Search-like behavior may become less convenient because raw text preserves spacing and line breaks -> defer search-specific normalization to a future derived index rather than the canonical text table.
- Dropping columns discards normalized values -> raw text remains available; normalized values can be regenerated later if needed.
- Metrics may change because they are computed from raw text -> document this and update tests to expect raw-text metrics.

## Migration Plan

- Add a Prisma migration that drops `DocumentText.normalizedText` and `DocumentPageText.normalizedText`.
- Update Prisma schema and regenerate Prisma client.
- Update worker processing modules, repository persistence, and tests to pass/store only `rawText`.
- Update documentation and example database queries.
- Deploy by running `npx prisma migrate deploy` before starting the updated worker.
- Roll back by restoring the previous code and adding the dropped columns back, then recomputing normalized values from raw text if needed.

## Open Questions

- None. The requested behavior is raw text only.
