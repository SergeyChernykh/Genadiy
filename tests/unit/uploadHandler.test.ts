import { describe, expect, it, vi } from "vitest";
import { TelegramUploadHandler } from "../../src/telegram/uploadHandler.js";
import type { TelegramMessageLike } from "../../src/telegram/files.js";
import type { ObjectStorage, UploadRecordRepository } from "../../src/types.js";

const documentMessage: TelegramMessageLike = {
  message_id: 42,
  from: { id: 123 },
  chat: { id: 456 },
  document: {
    file_id: "file-123",
    file_unique_id: "unique-123",
    file_name: "invoice.pdf",
    mime_type: "application/pdf",
    file_size: 5
  }
};

describe("TelegramUploadHandler", () => {
  it("rejects unauthorized users without downloading, storing, or recording", async () => {
    const { handler, ctx, downloadFile, uploadBuffer, createStored, createFailed } =
      createHarness({
        message: { ...documentMessage, from: { id: 999 } },
        fromId: 999
      });

    await handler.handle(ctx);

    expect(ctx.replies).toEqual(["You are not authorized to use this bot."]);
    expect(downloadFile).not.toHaveBeenCalled();
    expect(uploadBuffer).not.toHaveBeenCalled();
    expect(createStored).not.toHaveBeenCalled();
    expect(createFailed).not.toHaveBeenCalled();
  });

  it("stores an authorized document and records metadata", async () => {
    const { handler, ctx, downloadFile, uploadBuffer, createStored } = createHarness();

    await handler.handle(ctx);

    expect(downloadFile).toHaveBeenCalledWith("file-123");
    expect(uploadBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "telegram/2026/06/17/456/42/invoice.pdf",
        contentType: "application/pdf",
        contentLength: 5
      })
    );
    expect(createStored).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: "file-123", originalFileName: "invoice.pdf" }),
      expect.objectContaining({ bucket: "telegram-documents" })
    );
    expect(ctx.replies).toEqual(["Stored invoice.pdf."]);
  });

  it("rejects oversize files before downloading when Telegram provides file size", async () => {
    const { handler, ctx, downloadFile, uploadBuffer } = createHarness({
      message: {
        ...documentMessage,
        document: {
          file_id: "file-123",
          file_unique_id: "unique-123",
          file_name: "invoice.pdf",
          mime_type: "application/pdf",
          file_size: 11
        }
      },
      maxFileBytes: 10
    });

    await handler.handle(ctx);

    expect(ctx.replies[0]).toContain("File is too large");
    expect(downloadFile).not.toHaveBeenCalled();
    expect(uploadBuffer).not.toHaveBeenCalled();
  });

  it("records a failed upload when object storage fails", async () => {
    const { handler, ctx, uploadBuffer, createFailed } = createHarness({
      uploadError: new Error("MinIO unavailable")
    });

    await handler.handle(ctx);

    expect(uploadBuffer).toHaveBeenCalledOnce();
    expect(createFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        failureMessage: "MinIO unavailable",
        bucket: "telegram-documents",
        objectKey: "telegram/2026/06/17/456/42/invoice.pdf"
      })
    );
    expect(ctx.replies).toEqual(["I could not store this file. Please try again later."]);
  });

  it("reports failure when persistence fails after storage", async () => {
    const { handler, ctx, createStored, createFailed } = createHarness({
      storedRecordError: new Error("database unavailable")
    });

    await handler.handle(ctx);

    expect(createStored).toHaveBeenCalledOnce();
    expect(createFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        failureMessage: "database unavailable"
      })
    );
    expect(ctx.replies).toEqual(["I could not store this file. Please try again later."]);
  });

  it("replies to unsupported messages", async () => {
    const { handler, ctx, downloadFile } = createHarness({
      message: {
        message_id: 99,
        from: { id: 123 },
        chat: { id: 456 }
      }
    });

    await handler.handle(ctx);

    expect(ctx.replies).toEqual(["Send a document or photo to store it."]);
    expect(downloadFile).not.toHaveBeenCalled();
  });
});

function createHarness(options: {
  message?: TelegramMessageLike;
  fromId?: number;
  maxFileBytes?: number;
  uploadError?: Error;
  storedRecordError?: Error;
} = {}) {
  const replies: string[] = [];
  const message = options.message ?? documentMessage;
  const ctx = {
    from: { id: options.fromId ?? message.from?.id ?? 123 },
    message,
    replies,
    reply: vi.fn(async (text: string) => {
      replies.push(text);
    })
  };

  const downloadFile = vi.fn(async () => Buffer.from("hello"));
  const uploadBuffer = vi.fn(async () => {
    if (options.uploadError) {
      throw options.uploadError;
    }

    return {
      bucket: "telegram-documents",
      key: "telegram/2026/06/17/456/42/invoice.pdf",
      etag: "etag"
    };
  });
  const createStored = vi.fn(async () => {
    if (options.storedRecordError) {
      throw options.storedRecordError;
    }
  });
  const createFailed = vi.fn(async () => {});
  const storage: ObjectStorage = { uploadBuffer };
  const records: UploadRecordRepository = { createStored, createFailed };

  return {
    handler: new TelegramUploadHandler({
      config: {
        allowedTelegramUserIds: new Set([123]),
        maxFileBytes: options.maxFileBytes ?? 1024,
        s3Bucket: "telegram-documents"
      },
      storage,
      records,
      downloadFile,
      now: () => new Date("2026-06-17T12:00:00.000Z"),
      logger: { error: vi.fn() }
    }),
    ctx,
    downloadFile,
    uploadBuffer,
    createStored,
    createFailed
  };
}
