## ADDED Requirements

### Requirement: RAG Index Job Discovery and Claiming
The system SHALL index successfully processed document text through retryable RAG indexing jobs.

#### Scenario: Processed document text is unindexed
- **WHEN** a `DocumentText` record exists without a successful RAG index
- **THEN** the worker creates or claims a RAG indexing job for that document text

#### Scenario: RAG indexing fails
- **WHEN** RAG indexing fails after text extraction has succeeded
- **THEN** the worker records the RAG indexing job as `FAILED` without changing the successful extraction result

#### Scenario: RAG indexing succeeds
- **WHEN** content blocks, chunks, and embeddings are stored for a document
- **THEN** the worker records the RAG indexing job as `SUCCEEDED`

### Requirement: RAG Reindexing
The system SHALL support reindexing existing processed documents when the chunking or embedding version changes.

#### Scenario: Parser or embedding version changes
- **WHEN** an existing document was indexed with an older RAG index version
- **THEN** the worker can create a new RAG indexing job to replace stale blocks, chunks, and embeddings
