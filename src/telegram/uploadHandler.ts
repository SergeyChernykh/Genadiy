import { isAllowedUser } from "../auth.js";
import type { AppConfig } from "../config/env.js";
import { buildTelegramObjectKey } from "../storage/objectKeys.js";
import type { ObjectStorage, UploadRecordRepository } from "../types.js";
import {
  extractTelegramUpload,
  isOverMaxFileSize,
  type TelegramMessageLike
} from "./files.js";

export interface TelegramContextLike {
  from?: {
    id: number;
  };
  message?: TelegramMessageLike;
  reply(text: string): Promise<unknown>;
}

export interface TelegramUploadHandlerDependencies {
  config: Pick<AppConfig, "allowedTelegramUserIds" | "maxFileBytes" | "s3Bucket">;
  storage: ObjectStorage;
  records: UploadRecordRepository;
  downloadFile(fileId: string): Promise<Buffer>;
  now?: () => Date;
  logger?: Pick<Console, "error">;
}

export class TelegramUploadHandler {
  private readonly now: () => Date;
  private readonly logger: Pick<Console, "error">;

  constructor(private readonly deps: TelegramUploadHandlerDependencies) {
    this.now = deps.now ?? (() => new Date());
    this.logger = deps.logger ?? console;
  }

  async handle(ctx: TelegramContextLike): Promise<void> {
    const userId = ctx.from?.id ?? ctx.message?.from?.id;
    if (!isAllowedUser(userId, this.deps.config.allowedTelegramUserIds)) {
      await ctx.reply("You are not authorized to use this bot.");
      return;
    }

    const upload = extractTelegramUpload(ctx.message);
    if (!upload) {
      await ctx.reply("Send a document or photo to store it.");
      return;
    }

    if (isOverMaxFileSize(upload.fileSizeBytes, this.deps.config.maxFileBytes)) {
      await ctx.reply(
        `File is too large. Maximum allowed size is ${formatBytes(this.deps.config.maxFileBytes)}.`
      );
      return;
    }

    const objectKey = buildTelegramObjectKey({
      chatId: upload.chatId,
      messageId: upload.messageId,
      fileId: upload.fileId,
      fileName: upload.originalFileName,
      date: this.now()
    });

    try {
      const fileBuffer = await this.deps.downloadFile(upload.fileId);
      if (fileBuffer.byteLength > this.deps.config.maxFileBytes) {
        await ctx.reply(
          `File is too large. Maximum allowed size is ${formatBytes(this.deps.config.maxFileBytes)}.`
        );
        return;
      }

      const storedObject = await this.deps.storage.uploadBuffer({
        key: objectKey,
        body: fileBuffer,
        contentType: upload.mimeType,
        contentLength: fileBuffer.byteLength
      });

      await this.deps.records.createStored(upload, storedObject);
      await ctx.reply(`Stored ${displayFileName(upload.originalFileName)}.`);
    } catch (error) {
      const failureMessage = errorToMessage(error);
      await this.recordFailure(upload.fileId, objectKey, failureMessage, ctx);
    }
  }

  private async recordFailure(
    fileId: string,
    objectKey: string,
    failureMessage: string,
    ctx: TelegramContextLike
  ): Promise<void> {
    const upload = extractTelegramUpload(ctx.message);
    if (!upload) {
      await ctx.reply("I could not store this file. Please try again later.");
      return;
    }

    try {
      await this.deps.records.createFailed({
        upload,
        failureMessage,
        bucket: this.deps.config.s3Bucket,
        objectKey
      });
    } catch (recordError) {
      this.logger.error(
        `Failed to record upload failure for Telegram file ${fileId}: ${errorToMessage(recordError)}`
      );
    }

    await ctx.reply("I could not store this file. Please try again later.");
  }
}

function displayFileName(fileName: string | undefined): string {
  return fileName && fileName.trim().length > 0 ? fileName : "file";
}

function formatBytes(bytes: number): string {
  const mib = bytes / (1024 * 1024);
  return `${mib.toFixed(mib >= 10 ? 0 : 1)} MiB`;
}

function errorToMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
