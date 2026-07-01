# Document Question Answering

Genadiy can answer Telegram questions using raw text extracted from uploaded documents. The bot retrieves relevant RAG chunks from PostgreSQL/pgvector, sends only those chunks to DeepSeek, and then sends the original source documents used for the answer.

## Configuration

Add these values to `.env` for the bot process:

```bash
DEEPSEEK_API_KEY=replace-with-your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_THINKING_ENABLED=false
DEEPSEEK_TIMEOUT_MS=60000
DEEPSEEK_MAX_CONTEXT_CHARS=200000
DEEPSEEK_MAX_OUTPUT_TOKENS=2048
```

The bot fails startup with a clear error if `DEEPSEEK_API_KEY` is missing. Worker-only commands can still load configuration without a DeepSeek key.

RAG retrieval also requires embedding provider configuration. See `docs/rag-document-retrieval.md`.

## Runtime Flow

1. Start PostgreSQL and MinIO:

   ```bash
   sudo docker compose up -d
   ```

2. Apply migrations and build:

   ```bash
   npm run prisma:migrate
   npm run build
   ```

3. Start the bot and worker in separate terminals:

   ```bash
   npm start
   npm run start:worker
   ```

4. Upload a PDF or photo from an allowlisted Telegram user.
5. Wait for the worker to extract text and finish RAG indexing.
6. Ask a question in Telegram as plain text, or use:

   ```text
   /ask What is written in my documents?
   ```

## Verification

Check that processed raw text exists for your Telegram user:

```bash
sudo docker compose exec postgres psql -U telegram -d telegram_documents \
  -c 'select u."telegramUserId", u."originalFileName", d."characterCount", left(d."rawText", 300) from "DocumentText" d join "UploadRecord" u on u.id = d."uploadRecordId" order by d."createdAt" desc limit 5;'
```

If the bot replies that no indexed context is available, keep the worker running and check worker logs plus `DocumentRagIndexJob`.

## Privacy

When an authorized user asks a question, Genadiy sends the question to the configured embedding provider and sends retrieved document chunks to DeepSeek for answer generation. With OpenAI embeddings, document chunks and questions leave the local machine; with local Ollama embeddings, the embedding step stays local. Do not enable this feature for sensitive documents unless the configured external API use is acceptable for your deployment. The application does not log full prompts or raw document text during question answering.
