## 1. Configuration And Storage

- [x] 1.1 Add embedding provider, local Ollama defaults, and input prefix configuration.
- [x] 1.2 Add pgvector migration and Prisma schema support for non-1536 embedding dimensions.
- [x] 1.3 Update `.env.example` with local embedding provider settings.

## 2. Embedding Client And RAG Integration

- [x] 2.1 Generalize embedding client configuration for OpenAI and Ollama providers.
- [x] 2.2 Apply document/query embedding prefixes at the correct call sites.
- [x] 2.3 Persist embedding provider metadata during RAG indexing.
- [x] 2.4 Filter RAG retrieval by configured embedding dimensions.

## 3. Documentation

- [x] 3.1 Document Ollama setup, `qwen3-embedding:0.6b`, reindexing, and rollback steps.

## 4. Tests And Validation

- [x] 4.1 Add unit tests for provider configuration and local defaults.
- [x] 4.2 Add unit tests for embedding request prefixes and Ollama-compatible requests.
- [x] 4.3 Add unit tests for dimension-aware retrieval filtering.
- [x] 4.4 Run OpenSpec validation, Prisma validation, TypeScript checks, build, and tests.
