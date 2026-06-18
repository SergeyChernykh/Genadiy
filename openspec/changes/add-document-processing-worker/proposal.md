## Why

Stored document files are useful only after their contents can be searched, inspected, or reused. This change adds a local worker that extracts text from PDFs and photos, performs OCR for scanned/image content, and records both the text output and processing metadata in PostgreSQL.

## What Changes

- Add a TypeScript document processor worker that runs separately from the Telegram bot.
- Process stored PDF and photo/image uploads from Object Storage.
- Extract embedded PDF text where available.
- Perform local OCR with English and Russian support for image files and scanned PDF pages.
- Store raw extracted text, normalized text, document metadata, and extraction process metadata in PostgreSQL.
- Track processing status, attempts, timings, tool versions, failure messages, and per-page extraction details.
- Add local runtime checks and documentation for required binaries such as Tesseract and Poppler tools.

## Capabilities

### New Capabilities

- `document-processing-worker`: Process stored PDF/photo uploads locally, extract text/OCR output, and persist text plus processing metadata.

### Modified Capabilities

- None.

## Impact

- Adds worker process entrypoint and processing modules.
- Adds PostgreSQL schema/migrations for processing jobs, extracted text, document metadata, and extraction runs/pages.
- Adds local dependencies on Poppler utilities and Tesseract OCR with English and Russian language packs.
- Adds configuration for OCR languages, worker polling, retry behavior, processing limits, and subprocess timeouts.
- Adds tests for text normalization, job claiming, PDF/image routing, failure handling, and processing metadata persistence.
