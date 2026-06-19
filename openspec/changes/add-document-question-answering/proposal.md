## Why

Genadiy already ingests Telegram documents and extracts raw text, but users cannot ask questions about the uploaded content from the same chat. Adding document-based question answering closes that loop and makes the stored document corpus useful without introducing a heavier retrieval system yet.

## What Changes

- Add Telegram text question handling for allowlisted users.
- Use DeepSeek Chat Completions API to answer from extracted raw document text stored in PostgreSQL.
- Load all available processed document text for the requesting Telegram user for v1, without embeddings, vector search, or chunk retrieval.
- Add safety behavior for empty corpora, oversized prompt context, DeepSeek/API failures, and unauthorized users.
- Add configuration for DeepSeek credentials, model, timeout, response limits, and context size guardrails.
- Document deployment and verification steps for the Q&A feature.

## Capabilities

### New Capabilities

- `document-question-answering`: Telegram users can ask questions and receive DeepSeek-generated answers grounded in uploaded document text.

### Modified Capabilities

- None.

## Impact

- Affects Telegram bot routing for non-upload text messages.
- Adds a DeepSeek API client and question-answering service.
- Extends configuration validation and `.env.example`.
- Adds repository access for processed document text.
- Adds unit tests for Q&A routing, prompt construction, config validation, and API failure handling.
- Sends extracted document text to an external DeepSeek API; documentation must make this privacy implication clear.
