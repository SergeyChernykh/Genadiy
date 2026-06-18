# Document Processing Worker

The document processing worker extracts text from stored PDF/photo uploads and saves raw text, normalized text, page-level text, document metadata, and extraction metadata in PostgreSQL.

Install local processing tools:

```bash
sudo apt install poppler-utils tesseract-ocr tesseract-ocr-eng tesseract-ocr-rus
```

Useful commands:

```bash
npm run worker:check
npm run dev:worker
npm run build
npm run start:worker
```

Worker configuration:

```bash
OCR_LANGUAGES=eng+rus
WORKER_POLL_INTERVAL_MS=5000
WORKER_RETRY_DELAY_MS=60000
WORKER_MAX_ATTEMPTS=3
WORKER_COMMAND_TIMEOUT_MS=120000
WORKER_MAX_FILE_BYTES=52428800
WORKER_MAX_PDF_PAGES=50
```

`OCR_LANGUAGES` defaults to `eng+rus`. The worker fails startup when required binaries or configured Tesseract language packs are missing.
