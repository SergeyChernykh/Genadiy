## Context

Genadiy currently accepts Telegram document/photo uploads, stores original files in S3-compatible object storage, persists upload metadata in PostgreSQL, and extracts raw document text through a worker. The bot's non-upload path currently tells the user to send a document or photo. This change turns authorized text messages into document questions answered by DeepSeek using already extracted raw text.

The v1 requirement is intentionally simple: answer from all processed documents without embeddings, vector search, semantic chunking, or a separate retrieval service. The design still needs guardrails because the feature sends potentially sensitive document text to an external API and because large corpora can create expensive or rejected prompts.

## Goals / Non-Goals

**Goals:**

- Let allowlisted Telegram users ask questions about their uploaded, processed documents.
- Use DeepSeek Chat Completions API through a small local client.
- Ground every answer in raw text already stored in PostgreSQL.
- Keep upload behavior unchanged for document/photo messages.
- Fail clearly when no text is available, DeepSeek fails, or the corpus exceeds the configured prompt budget.
- Avoid logging raw document text, prompts, or DeepSeek responses beyond normal error metadata.

**Non-Goals:**

- No embeddings, vector database, or advanced RAG search.
- No document summarization cache or persistent Q&A history.
- No support for answering from unprocessed uploads.
- No webhook/API server changes.
- No local LLM fallback.

## Decisions

1. **Route text messages to a Q&A handler after authorization.**

   Upload messages continue through the existing upload handler. Plain text messages and `/ask <question>` are handled by a new question handler, while `/start` returns brief usage text. This keeps Telegram UX simple and avoids a separate command-only flow.

2. **Use per-sender corpus loading for v1.**

   The repository will load processed document-level raw text joined to `UploadRecord` for the requesting Telegram sender ID. This prevents one allowlisted user from accidentally querying another user's documents. An all-allowed-users mode can be added later if shared corpus behavior is needed.

3. **Use document-level raw text, not page text, for the first implementation.**

   `DocumentText.rawText` is the canonical extracted text after the raw-text-only change. Page text remains useful for future citations, but v1 can cite original filenames and Telegram message IDs without pulling every page row into the prompt.

4. **Call DeepSeek directly with `fetch`.**

   The project already uses Node.js and simple HTTP dependencies. A small `DeepSeekClient` wrapping `POST /chat/completions` avoids adding a larger SDK and keeps timeout/error behavior explicit.

5. **Default to `deepseek-v4-flash` with thinking disabled.**

   The feature needs grounded Q&A, not heavy reasoning. The model remains configurable via environment variables so deployment can switch to `deepseek-v4-pro` when quality matters more than latency/cost.

6. **Use a hard context character limit.**

   Even without advanced retrieval, the app must protect costs and API limits. If the assembled document corpus exceeds `DEEPSEEK_MAX_CONTEXT_CHARS`, the bot replies with a clear error instead of silently omitting documents. This preserves the promise that v1 answers from all included documents.

7. **Prompt for constrained answers with source labels.**

   The prompt includes source blocks containing upload ID, Telegram message ID, original filename, MIME type, and raw text. The system instruction requires answers only from supplied documents and tells the model to say when the answer is not present.

## Risks / Trade-offs

- **Sensitive data sent to DeepSeek** -> Document the privacy implication, require an explicit API key, and avoid logging raw prompts/text.
- **Large corpora may exceed budget or cost too much** -> Enforce `DEEPSEEK_MAX_CONTEXT_CHARS` and fail clearly until a later retrieval strategy exists.
- **Answers may still hallucinate** -> Use a strict grounding prompt and source labels; future work can add citations by page/chunk.
- **Per-user corpus may surprise users expecting shared documents** -> Document v1 behavior and keep repository boundaries explicit.
- **DeepSeek outages block answers** -> Return a friendly failure message without affecting upload or worker processing.
