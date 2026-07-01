## 1. Configuration and Schema

- [x] 1.1 Add worker configuration for OCR languages, polling interval, retry limits, command timeout, and file/page processing limits.
- [x] 1.2 Add Prisma models and migration for processing jobs, extraction runs, document text, and page text.
- [x] 1.3 Add package scripts and documentation for dependency checking and running the worker.

## 2. Worker Job Lifecycle

- [x] 2.1 Implement database job discovery and creation for stored PDF/photo/image uploads.
- [x] 2.2 Implement concurrency-safe job claiming, retry delay, attempt tracking, and status transitions.
- [x] 2.3 Implement unsupported-file skipping with recorded reason metadata.

## 3. Local Processing Pipeline

- [x] 3.1 Implement startup validation for Poppler and Tesseract binaries plus `eng` and `rus` language data.
- [x] 3.2 Implement Object Storage download to isolated temporary work directories with cleanup.
- [x] 3.3 Implement PDF metadata and embedded text extraction using Poppler tools.
- [x] 3.4 Implement scanned PDF page rendering and OCR fallback.
- [x] 3.5 Implement photo/image OCR with default `eng+rus` language configuration.
- [x] 3.6 Implement conservative raw-to-normalized text cleanup.

## 4. Persistence and Observability

- [x] 4.1 Persist document-level raw text, normalized text, counts, and processing timestamps.
- [x] 4.2 Persist page-level extraction method, raw text, normalized text, confidence, and metadata.
- [x] 4.3 Persist process metadata including tool versions, OCR languages, duration, page count, errors, and failure context.
- [x] 4.4 Add logging for worker startup, claimed jobs, completed jobs, skipped jobs, and failures without logging extracted document text.

## 5. Verification

- [x] 5.1 Add unit tests for configuration, dependency checks, job claiming rules, text normalization, and file type routing.
- [x] 5.2 Add processing tests for text-layer PDFs, scanned/image OCR paths, unsupported files, and command failures using fixtures or mocked subprocesses.
- [x] 5.3 Add persistence tests for successful extraction, skipped jobs, failed jobs, retryable jobs, and metadata storage.
- [x] 5.4 Run OpenSpec validation, Prisma validation/generation, unit tests, and TypeScript build.
