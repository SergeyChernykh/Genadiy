## ADDED Requirements

### Requirement: Configured RAG Query Embeddings
Question answering SHALL embed questions using the configured embedding provider, model, dimensions, and query input prefix.

#### Scenario: User asks a question with local provider configured
- **WHEN** an allowlisted Telegram user asks a document question and the embedding provider is configured for Ollama
- **THEN** the system sends the question embedding request to the local OpenAI-compatible embeddings endpoint

#### Scenario: Retrieval filters incompatible vectors
- **WHEN** RAG retrieval searches indexed chunks
- **THEN** the system excludes vectors with a different embedding model or dimension count from the configured query embedding
