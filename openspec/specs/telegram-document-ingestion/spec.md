## Purpose

Define how Genadiy accepts Telegram document and photo uploads, stores original files, and records upload metadata.

## Requirements

### Requirement: Authorized Telegram Uploads
The system SHALL accept file uploads only from Telegram users whose numeric user IDs are configured in the allowlist.

#### Scenario: Allowlisted user sends a document
- **WHEN** an allowlisted Telegram user sends a `document` message
- **THEN** the system accepts the upload for storage processing

#### Scenario: Non-allowlisted user sends a document
- **WHEN** a Telegram user not present in the allowlist sends a `document` message
- **THEN** the system rejects the message without downloading, storing, or recording the file

### Requirement: Supported Telegram File Inputs
The system SHALL handle Telegram `document` messages and `photo` messages without restricting uploads to a fixed MIME type allowlist.

#### Scenario: User sends a PDF document
- **WHEN** an allowlisted user sends a PDF as a Telegram `document`
- **THEN** the system stores the file and records Telegram-provided MIME metadata when available

#### Scenario: User sends a photo
- **WHEN** an allowlisted user sends a Telegram `photo` message
- **THEN** the system stores the largest available photo variant and records the file metadata available from Telegram

### Requirement: Object Storage Persistence
The system SHALL upload each accepted Telegram file to S3-compatible object storage before reporting success to the user.

#### Scenario: Accepted upload is stored
- **WHEN** object storage accepts the file upload
- **THEN** the system stores the bucket, object key, and storage ETag when available

#### Scenario: Object storage upload fails
- **WHEN** object storage rejects or fails an upload
- **THEN** the system records a failed upload attempt and informs the Telegram user that the file was not stored

### Requirement: PostgreSQL Upload Records
The system SHALL persist one PostgreSQL upload record for each accepted Telegram message/file with Telegram metadata and object storage references.

#### Scenario: Upload completes successfully
- **WHEN** a file is uploaded to object storage and the database write succeeds
- **THEN** the system records the upload as `STORED` and replies with success to the Telegram user

#### Scenario: Database write fails after storage
- **WHEN** object storage succeeds but PostgreSQL persistence fails
- **THEN** the system reports failure to the Telegram user and does not report the upload as successful

### Requirement: Size Limits
The system SHALL reject Telegram files larger than the configured maximum size before downloading them when Telegram provides the file size.

#### Scenario: Upload exceeds configured size
- **WHEN** Telegram metadata says an upload is larger than `MAX_FILE_BYTES`
- **THEN** the system rejects the upload without downloading or storing it

### Requirement: Local Development Runtime
The system SHALL provide a local development setup for PostgreSQL and MinIO that is compatible with the application configuration.

#### Scenario: Developer starts dependencies locally
- **WHEN** a developer starts the configured Docker Compose services
- **THEN** PostgreSQL and MinIO are available using the values documented in `.env.example`
