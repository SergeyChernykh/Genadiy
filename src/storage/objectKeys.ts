export interface TelegramObjectKeyInput {
  chatId: number;
  messageId: number;
  fileId: string;
  fileName?: string | undefined;
  date?: Date | undefined;
}

const MAX_FILE_NAME_LENGTH = 160;

export function sanitizeFileName(value: string | undefined, fallback = "file"): string {
  const leaf = (value ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part.length > 0)
    .at(-1);

  const cleaned = cleanSegment(leaf ?? "");
  if (cleaned.length > 0) {
    return cleaned;
  }

  const cleanedFallback = cleanSegment(fallback);
  return cleanedFallback.length > 0 ? cleanedFallback : "file";
}

export function buildTelegramObjectKey(input: TelegramObjectKeyInput): string {
  const date = input.date ?? new Date();
  const year = String(date.getUTCFullYear());
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  const fallback = sanitizeFileName(input.fileId, "file");
  const fileName = sanitizeFileName(input.fileName, fallback);

  return [
    "telegram",
    year,
    month,
    day,
    String(input.chatId),
    String(input.messageId),
    fileName
  ].join("/");
}

function cleanSegment(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/_+\./g, ".")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, MAX_FILE_NAME_LENGTH);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
