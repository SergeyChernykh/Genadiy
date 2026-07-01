## ADDED Requirements

### Requirement: S3 And Google Drive Storage Coordination
The system SHALL keep S3-compatible object storage as the canonical upload store while coordinating Google Drive mirroring when enabled.

#### Scenario: S3 succeeds and Drive mirroring is enabled
- **WHEN** an accepted Telegram upload is stored in S3 and Google Drive mirroring is enabled
- **THEN** the system creates or updates a Google Drive mirror record for that upload

#### Scenario: S3 upload fails
- **WHEN** S3-compatible object storage rejects or fails an accepted upload
- **THEN** the system does not attempt Google Drive mirroring for that upload and records the upload failure through the existing failure path

#### Scenario: Drive mirror fails after S3 succeeds
- **WHEN** S3 storage succeeds but Google Drive mirroring fails
- **THEN** the system keeps the upload available through S3-backed processing and records Drive mirror failure metadata for retry or diagnosis

### Requirement: Upload Success Message Compatibility
The system SHALL preserve the existing upload success behavior for S3-backed stored documents.

#### Scenario: Upload is stored in S3
- **WHEN** an accepted Telegram upload is stored in S3 and the database write succeeds
- **THEN** the system may reply with the existing stored-file success message even if the Google Drive mirror is pending or failed
