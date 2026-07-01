# RAG Document Retrieval

Genadiy uses RAG to answer Telegram questions from uploaded documents without sending the entire corpus to DeepSeek. The worker creates table-aware chunks from processed raw text, embeds those chunks with the configured embedding provider, stores vectors in PostgreSQL with pgvector, and the bot retrieves the most relevant chunks for each question.

## Configuration

Add these values to `.env`:

```bash
EMBEDDING_PROVIDER=openai
EMBEDDING_DOCUMENT_PREFIX=
EMBEDDING_QUERY_PREFIX=
OPENAI_API_KEY=replace-with-your-openai-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536
OPENAI_EMBEDDING_TIMEOUT_MS=60000
OPENAI_EMBEDDING_BATCH_SIZE=32

RAG_INDEX_VERSION=rag-v1
RAG_CHUNK_MAX_CHARS=1800
RAG_CHUNK_OVERLAP_CHARS=200
RAG_RETRIEVAL_LIMIT=8
RAG_RETRIEVAL_CANDIDATE_LIMIT=32
RAG_MIN_SIMILARITY=0
RAG_EXACT_MATCH_BOOST=0.08
RAG_MAX_CONTEXT_CHARS=12000
RAG_MAX_SOURCE_DOCUMENTS=3
RAG_SOURCE_DOWNLOAD_MAX_BYTES=20971520
```

`EMBEDDING_PROVIDER=openai` requires `OPENAI_API_KEY` and sends document chunks and questions to OpenAI embeddings. DeepSeek is still used for final answer generation.

### Local Ollama Embeddings

For local laptop embeddings, install and start Ollama outside the app, then pull the recommended CPU-friendly multilingual model:

```bash
ollama pull qwen3-embedding:0.6b
```

Use these values in `.env`:

```bash
EMBEDDING_PROVIDER=ollama
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_EMBEDDING_MODEL=qwen3-embedding:0.6b
OPENAI_EMBEDDING_DIMENSIONS=1024
OPENAI_EMBEDDING_BATCH_SIZE=8
RAG_INDEX_VERSION=rag-local-qwen3-v1
```

The `OPENAI_*` names are kept because Ollama exposes an OpenAI-compatible `/v1/embeddings` endpoint. `OPENAI_API_KEY=ollama` is a placeholder; the local Ollama endpoint ignores it.

Some embedding models benefit from input prefixes. Leave these empty for `qwen3-embedding:0.6b` unless testing shows otherwise. For E5-style models, set:

```bash
EMBEDDING_DOCUMENT_PREFIX="passage: "
EMBEDDING_QUERY_PREFIX="query: "
```

When changing provider, model, dimensions, or prefixes, set a new `RAG_INDEX_VERSION` so the worker indexes a fresh corpus with compatible vectors. Retrieval filters by index version, model, and dimensions.

## Local Deployment

PostgreSQL must support pgvector. The local Compose file uses `pgvector/pgvector:pg16`.

```bash
sudo docker compose up -d
npm run prisma:migrate
npm run build
```

Run the bot and worker:

```bash
npm start
npm run start:worker
```

The worker first handles document extraction jobs. When no extraction job is waiting, it discovers processed `DocumentText` rows that need RAG indexing and embeds their chunks.

To rollback from local embeddings to OpenAI, restore the OpenAI embedding settings and switch `RAG_INDEX_VERSION` back to a version with OpenAI-indexed chunks, or set a new version and let the worker reindex.

## Verification

Check RAG indexing jobs:

```bash
sudo docker compose exec postgres psql -U telegram -d telegram_documents \
  -c 'select "status", count(*) from "DocumentRagIndexJob" group by "status";'
```

Check chunks and embeddings:

```bash
sudo docker compose exec postgres psql -U telegram -d telegram_documents \
  -c 'select count(*) as chunks from "DocumentChunk"; select count(*) as embeddings from "DocumentChunkEmbedding";'
```

Ask a question in Telegram after indexing succeeds:

```text
/ask были ли обнаружены вирусы 16.06.2026?
```

The bot answers from retrieved chunks and then sends the original source documents used for the answer, capped by `RAG_MAX_SOURCE_DOCUMENTS`.

## Privacy And Access

All allowlisted Telegram users share one searchable corpus. Any allowlisted user can retrieve answers from documents uploaded by any other allowlisted user, and can receive original source documents used for the answer.

Document chunks and user questions are sent to the configured embedding provider. With `EMBEDDING_PROVIDER=ollama`, embeddings stay on the local Ollama server. Retrieved chunks are then sent to DeepSeek for answer generation. The application should not log raw embedding inputs or full answer prompts.
