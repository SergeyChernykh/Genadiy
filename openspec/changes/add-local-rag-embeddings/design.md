## Context

Genadiy already has a RAG pipeline that chunks processed document text, creates embeddings through an OpenAI-compatible HTTP client, stores vectors in PostgreSQL/pgvector, and retrieves matching chunks before calling DeepSeek. The current default is `text-embedding-3-small` with 1536-dimensional vectors, and the database column is fixed to `vector(1536)`.

The target laptop has an Intel i7-1260P CPU, about 14 GiB RAM, and no NVIDIA GPU visible. The local embedding path must therefore favor a small CPU-friendly model and an HTTP runtime that is easy to run locally. Ollama's OpenAI-compatible `/v1/embeddings` endpoint fits the existing client shape and can serve `qwen3-embedding:0.6b`.

## Goals / Non-Goals

**Goals:**

- Allow RAG indexing and query retrieval to use either remote OpenAI embeddings or local Ollama embeddings.
- Make `qwen3-embedding:0.6b` the documented local default because it is multilingual, small enough for the laptop, and supports 1024-dimensional output.
- Support embedding dimensions other than 1536 without breaking existing OpenAI configurations.
- Ensure retrieval only compares query vectors against indexed vectors with the same model and dimensions.
- Support query/document input prefixes for embedding models that benefit from task-specific text.
- Document local setup, provider switching, and reindexing.

**Non-Goals:**

- Do not replace DeepSeek answer generation.
- Do not add a separate vector database.
- Do not install or manage Ollama automatically.
- Do not benchmark every local embedding model as part of normal tests.

## Decisions

1. **Keep the OpenAI-compatible HTTP client and generalize its configuration.**

   Ollama exposes an OpenAI-compatible `/v1/embeddings` endpoint, so the current HTTP request/response code can remain the single embedding transport. The implementation will rename behavior and configuration conceptually around an embedding provider while preserving `OPENAI_*` compatibility where useful.

2. **Use a provider mode instead of inferring local behavior from the base URL.**

   `EMBEDDING_PROVIDER=openai|ollama` makes validation and defaults explicit. OpenAI requires a real API key. Ollama can use a placeholder key because its local endpoint ignores it.

3. **Use unbounded pgvector storage with explicit dimension filtering.**

   The `DocumentChunkEmbedding.embedding` column will move from `vector(1536)` to unbounded `vector`, while `dimensions` remains stored separately. Retrieval will filter by both embedding model and dimensions before cosine distance sorting. This supports OpenAI's 1536-dimensional vectors and local 1024-dimensional vectors in the same schema, while avoiding cross-dimension comparisons.

4. **Track provider/model/dimensions through the RAG index version boundary.**

   Switching provider, model, dimensions, or input prefixes requires a new `RAG_INDEX_VERSION` so indexing jobs create a separate corpus and retrieval queries the matching corpus. This keeps migration behavior explicit and reversible.

5. **Apply input prefixes at the embedding client boundary.**

   The client will prefix document chunk inputs and query inputs using separate configuration values. Defaults will be empty for OpenAI and `passage: ` / `query: ` for local E5-style setups only when explicitly configured. For `qwen3-embedding:0.6b`, the first implementation can run without prefixes unless the operator configures them.

## Risks / Trade-offs

- **Local inference can be slow on CPU** -> Document `qwen3-embedding:0.6b` as the starting point and keep batch size configurable.
- **Provider switches can leave old vectors in the database** -> Require model, dimension, and index version matching during retrieval and document a reindex step.
- **Some local models require prefixes for good retrieval quality** -> Provide explicit query/document prefix settings instead of hard-coding model-specific behavior.
- **Ollama must be installed outside the app** -> Startup validation remains configuration-focused; runtime connection failures are handled as embedding request failures.
- **Unbounded vector columns make dimension mistakes possible** -> Validate response vector length and filter retrieval by configured dimensions.

## Migration Plan

1. Add configuration for embedding provider, local defaults, dimensions, and input prefixes.
2. Add a migration that changes `DocumentChunkEmbedding.embedding` from `vector(1536)` to unbounded `vector`.
3. Update indexing metadata and retrieval filters to include configured embedding dimensions.
4. Document local Ollama setup and recommend a new `RAG_INDEX_VERSION` such as `rag-local-qwen3-v1`.
5. Rollback by setting provider/configuration back to OpenAI and restoring the previous `RAG_INDEX_VERSION`; existing OpenAI vectors remain usable.
