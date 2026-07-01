import { describe, expect, it } from "vitest";
import {
  loadConfig,
  parseAllowedTelegramUserIds,
  parseBooleanEnv,
  parseOcrLanguageCodes,
  resolveTelegramProxyUrl
} from "../../src/config/env.js";

describe("configuration", () => {
  it("parses a comma-separated allowlist into unique numeric user IDs", () => {
    expect([...parseAllowedTelegramUserIds("123, 456,123")]).toEqual([123, 456]);
  });

  it("rejects non-numeric allowlist entries", () => {
    expect(() => parseAllowedTelegramUserIds("123,abc")).toThrow(
      "ALLOWED_TELEGRAM_USER_IDS"
    );
  });

  it("parses boolean environment values", () => {
    expect(parseBooleanEnv("true", "FLAG")).toBe(true);
    expect(parseBooleanEnv("0", "FLAG")).toBe(false);
    expect(() => parseBooleanEnv("maybe", "FLAG")).toThrow("FLAG");
  });

  it("loads the full app configuration", () => {
    const config = loadConfig({
      BOT_TOKEN: "123:test",
      ALLOWED_TELEGRAM_USER_IDS: "123",
      DATABASE_URL: "postgresql://telegram:telegram@localhost:5432/telegram_documents",
      S3_ENDPOINT: "http://localhost:9000",
      S3_REGION: "us-east-1",
      S3_BUCKET: "telegram-documents",
      S3_ACCESS_KEY_ID: "minioadmin",
      S3_SECRET_ACCESS_KEY: "minioadmin",
      S3_FORCE_PATH_STYLE: "yes",
      MAX_FILE_BYTES: "1024"
    });

    expect(config.allowedTelegramUserIds.has(123)).toBe(true);
    expect(config.s3ForcePathStyle).toBe(true);
    expect(config.maxFileBytes).toBe(1024);
    expect(config.worker.ocrLanguages).toBe("eng+rus");
    expect(config.worker.ocrLanguageCodes).toEqual(["eng", "rus"]);
    expect(config.deepSeek).toMatchObject({
      apiKey: undefined,
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      thinkingEnabled: false,
      timeoutMs: 60000,
      maxContextChars: 200000,
      maxOutputTokens: 2048
    });
    expect(config.openAi).toMatchObject({
      provider: "openai",
      apiKey: undefined,
      baseUrl: "https://api.openai.com/v1",
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      embeddingTimeoutMs: 60000,
      embeddingBatchSize: 32,
      documentPrefix: "",
      queryPrefix: ""
    });
    expect(config.rag).toMatchObject({
      indexVersion: "rag-v1",
      chunkMaxChars: 1800,
      chunkOverlapChars: 200,
      retrievalLimit: 8,
      retrievalCandidateLimit: 32,
      minSimilarity: 0,
      exactMatchBoost: 0.08,
      maxContextChars: 12000,
      maxSourceDocuments: 3,
      sourceDownloadMaxBytes: 20971520
    });
  });

  it("loads DeepSeek configuration overrides", () => {
    const config = loadConfig({
      BOT_TOKEN: "123:test",
      ALLOWED_TELEGRAM_USER_IDS: "123",
      DATABASE_URL: "postgresql://telegram:telegram@localhost:5432/telegram_documents",
      S3_ENDPOINT: "http://localhost:9000",
      S3_BUCKET: "telegram-documents",
      S3_ACCESS_KEY_ID: "minioadmin",
      S3_SECRET_ACCESS_KEY: "minioadmin",
      DEEPSEEK_API_KEY: "deepseek-key",
      DEEPSEEK_BASE_URL: "https://deepseek.example",
      DEEPSEEK_MODEL: "deepseek-v4-pro",
      DEEPSEEK_THINKING_ENABLED: "yes",
      DEEPSEEK_TIMEOUT_MS: "12345",
      DEEPSEEK_MAX_CONTEXT_CHARS: "54321",
      DEEPSEEK_MAX_OUTPUT_TOKENS: "1024"
    });

    expect(config.deepSeek).toEqual({
      apiKey: "deepseek-key",
      baseUrl: "https://deepseek.example",
      model: "deepseek-v4-pro",
      thinkingEnabled: true,
      timeoutMs: 12345,
      maxContextChars: 54321,
      maxOutputTokens: 1024
    });
  });

  it("loads worker processing configuration overrides", () => {
    const config = loadConfig({
      BOT_TOKEN: "123:test",
      ALLOWED_TELEGRAM_USER_IDS: "123",
      DATABASE_URL: "postgresql://telegram:telegram@localhost:5432/telegram_documents",
      S3_ENDPOINT: "http://localhost:9000",
      S3_BUCKET: "telegram-documents",
      S3_ACCESS_KEY_ID: "minioadmin",
      S3_SECRET_ACCESS_KEY: "minioadmin",
      OCR_LANGUAGES: "eng+rus+deu",
      WORKER_POLL_INTERVAL_MS: "1000",
      WORKER_RETRY_DELAY_MS: "2000",
      WORKER_MAX_ATTEMPTS: "5",
      WORKER_COMMAND_TIMEOUT_MS: "3000",
      WORKER_MAX_FILE_BYTES: "4000",
      WORKER_MAX_PDF_PAGES: "6"
    });

    expect(config.worker).toMatchObject({
      ocrLanguages: "eng+rus+deu",
      ocrLanguageCodes: ["eng", "rus", "deu"],
      pollIntervalMs: 1000,
      retryDelayMs: 2000,
      maxAttempts: 5,
      commandTimeoutMs: 3000,
      maxFileBytes: 4000,
      maxPdfPages: 6
    });
  });

  it("loads OpenAI and RAG configuration overrides", () => {
    const config = loadConfig({
      BOT_TOKEN: "123:test",
      ALLOWED_TELEGRAM_USER_IDS: "123",
      DATABASE_URL: "postgresql://telegram:telegram@localhost:5432/telegram_documents",
      S3_ENDPOINT: "http://localhost:9000",
      S3_BUCKET: "telegram-documents",
      S3_ACCESS_KEY_ID: "minioadmin",
      S3_SECRET_ACCESS_KEY: "minioadmin",
      OPENAI_API_KEY: "openai-key",
      OPENAI_BASE_URL: "https://openai.example/v1",
      OPENAI_EMBEDDING_MODEL: "text-embedding-3-large",
      OPENAI_EMBEDDING_DIMENSIONS: "1536",
      OPENAI_EMBEDDING_TIMEOUT_MS: "1234",
      OPENAI_EMBEDDING_BATCH_SIZE: "4",
      RAG_INDEX_VERSION: "rag-v2",
      RAG_CHUNK_MAX_CHARS: "1000",
      RAG_CHUNK_OVERLAP_CHARS: "100",
      RAG_RETRIEVAL_LIMIT: "5",
      RAG_RETRIEVAL_CANDIDATE_LIMIT: "3",
      RAG_MIN_SIMILARITY: "0.25",
      RAG_EXACT_MATCH_BOOST: "0.2",
      RAG_MAX_CONTEXT_CHARS: "6000",
      RAG_MAX_SOURCE_DOCUMENTS: "2",
      RAG_SOURCE_DOWNLOAD_MAX_BYTES: "123456"
    });

    expect(config.openAi).toEqual({
      provider: "openai",
      apiKey: "openai-key",
      baseUrl: "https://openai.example/v1",
      embeddingModel: "text-embedding-3-large",
      embeddingDimensions: 1536,
      embeddingTimeoutMs: 1234,
      embeddingBatchSize: 4,
      documentPrefix: "",
      queryPrefix: ""
    });
    expect(config.rag).toEqual({
      indexVersion: "rag-v2",
      chunkMaxChars: 1000,
      chunkOverlapChars: 100,
      retrievalLimit: 5,
      retrievalCandidateLimit: 5,
      minSimilarity: 0.25,
      exactMatchBoost: 0.2,
      maxContextChars: 6000,
      maxSourceDocuments: 2,
      sourceDownloadMaxBytes: 123456
    });
  });

  it("loads local Ollama embedding defaults", () => {
    const config = loadConfig({
      BOT_TOKEN: "123:test",
      ALLOWED_TELEGRAM_USER_IDS: "123",
      DATABASE_URL: "postgresql://telegram:telegram@localhost:5432/telegram_documents",
      S3_ENDPOINT: "http://localhost:9000",
      S3_BUCKET: "telegram-documents",
      S3_ACCESS_KEY_ID: "minioadmin",
      S3_SECRET_ACCESS_KEY: "minioadmin",
      EMBEDDING_PROVIDER: "ollama",
      EMBEDDING_DOCUMENT_PREFIX: "passage: ",
      EMBEDDING_QUERY_PREFIX: "query: "
    });

    expect(config.openAi).toEqual({
      provider: "ollama",
      apiKey: "ollama",
      baseUrl: "http://localhost:11434/v1",
      embeddingModel: "qwen3-embedding:0.6b",
      embeddingDimensions: 1024,
      embeddingTimeoutMs: 60000,
      embeddingBatchSize: 8,
      documentPrefix: "passage: ",
      queryPrefix: "query: "
    });
  });

  it("rejects invalid RAG chunk overlap", () => {
    expect(() =>
      loadConfig({
        BOT_TOKEN: "123:test",
        ALLOWED_TELEGRAM_USER_IDS: "123",
        DATABASE_URL: "postgresql://telegram:telegram@localhost:5432/telegram_documents",
        S3_ENDPOINT: "http://localhost:9000",
        S3_BUCKET: "telegram-documents",
        S3_ACCESS_KEY_ID: "minioadmin",
        S3_SECRET_ACCESS_KEY: "minioadmin",
        RAG_CHUNK_MAX_CHARS: "100",
        RAG_CHUNK_OVERLAP_CHARS: "100"
      })
    ).toThrow("RAG_CHUNK_OVERLAP_CHARS");
  });

  it("validates OCR language syntax", () => {
    expect(parseOcrLanguageCodes("eng+rus")).toEqual(["eng", "rus"]);
    expect(() => parseOcrLanguageCodes("eng+../../bad")).toThrow("OCR_LANGUAGES");
  });

  it("uses explicit Telegram proxy before environment proxy fallbacks", () => {
    expect(
      resolveTelegramProxyUrl(
        { HTTPS_PROXY: "http://from-env.example:8080" },
        "http://explicit.example:8080"
      )
    ).toBe("http://explicit.example:8080");
  });

  it("falls back to HTTPS_PROXY for Telegram proxying", () => {
    expect(
      resolveTelegramProxyUrl({ HTTPS_PROXY: "http://127.0.0.1:12334" }, undefined)
    ).toBe("http://127.0.0.1:12334");
  });
});
