## ADDED Requirements

### Requirement: Raw Text Only Persistence
The system SHALL persist extracted/OCR document text only as raw text.

#### Scenario: Document text is stored
- **WHEN** document extraction or OCR succeeds for a supported upload
- **THEN** the system stores document-level text in `rawText` only

#### Scenario: Page text is stored
- **WHEN** page-level extraction or OCR succeeds
- **THEN** the system stores page-level text in `rawText` only

### Requirement: No Normalized Text Storage
The system SHALL NOT persist normalized text copies for extracted documents or pages.

#### Scenario: Document text record is created
- **WHEN** the worker creates a document text record
- **THEN** the record does not include a `normalizedText` value

#### Scenario: Page text record is created
- **WHEN** the worker creates a page text record
- **THEN** the record does not include a `normalizedText` value

#### Scenario: Database schema is migrated
- **WHEN** the raw-text-only migration is applied
- **THEN** normalized text columns are removed from document and page text tables

### Requirement: Raw Text Metrics
The system SHALL compute retained text metrics from raw text.

#### Scenario: Character and word counts are stored
- **WHEN** the system stores character or word counts for extracted text
- **THEN** those counts are derived from `rawText`

### Requirement: Internal Text Checks Do Not Persist Normalization
The system MAY inspect or simplify text internally for routing decisions, but SHALL NOT persist that transformed text.

#### Scenario: PDF text layer is checked for usability
- **WHEN** the worker decides whether a PDF page has usable embedded text
- **THEN** any internal text cleanup used for that decision is not stored as document or page text

### Requirement: Raw Text Documentation
The system SHALL document raw text as the only supported persisted text field.

#### Scenario: User checks extracted text in PostgreSQL
- **WHEN** documentation or examples show how to query extracted text
- **THEN** they query `rawText` and do not reference `normalizedText`
