import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const DEFAULT_MAX_FILE_BYTES = 20 * 1024 * 1024;

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
  MAX_FILE_BYTES: z.coerce.number().int().positive().default(DEFAULT_MAX_FILE_BYTES)
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
    maxFileBytes: parsed.MAX_FILE_BYTES
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
