import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const DEFAULT_MAX_FILE_BYTES = 20 * 1024 * 1024;
const DEFAULT_WORKER_MAX_FILE_BYTES = 50 * 1024 * 1024;
const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
const DEFAULT_DEEPSEEK_TIMEOUT_MS = 60000;
const DEFAULT_DEEPSEEK_MAX_CONTEXT_CHARS = 200000;
const DEFAULT_DEEPSEEK_MAX_OUTPUT_TOKENS = 2048;

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const envSchema = z.object({
  BOT_TOKEN: z.string().trim().min(1),
  ALLOWED_TELEGRAM_USER_IDS: z.string().trim().min(1),
  DATABASE_URL: z.string().trim().min(1),
  TELEGRAM_PROXY_URL: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  S3_ENDPOINT: z.string().trim().min(1),
  S3_REGION: z.string().trim().min(1).default("us-east-1"),
  S3_BUCKET: z.string().trim().min(1),
  S3_ACCESS_KEY_ID: z.string().trim().min(1),
  S3_SECRET_ACCESS_KEY: z.string().trim().min(1),
  S3_FORCE_PATH_STYLE: z.string().trim().default("true"),
  MAX_FILE_BYTES: z.coerce.number().int().positive().default(DEFAULT_MAX_FILE_BYTES),
  OCR_LANGUAGES: z.string().trim().min(1).default("eng+rus"),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  WORKER_RETRY_DELAY_MS: z.coerce.number().int().positive().default(60000),
  WORKER_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  WORKER_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  WORKER_MAX_FILE_BYTES: z.coerce.number().int().positive().default(DEFAULT_WORKER_MAX_FILE_BYTES),
  WORKER_MAX_PDF_PAGES: z.coerce.number().int().positive().default(50),
  DEEPSEEK_API_KEY: optionalTrimmedString,
  DEEPSEEK_BASE_URL: z.string().trim().url().default(DEFAULT_DEEPSEEK_BASE_URL),
  DEEPSEEK_MODEL: z.string().trim().min(1).default(DEFAULT_DEEPSEEK_MODEL),
  DEEPSEEK_THINKING_ENABLED: z.string().trim().default("false"),
  DEEPSEEK_TIMEOUT_MS: z.coerce.number().int().positive().default(DEFAULT_DEEPSEEK_TIMEOUT_MS),
  DEEPSEEK_MAX_CONTEXT_CHARS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_DEEPSEEK_MAX_CONTEXT_CHARS),
  DEEPSEEK_MAX_OUTPUT_TOKENS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_DEEPSEEK_MAX_OUTPUT_TOKENS)
});

export interface AppConfig {
  botToken: string;
  allowedTelegramUserIds: ReadonlySet<number>;
  databaseUrl: string;
  telegramProxyUrl: string | undefined;
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3ForcePathStyle: boolean;
  maxFileBytes: number;
  worker: WorkerConfig;
  deepSeek: DeepSeekConfig;
}

export interface WorkerConfig {
  ocrLanguages: string;
  ocrLanguageCodes: readonly string[];
  pollIntervalMs: number;
  retryDelayMs: number;
  maxAttempts: number;
  commandTimeoutMs: number;
  maxFileBytes: number;
  maxPdfPages: number;
}

export interface DeepSeekConfig {
  apiKey: string | undefined;
  baseUrl: string;
  model: string;
  thinkingEnabled: boolean;
  timeoutMs: number;
  maxContextChars: number;
  maxOutputTokens: number;
}

export function parseAllowedTelegramUserIds(value: string): ReadonlySet<number> {
  const ids = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      if (!/^\d+$/.test(part)) {
        throw new Error("ALLOWED_TELEGRAM_USER_IDS must contain comma-separated numeric user IDs.");
      }

      const id = Number(part);
      if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error("ALLOWED_TELEGRAM_USER_IDS must contain positive safe integers.");
      }

      return id;
    });

  if (ids.length === 0) {
    throw new Error("ALLOWED_TELEGRAM_USER_IDS must contain at least one user ID.");
  }

  return new Set(ids);
}

export function parseBooleanEnv(value: string, variableName: string): boolean {
  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "y"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "n"].includes(normalized)) {
    return false;
  }

  throw new Error(`${variableName} must be a boolean value.`);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);

  return {
    botToken: parsed.BOT_TOKEN,
    allowedTelegramUserIds: parseAllowedTelegramUserIds(parsed.ALLOWED_TELEGRAM_USER_IDS),
    databaseUrl: parsed.DATABASE_URL,
    telegramProxyUrl: resolveTelegramProxyUrl(env, parsed.TELEGRAM_PROXY_URL),
    s3Endpoint: parsed.S3_ENDPOINT,
    s3Region: parsed.S3_REGION,
    s3Bucket: parsed.S3_BUCKET,
    s3AccessKeyId: parsed.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: parsed.S3_SECRET_ACCESS_KEY,
    s3ForcePathStyle: parseBooleanEnv(parsed.S3_FORCE_PATH_STYLE, "S3_FORCE_PATH_STYLE"),
    maxFileBytes: parsed.MAX_FILE_BYTES,
    worker: {
      ocrLanguages: normalizeOcrLanguages(parsed.OCR_LANGUAGES),
      ocrLanguageCodes: parseOcrLanguageCodes(parsed.OCR_LANGUAGES),
      pollIntervalMs: parsed.WORKER_POLL_INTERVAL_MS,
      retryDelayMs: parsed.WORKER_RETRY_DELAY_MS,
      maxAttempts: parsed.WORKER_MAX_ATTEMPTS,
      commandTimeoutMs: parsed.WORKER_COMMAND_TIMEOUT_MS,
      maxFileBytes: parsed.WORKER_MAX_FILE_BYTES,
      maxPdfPages: parsed.WORKER_MAX_PDF_PAGES
    },
    deepSeek: {
      apiKey: parsed.DEEPSEEK_API_KEY,
      baseUrl: parsed.DEEPSEEK_BASE_URL,
      model: parsed.DEEPSEEK_MODEL,
      thinkingEnabled: parseBooleanEnv(
        parsed.DEEPSEEK_THINKING_ENABLED,
        "DEEPSEEK_THINKING_ENABLED"
      ),
      timeoutMs: parsed.DEEPSEEK_TIMEOUT_MS,
      maxContextChars: parsed.DEEPSEEK_MAX_CONTEXT_CHARS,
      maxOutputTokens: parsed.DEEPSEEK_MAX_OUTPUT_TOKENS
    }
  };
}

export function resolveTelegramProxyUrl(
  env: NodeJS.ProcessEnv,
  explicitProxyUrl: string | undefined
): string | undefined {
  return [
    explicitProxyUrl,
    env.HTTPS_PROXY,
    env.https_proxy,
    env.HTTP_PROXY,
    env.http_proxy,
    env.ALL_PROXY,
    env.all_proxy
  ].find((value) => typeof value === "string" && value.trim().length > 0);
}

export function parseOcrLanguageCodes(value: string): readonly string[] {
  const codes = value
    .split("+")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (codes.length === 0) {
    throw new Error("OCR_LANGUAGES must contain at least one Tesseract language code.");
  }

  for (const code of codes) {
    if (!/^[a-z0-9_]+$/i.test(code)) {
      throw new Error("OCR_LANGUAGES must contain Tesseract language codes separated by '+'.");
    }
  }

  return codes;
}

export function normalizeOcrLanguages(value: string): string {
  return parseOcrLanguageCodes(value).join("+");
}
