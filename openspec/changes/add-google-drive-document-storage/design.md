## Context

Genadiy currently downloads accepted Telegram files, uploads the original file bytes to S3-compatible object storage, writes an `UploadRecord` with S3 bucket/object metadata, and then worker/RAG/source-download flows use that S3 object as the canonical original document. The requested change is to also store the original files in Google Drive so an operator can browse and recover documents outside MinIO/S3.

Google Drive introduces a new external API, credential management, and partial-failure states. S3 should remain the canonical storage path because existing processing, RAG, and Telegram source download behavior already depend on `bucket` and `objectKey`.

## Goals / Non-Goals

**Goals:**

- Mirror original accepted Telegram uploads to a configured Google Drive folder in addition to S3.
- Keep existing S3 upload, worker processing, RAG indexing, and source-download behavior compatible.
- Store Drive file ID, parent folder ID, file name, optional web link, status, attempts, timestamps, and failure messages.
- Make Drive storage configurable and disabled unless explicitly configured.
- Treat Drive failures as separately trackable mirror failures, not as loss of the S3-backed upload.
- Provide retry behavior for Drive mirror failures.

**Non-Goals:**

- Do not replace S3 with Google Drive.
- Do not make Google Drive files public.
- Do not ingest Google Drive documents that were not uploaded through Telegram.
- Do not use Google Drive as the worker download source in this change.

## Decisions

1. **S3 remains canonical; Google Drive is a mirror.**

   The upload is still considered usable when S3 storage and database persistence succeed. Google Drive status is recorded separately. This avoids breaking extraction/RAG if Drive credentials expire, quota is exceeded, or the Drive API is temporarily unavailable.

2. **Use an explicit Google Drive mirror record rather than overloading S3 fields.**

   Add a separate PostgreSQL model/table keyed by `uploadRecordId` with Drive metadata and status. This avoids mixing S3 object identity with Drive file identity and gives retry/failure state a natural home.

3. **Use service-account-style configuration first.**

   The implementation should support a Google service account JSON file path or raw JSON environment value plus a destination folder ID. Operators can share the destination folder with the service account. OAuth user consent flows are out of scope for the bot runtime.

4. **Upload to Drive from the original Telegram file buffer during ingestion, with retry from S3.**

   The upload handler already has the original file bytes after download. It can create the initial Drive mirror attempt without re-downloading from S3. If that fails, retry logic can later download the S3 object and attempt the Drive upload again.

5. **Preserve Telegram/S3 naming in Drive metadata.**

   Drive file names should use the Telegram original file name when available, while custom Drive app properties or description metadata should retain Telegram IDs, S3 bucket/object key, and upload record ID. This keeps Drive browsing human-friendly while preserving traceability.

## Risks / Trade-offs

- **Drive API or credential failures** -> Record Drive mirror status as `FAILED` with retry metadata while preserving S3-backed upload processing.
- **Google Drive quota limits** -> Surface failure messages and keep retries bounded by configurable attempts.
- **Duplicate Drive files on retry** -> Store Drive file ID on success and make retry logic skip already-succeeded mirror records.
- **Sensitive documents become visible in Drive** -> Keep sharing inherited from the configured folder and do not create public links.
- **Service account access can be confusing** -> Document that the destination folder must be shared with the service account email.

## Migration Plan

1. Add Google Drive configuration values and validate required values only when Drive mirroring is enabled.
2. Add a Drive mirror table/status enum and relate it to `UploadRecord`.
3. Add a Google Drive client/storage adapter and a retryable mirror repository.
4. Wire upload ingestion to create/update Drive mirror records after S3 storage succeeds.
5. Add retry behavior for failed/pending Drive mirror records using S3 as the source of truth.
6. Document setup, folder sharing, verification queries, and rollback by disabling Drive mirroring.
