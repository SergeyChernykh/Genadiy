## ADDED Requirements

### Requirement: Google Drive Mirror Configuration
The system SHALL allow operators to enable or disable Google Drive mirroring for original uploaded documents.

#### Scenario: Google Drive mirroring is disabled
- **WHEN** Google Drive mirroring is disabled or not configured
- **THEN** the system stores uploads only through the existing S3-backed path and does not call Google Drive

#### Scenario: Google Drive mirroring is enabled
- **WHEN** Google Drive mirroring is enabled
- **THEN** the system validates Google Drive credentials and a destination folder ID before attempting Drive uploads

### Requirement: Google Drive Original File Mirror
The system SHALL mirror original accepted Telegram upload files into the configured Google Drive folder.

#### Scenario: Drive upload succeeds
- **WHEN** an accepted upload has been stored in S3 and Google Drive accepts the file upload
- **THEN** the system records the Google Drive file ID, folder ID, file name, sync status, and optional web link for that upload

#### Scenario: Drive upload is disabled
- **WHEN** an accepted upload is stored in S3 and Google Drive mirroring is disabled
- **THEN** the system records no Google Drive mirror attempt for that upload

### Requirement: Google Drive Mirror Traceability
The system SHALL preserve enough metadata to trace each Google Drive file back to its Telegram upload and S3 object.

#### Scenario: Drive file is created
- **WHEN** the system creates a Google Drive file for an upload
- **THEN** the Drive file metadata or stored mirror record includes the upload record ID, Telegram chat/message/file metadata, and S3 bucket/object key

### Requirement: Google Drive Mirror Failure Tracking
The system SHALL track Google Drive mirror failures separately from S3 storage success.

#### Scenario: Drive upload fails after S3 succeeds
- **WHEN** S3 upload and upload record persistence succeed but Google Drive upload fails
- **THEN** the system records the upload as S3-backed stored and records the Google Drive mirror status as failed with an error message

#### Scenario: Drive upload remains retryable
- **WHEN** a Google Drive mirror attempt fails and retry attempts remain
- **THEN** the system can retry the Drive mirror using the stored S3 object as the source document

### Requirement: Google Drive Mirror Privacy
The system SHALL NOT make mirrored Google Drive documents public.

#### Scenario: Drive file is uploaded
- **WHEN** the system uploads a document to Google Drive
- **THEN** it relies on the configured folder permissions and does not create a public sharing permission

