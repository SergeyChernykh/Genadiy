## Purpose

Define how Genadiy's worker extracts raw text and metadata from stored PDF and photo/image uploads.

## Requirements

### Requirement: Worker Job Discovery and Claiming
The system SHALL process stored PDF and photo/image uploads through a separate worker process that claims pending work from PostgreSQL.

#### Scenario: Worker claims pending upload
- **WHEN** a stored upload has no completed text extraction result
- **THEN** the worker creates or claims a processing job for that upload before processing it

#### Scenario: Multiple workers run concurrently
- **WHEN** more than one worker is running
- **THEN** each processing job is claimed by at most one worker at a time

### Requirement: Supported Processing Inputs
The system SHALL process stored PDF files and photo/image files while skipping unsupported file types with recorded metadata.

#### Scenario: Stored PDF upload is processed
- **WHEN** a stored upload has a PDF MIME type or PDF file extension
- **THEN** the worker attempts PDF metadata extraction and text extraction

#### Scenario: Stored photo upload is processed
- **WHEN** a stored upload has Telegram file type `photo` or an image MIME type
- **THEN** the worker attempts image metadata extraction and OCR

#### Scenario: Unsupported file type is encountered
- **WHEN** a stored upload is not a supported PDF or image type
- **THEN** the worker records the processing job as `SKIPPED` with a reason

### Requirement: PDF Text Extraction
The system SHALL extract embedded text from PDFs before using OCR fallback for pages that do not produce usable text.

#### Scenario: PDF contains embedded text
- **WHEN** a PDF page produces usable embedded text
- **THEN** the worker stores that page text with extraction method `TEXT_LAYER`

#### Scenario: PDF page lacks usable embedded text
- **WHEN** a PDF page does not produce usable embedded text
- **THEN** the worker renders the page locally and runs OCR for that page

### Requirement: Local OCR
The system SHALL perform OCR locally with English and Russian language support by default.

#### Scenario: OCR runs with default languages
- **WHEN** OCR is required and no custom OCR language configuration is provided
- **THEN** the worker runs OCR with language setting `eng+rus`

#### Scenario: OCR produces confidence metadata
- **WHEN** the OCR engine provides confidence information
- **THEN** the worker stores confidence metadata for the page and extraction run

### Requirement: Extracted Text Storage
The system SHALL store extracted or OCR document text in PostgreSQL as raw text only.

#### Scenario: Document processing succeeds
- **WHEN** text extraction or OCR completes for a supported document
- **THEN** the system stores document-level raw text and page-level raw text records

#### Scenario: Text metrics are stored
- **WHEN** raw text is stored
- **THEN** the system computes character and word counts from `rawText`

#### Scenario: Normalized text is not stored
- **WHEN** the worker creates document-level or page-level text records
- **THEN** the records do not include a `normalizedText` value

### Requirement: Document and Process Metadata
The system SHALL store metadata about the source document and each text extraction process.

#### Scenario: PDF metadata is available
- **WHEN** PDF metadata such as page count, title, author, encryption status, or PDF version is available
- **THEN** the worker stores that metadata with the extraction run

#### Scenario: Image metadata is available
- **WHEN** image metadata such as dimensions, content type, or byte size is available
- **THEN** the worker stores that metadata with the extraction run

#### Scenario: Tool metadata is available
- **WHEN** local extraction tools report versions or runtime details
- **THEN** the worker stores tool names, versions, configured OCR languages, duration, and processing timestamps

### Requirement: Processing Failures and Retries
The system SHALL track processing failures, retry eligible failures, and preserve failure context.

#### Scenario: Extraction command fails
- **WHEN** a local PDF or OCR command fails for a supported document
- **THEN** the processing job records status `FAILED`, error message, attempt count, and completion timestamp

#### Scenario: Failed job remains retryable
- **WHEN** a failed job has attempts remaining
- **THEN** the worker can claim it again after the retry delay

### Requirement: Local Dependency Validation
The system SHALL validate required local processing tools before accepting work.

#### Scenario: Required binary is missing
- **WHEN** the worker starts and a required binary such as `tesseract`, `pdfinfo`, `pdftotext`, or `pdftoppm` is unavailable
- **THEN** the worker fails startup with a clear diagnostic message

#### Scenario: Required OCR language is missing
- **WHEN** the configured OCR language includes English or Russian but the corresponding Tesseract language data is unavailable
- **THEN** the worker fails startup with a clear diagnostic message
