## Why

Genadiy currently stores original Telegram uploads only in S3-compatible object storage. Mirroring accepted documents to Google Drive provides an operator-friendly backup and browsing surface while keeping the existing S3-based processing and source-download flows intact.

## What Changes

- Add Google Drive document storage for original uploaded files in addition to S3-compatible object storage.
- Keep S3 as the canonical storage path used by existing extraction, RAG indexing, and source download behavior.
- Add configuration for enabling Google Drive storage, authenticating with Google Drive, and selecting a destination folder.
- Store Google Drive file IDs, folder IDs, web links when available, and sync status metadata in PostgreSQL.
- Track Google Drive upload failures separately from S3 upload success so Drive failures can be retried or diagnosed without losing the S3-backed upload.
- Add tests and documentation for S3-plus-Google-Drive upload behavior, failure handling, and local/deployment configuration.

## Capabilities

### New Capabilities

- `google-drive-document-storage`: Mirror stored Telegram upload files into Google Drive and track Drive file metadata/status.

### Modified Capabilities

- `telegram-document-ingestion`: Accepted uploads SHALL continue storing to S3 and SHALL record/coordinate Google Drive mirror storage when enabled.

## Impact

- Affects upload handling, storage interfaces, configuration, database schema/migrations, upload persistence, and tests.
- Adds a Google Drive API dependency or integration layer.
- Adds operational setup for Google Drive credentials and destination folder selection.
- Existing S3 object keys and worker processing behavior remain compatible.
