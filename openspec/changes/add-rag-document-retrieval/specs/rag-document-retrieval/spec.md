## ADDED Requirements

### Requirement: Table-Aware Content Blocks
The system SHALL convert processed document text into AI-friendly content blocks that preserve source metadata and table-like structure.

#### Scenario: Text block is created
- **WHEN** a processed page contains normal prose text
- **THEN** the system creates a `TEXT` content block with upload, filename, page, and extraction metadata

#### Scenario: Table-like block is created
- **WHEN** a processed page contains aligned table-like rows or repeated column spacing
- **THEN** the system creates a `TABLE` content block whose AI text preserves the row and column structure

### Requirement: Document Chunking
The system SHALL split content blocks into embedding chunks with source metadata and configurable size limits.

#### Scenario: Content block fits in one chunk
- **WHEN** a content block is within the configured chunk size
- **THEN** the system stores one chunk for that block

#### Scenario: Content block exceeds chunk size
- **WHEN** a content block exceeds the configured chunk size
- **THEN** the system splits it into ordered chunks using the configured overlap

### Requirement: OpenAI Embeddings
The system SHALL create embeddings for document chunks and questions using the configured OpenAI embeddings API.

#### Scenario: Chunk embedding succeeds
- **WHEN** OpenAI returns an embedding for a document chunk
- **THEN** the system stores the vector, model name, dimensions, and chunk reference

#### Scenario: Embedding request fails
- **WHEN** OpenAI returns an error or the request times out
- **THEN** the system records the RAG indexing failure without marking document text extraction as failed

### Requirement: Shared Allowed-User Corpus Retrieval
The system SHALL retrieve relevant document chunks across all stored uploads accessible to allowlisted users.

#### Scenario: User asks a question
- **WHEN** an allowlisted Telegram user asks a question
- **THEN** the system embeds the question and searches the shared indexed document corpus

#### Scenario: Relevant chunks exist
- **WHEN** vector search finds relevant chunks
- **THEN** the system returns the top configured number of chunks with source metadata

#### Scenario: No relevant chunks exist
- **WHEN** retrieval returns no chunks
- **THEN** the system replies that it could not find relevant document context

### Requirement: Hybrid Table-Friendly Retrieval
The system SHALL combine semantic retrieval with exact text matching signals for table-heavy documents.

#### Scenario: Question contains exact values
- **WHEN** a question contains dates, numbers, or specific terms present in indexed chunks
- **THEN** retrieval boosts chunks containing those exact values

#### Scenario: Table chunk is relevant
- **WHEN** a table chunk matches the semantic or exact query signals
- **THEN** the retrieved context preserves that table chunk's row-like AI text

### Requirement: Original Source Download References
The system SHALL retain enough source metadata for retrieved chunks to download the original stored document.

#### Scenario: Retrieved chunk has source upload
- **WHEN** a retrieved chunk is used in an answer
- **THEN** the system can resolve the original upload bucket, object key, filename, and Telegram message metadata
