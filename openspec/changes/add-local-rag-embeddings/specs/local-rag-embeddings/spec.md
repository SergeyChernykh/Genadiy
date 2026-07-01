## ADDED Requirements

### Requirement: Embedding Provider Configuration
The system SHALL allow RAG embeddings to be configured for either the remote OpenAI provider or a local Ollama provider.

#### Scenario: OpenAI provider is configured
- **WHEN** the embedding provider is `openai`
- **THEN** the system requires an OpenAI API key and uses the configured OpenAI-compatible base URL, model, and dimensions

#### Scenario: Ollama provider is configured
- **WHEN** the embedding provider is `ollama`
- **THEN** the system uses a local OpenAI-compatible embeddings endpoint and does not require a paid OpenAI API key

### Requirement: Local Laptop Embedding Defaults
The system SHALL provide local embedding defaults suitable for normal operation on the target laptop.

#### Scenario: Local defaults are used
- **WHEN** the embedding provider is configured for Ollama and no local model overrides are supplied
- **THEN** the system uses `qwen3-embedding:0.6b`, `http://localhost:11434/v1`, and 1024 embedding dimensions

### Requirement: Embedding Input Prefixes
The system SHALL support separate prefixes for document chunk embeddings and question embeddings.

#### Scenario: Document prefix is configured
- **WHEN** document chunks are embedded and an embedding document prefix is configured
- **THEN** the system prepends the document prefix to each chunk before sending it to the embedding provider

#### Scenario: Query prefix is configured
- **WHEN** a question is embedded and an embedding query prefix is configured
- **THEN** the system prepends the query prefix to the question before sending it to the embedding provider

### Requirement: Embedding Dimension Compatibility
The system SHALL store and retrieve RAG vectors using the configured embedding dimensions.

#### Scenario: Local embedding dimensions differ from OpenAI
- **WHEN** a local embedding model returns vectors with a non-1536 dimension count
- **THEN** the system stores those vectors and their dimension count without rejecting them due to the old OpenAI dimension size

#### Scenario: Retrieval runs against indexed vectors
- **WHEN** a question embedding is used for RAG retrieval
- **THEN** the system compares it only with indexed vectors from the configured model and dimension count

### Requirement: Provider Switch Reindexing
The system SHALL keep embedding provider switches isolated by RAG index version.

#### Scenario: Provider or dimension changes
- **WHEN** the configured embedding provider, model, dimensions, or prefixes change
- **THEN** operators can set a new `RAG_INDEX_VERSION` so the worker creates fresh RAG indexing jobs for the new embedding configuration

