## Why

Genadiy can answer from uploaded document text, but the current all-documents prompt does not scale, loses table structure, and cannot provide direct access to the source files used for an answer. RAG will make answers more accurate, cheaper, source-grounded, and friendlier for AI workflows.

## What Changes

- Add a RAG index over processed document text using OpenAI embeddings and PostgreSQL vector search.
- Replace all-document Q&A context building with retrieval of the most relevant document chunks across all allowlisted users' documents.
- Add AI-friendly content blocks for text and table-like content so extracted tables remain useful to the model.
- Store chunk/source metadata including upload ID, filename, page number, block type, and object storage references.
- Add Telegram source download behavior for original documents used in an answer.
- Add configuration for OpenAI embeddings, retrieval limits, chunk sizing, and source download limits.
- Update local development PostgreSQL to support `pgvector`.

## Capabilities

### New Capabilities

- `rag-document-retrieval`: Index processed documents into table-aware chunks, embed them with OpenAI, and retrieve relevant chunks for document questions.

### Modified Capabilities

- `document-processing-worker`: The worker indexes processed document text into RAG content blocks/chunks and embeddings.
- `document-question-answering`: Questions are answered from retrieved RAG chunks and include downloadable original source documents.

## Impact

- Adds PostgreSQL schema changes for `pgvector`, content blocks, chunks, embeddings, and index job tracking.
- Adds OpenAI embeddings client/configuration and embedding calls from the worker.
- Updates Docker Compose PostgreSQL image to include `pgvector`.
- Updates Telegram question handling to retrieve shared allowlisted corpus context and send source documents.
- Adds tests for chunking, table-aware block building, embedding API mapping, retrieval ranking, and Telegram source downloads.
- Sends document chunks and questions to OpenAI embeddings API; existing DeepSeek answer generation remains in place.
