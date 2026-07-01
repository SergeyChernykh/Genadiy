## 1. Configuration And Storage Schema

- [ ] 1.1 Add Google Drive mirror configuration and validation for enable flag, credentials, folder ID, retry limits, and timeouts.
- [ ] 1.2 Add Google Drive mirror status enum/table or fields with upload relation, Drive file metadata, attempts, timestamps, and failure messages.
- [ ] 1.3 Update Prisma migration/schema generation and `.env.example` with Google Drive settings.

## 2. Google Drive Client And Storage Adapter

- [ ] 2.1 Add Google Drive API dependency and credential loading for service account JSON path or raw JSON.
- [ ] 2.2 Implement a Google Drive storage adapter that uploads buffers to the configured folder without creating public permissions.
- [ ] 2.3 Preserve traceability metadata for Telegram IDs, S3 bucket/object key, and upload record ID in stored mirror metadata.

## 3. Upload Integration And Retry

- [ ] 3.1 Extend upload persistence to create stored upload records and associated Drive mirror records.
- [ ] 3.2 Wire Telegram upload handling to mirror to Google Drive after S3 storage succeeds when enabled.
- [ ] 3.3 Ensure S3 failure skips Drive mirroring and Drive failure does not break S3-backed processing.
- [ ] 3.4 Add retry behavior for pending/failed Drive mirrors using the S3 object as the source.

## 4. Documentation And Verification

- [ ] 4.1 Document Google Drive service account setup, folder sharing, configuration, verification queries, and rollback.
- [ ] 4.2 Add tests for disabled Drive mirroring, successful Drive mirroring, Drive failure tracking, and retry behavior.
- [ ] 4.3 Run OpenSpec validation, Prisma validation, TypeScript checks, build, and tests.
