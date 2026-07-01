## Why

Genadiy currently depends on OpenAI embeddings for RAG indexing and question retrieval, which sends document chunks and questions to an external service and requires a paid API key. A local embedding option should let the bot run acceptably on the current laptop while keeping document embeddings private.

## What Changes

- Add a configurable embedding provider mode for OpenAI-compatible remote embeddings and local Ollama embeddings.
- Default the local provider path to a CPU-friendly Ollama model such as `qwen3-embedding:0.6b`.
- Support local embedding dimensions that differ from OpenAI's 1536-dimensional vectors.
- Add embedding input prefixes for local models that require query/document task hints.
- Add RAG reindexing behavior and documentation for switching embedding providers or dimensions.
- Add validation and tests covering local provider configuration, request mapping, vector dimensions, and retrieval compatibility.

## Capabilities

### New Capabilities

- `local-rag-embeddings`: Configure, validate, and use a local embedding provider for RAG indexing and question retrieval.

### Modified Capabilities

- `document-processing-worker`: RAG indexing SHALL use the configured embedding provider and dimension when creating document chunk embeddings.
- `document-question-answering`: RAG question retrieval SHALL use the same configured embedding provider and dimension as the indexed corpus.

## Impact

- Affects embedding configuration, embedding client request construction, RAG persistence, pgvector schema/migrations, worker startup, retrieval, tests, and RAG deployment docs.
- Adds local runtime documentation for Ollama and `qwen3-embedding:0.6b`.
- Requires reindexing existing RAG chunks when provider, model, dimensions, or input prefix behavior changes.
