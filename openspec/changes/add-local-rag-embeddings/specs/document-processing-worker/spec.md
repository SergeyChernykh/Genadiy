## ADDED Requirements

### Requirement: Configured RAG Index Embeddings
The worker SHALL index document chunks using the configured embedding provider, model, dimensions, and document input prefix.

#### Scenario: Worker indexes with local provider
- **WHEN** the embedding provider is configured for Ollama
- **THEN** the worker sends document chunk embedding requests to the local OpenAI-compatible embeddings endpoint

#### Scenario: Worker stores embedding metadata
- **WHEN** chunk embeddings are persisted
- **THEN** the worker stores the embedding provider, model, dimensions, and index version metadata needed for compatible retrieval

