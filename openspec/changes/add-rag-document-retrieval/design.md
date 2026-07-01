## Context

Genadiy currently stores Telegram uploads in S3-compatible object storage, extracts raw document/page text in a worker, and answers questions by sending all processed text for the requesting user to DeepSeek. The new target is RAG: use OpenAI embeddings for retrieval, keep DeepSeek for answer generation, search across all allowlisted users' documents, preserve table-heavy medical/lab documents, and allow users to download original source documents used in answers.

The existing local database is PostgreSQL. Keeping retrieval in PostgreSQL with `pgvector` avoids adding a separate vector database and keeps deployment understandable for a small bot.

## Goals / Non-Goals

**Goals:**

- Build a table-aware RAG index from processed raw text/page text.
- Use OpenAI embeddings API for document chunk and question embeddings.
- Retrieve relevant chunks across the shared allowlisted-user corpus.
- Ground DeepSeek answers in retrieved chunks instead of the entire corpus.
- Return source metadata and send original source documents through Telegram.
- Keep original upload storage and extraction behavior intact.
- Provide reindexing behavior for existing processed documents.

**Non-Goals:**

- No separate vector database service.
- No public document download URLs.
- No document-level access control beyond the existing allowlist.
- No OCR/table extraction overhaul beyond v1 table-aware block heuristics.
- No conversation memory or multi-turn retrieval state.

## Decisions

1. **Use PostgreSQL + pgvector for vector storage.**

   The project already requires PostgreSQL. A `pgvector`-enabled image plus a migration with `CREATE EXTENSION IF NOT EXISTS vector` gives local nearest-neighbor search without another service.

2. **Use OpenAI embeddings for retrieval and DeepSeek for final answers.**

   OpenAI creates embeddings for chunks and questions. DeepSeek receives only retrieved context and produces the answer. This keeps the existing answer-generation flow while adding scalable retrieval.

3. **Index all processed documents into AI-friendly content blocks.**

   The indexer creates `TEXT` and `TABLE` content blocks from page raw text. Table-like lines are preserved as Markdown-style pipe rows where possible so lab result tables remain legible to the answer model.

4. **Chunk content blocks before embedding.**

   Chunks use configurable character limits and overlap. Chunk metadata preserves upload ID, filename, page number, block type, and object key so answers can cite and download sources.

5. **Use a separate RAG indexing job table.**

   Extraction should remain successful even if OpenAI embeddings are unavailable. The worker discovers processed `DocumentText` rows without successful RAG indexes, creates/claims indexing jobs, retries failures, and records errors independently from extraction jobs.

6. **Retrieve from all allowed users' stored documents.**

   The RAG query searches the whole indexed corpus for stored uploads. The allowlist gates who can ask, but it does not partition document visibility in v1.

7. **Send original source documents through Telegram.**

   After an answer, the bot sends the original files for the top unique retrieved uploads, capped by configuration. It downloads from object storage and uses Telegram file sending rather than creating public URLs.

## Risks / Trade-offs

- **Shared corpus may expose one allowed user's uploads to another allowed user** -> Document this clearly; later add per-user or group ACLs if needed.
- **OpenAI receives document chunks and questions** -> Document privacy implications and avoid logging raw embedding inputs.
- **Table heuristics can miss complex layouts** -> Preserve raw page text and add table-like block formatting first; deeper table extraction can be a later change.
- **pgvector image change can affect existing local volumes** -> Use the same PostgreSQL major version and document restarting/migration steps.
- **Embedding costs can grow with corpus size** -> Store content hashes and skip already embedded chunks; make batch size and chunk limits configurable.
