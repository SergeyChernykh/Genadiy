## Context

The current system stores Telegram uploads in S3-compatible Object Storage and records upload metadata in PostgreSQL. OCR and text extraction were explicitly out of scope for the first ingestion change. This change adds a second process that consumes stored uploads and persists searchable text plus processing metadata.

## Goals / Non-Goals

**Goals:**

- Add a standalone TypeScript worker process, started separately from the Telegram bot.
- Process stored PDF and photo/image uploads from Object Storage.
- Extract embedded PDF text and run local OCR for scanned PDF pages and images.
- Support English and Russian OCR by default with configurable `OCR_LANGUAGES`, defaulting to `eng+rus`.
- Store raw text, normalized text, page-level text, document metadata, process metadata, statuses, timings, attempts, and failures in PostgreSQL.
- Validate local binaries and OCR language packs at startup.

**Non-Goals:**

- Cloud OCR or external AI document processing.
- Semantic document understanding, classification, summarization, or entity extraction.
- User-facing search UI or admin dashboard.
- Antivirus scanning or file sanitization.
- Reprocessing historical uploads beyond normal job retry/reclaim behavior.

## Decisions

- Use a database-polled worker for v1. PostgreSQL is already required, and `FOR UPDATE SKIP LOCKED` style claiming avoids adding Redis or a queue service before throughput demands it.
- Keep the worker in Node.js/TypeScript while delegating heavy document processing to mature local tools: Poppler (`pdfinfo`, `pdftotext`, `pdftoppm`) and Tesseract.
- Store both document-level and page-level text. Document-level text is convenient for search and future LLM use; page-level text makes mixed PDFs and OCR debugging practical.
- Treat raw text as the exact extraction/OCR output and normalized text as conservative cleanup only: Unicode normalization, line-ending normalization, whitespace collapse, excessive blank-line removal, and broken-hyphen repair.
- Prefer embedded PDF text before OCR. OCR is slower and less accurate; scanned pages fall back to rendering plus Tesseract.
- Persist process metadata in structured JSON fields where tool-specific output varies, while keeping important query fields such as status, method, duration, language, page count, confidence, and timestamps as columns.
- Fail startup when required binaries or configured OCR languages are missing. A worker that cannot process locally should fail loudly rather than silently accumulating failed jobs.

## Risks / Trade-offs

- Large PDFs can consume CPU, RAM, and disk while rendering pages -> enforce configurable max pages, max file bytes, per-command timeout, and temporary directory cleanup.
- OCR can be slow or inaccurate for poor scans -> track duration, method, and confidence metadata so results can be audited or retried later.
- Database polling is simple but not ideal for very high throughput -> acceptable for v1; move to a durable queue when processing volume justifies it.
- Object Storage download plus local temporary files may expose sensitive content on disk -> use per-job temp directories, delete them after processing, and avoid logging text content.
- Mixed-language OCR may be slower than a single language -> default to `eng+rus` for correctness, with `OCR_LANGUAGES` configurable.
- Database write failure after processing can lose computed output -> mark the job failed with context when possible and allow retry.

## Migration Plan

- Add Prisma models and migrations for processing jobs, extraction runs, document text, and page text.
- Add worker configuration and `.env.example` values for OCR languages, polling interval, retry limits, command timeout, and page/file limits.
- Add package scripts for dependency checking and running the worker.
- Deploy local OS packages before starting the worker: `poppler-utils`, `tesseract-ocr`, `tesseract-ocr-eng`, and `tesseract-ocr-rus`.
- Run migrations, then start the worker alongside the Telegram bot.

## Open Questions

- None for v1; OCR language default is `eng+rus`.
