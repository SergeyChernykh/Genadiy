import { describe, expect, it } from "vitest";
import {
  loadConfig,
  parseAllowedTelegramUserIds,
  parseBooleanEnv,
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
