## 1. Configuration And Storage

- [x] 1.1 Add OpenAI embedding and RAG retrieval configuration with `.env.example` entries.
- [x] 1.2 Add pgvector-compatible PostgreSQL local development support.
- [x] 1.3 Add Prisma schema and migration for RAG index jobs, content blocks, chunks, and embeddings.

## 2. OpenAI Embeddings And Indexing

- [x] 2.1 Implement an OpenAI embeddings client with batching, timeout, and typed errors.
- [x] 2.2 Implement table-aware content block creation from document/page raw text.
- [x] 2.3 Implement chunking with configured size and overlap.
- [x] 2.4 Implement RAG indexing persistence and retryable worker jobs.
- [x] 2.5 Wire RAG indexing into the worker loop for new and existing processed documents.

## 3. Retrieval And Answering

- [x] 3.1 Implement query embedding and hybrid retrieval across the shared indexed corpus.
- [x] 3.2 Replace all-document Q&A context building with retrieved chunk context.
- [x] 3.3 Preserve source labels and source upload metadata in DeepSeek prompts and answer results.

## 4. Source Downloads

- [x] 4.1 Add Telegram source document sending for unique uploads used in an answer.
- [x] 4.2 Cap source document downloads and handle source download failures safely.

## 5. Tests And Documentation

- [x] 5.1 Add unit tests for OpenAI embedding request mapping and config validation.
- [x] 5.2 Add unit tests for table-aware blocks, chunking, RAG indexing, and retrieval ranking.
- [x] 5.3 Add unit tests for Q&A retrieval behavior and Telegram source downloads.
- [x] 5.4 Document RAG deployment, indexing, privacy, and verification steps.

## 6. Validation

- [x] 6.1 Run OpenSpec validation.
- [x] 6.2 Run Prisma validation, TypeScript checks, build, and tests.
