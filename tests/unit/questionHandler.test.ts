import { describe, expect, it, vi } from "vitest";
import {
  NoProcessedDocumentTextError,
  type DocumentQuestionAnsweringService
} from "../../src/questionAnswering/documentQuestionAnswering.js";
import {
  splitTelegramReply,
  TelegramQuestionHandler
} from "../../src/telegram/questionHandler.js";
import type { AnswerSourceDocument } from "../../src/types.js";

describe("TelegramQuestionHandler", () => {
  it("replies when no indexed document context exists", async () => {
    const { handler, ctx } = createHarness({
      error: new NoProcessedDocumentTextError()
    });

    await handler.handleQuestion(ctx, 123, "What is in my documents?");

    expect(ctx.replies[0]).toContain("I do not have indexed document context");
  });

  it("replies with a safe failure message when answering fails", async () => {
    const logger = { error: vi.fn() };
    const { handler, ctx } = createHarness({
      error: new Error("upstream unavailable"),
      logger
    });

    await handler.handleQuestion(ctx, 123, "What is in my documents?");

    expect(ctx.replies).toEqual([
      "I could not answer this question right now. Please try again later."
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Document question answering failed")
    );
  });

  it("splits long Telegram replies into chunks", async () => {
    const { handler, ctx } = createHarness({
      answer: "a".repeat(3901)
    });

    await handler.handleQuestion(ctx, 123, "What is in my documents?");

    expect(ctx.replies).toHaveLength(2);
    expect(ctx.replies.every((reply) => reply.length <= 3900)).toBe(true);
  });

  it("sends answer source documents when available", async () => {
    const { handler, ctx, downloadBuffer } = createHarness({
      sources: [sourceDocument()]
    });

    await handler.handleQuestion(ctx, 123, "What is in my documents?");

    expect(downloadBuffer).toHaveBeenCalledWith({
      bucket: "telegram-documents",
      key: "telegram/source.pdf"
    });
    expect(ctx.documents).toHaveLength(1);
    expect(ctx.documents[0]?.document.filename).toBe("source.pdf");
  });

  it("logs and continues when source download fails", async () => {
    const logger = { error: vi.fn() };
    const { handler, ctx } = createHarness({
      logger,
      sourceDownloadError: new Error("storage unavailable"),
      sources: [sourceDocument()]
    });

    await handler.handleQuestion(ctx, 123, "What is in my documents?");

    expect(ctx.replies).toEqual(["Answer"]);
    expect(ctx.documents).toHaveLength(0);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to send source document")
    );
  });
});

describe("splitTelegramReply", () => {
  it("prefers natural boundaries", () => {
    expect(splitTelegramReply("first line\nsecond line", 11)).toEqual([
      "first line",
      "second line"
    ]);
  });
});

function createHarness(options: {
  answer?: string;
  error?: Error;
  logger?: Pick<Console, "error">;
  sourceDownloadError?: Error;
  sources?: AnswerSourceDocument[];
} = {}) {
  const replies: string[] = [];
  const documents: Array<{
    document: { source: Buffer; filename?: string | undefined };
    extra?: { caption?: string | undefined } | undefined;
  }> = [];
  const ctx = {
    replies,
    documents,
    reply: vi.fn(async (text: string) => {
      replies.push(text);
    }),
    replyWithDocument: vi.fn(
      async (
        document: { source: Buffer; filename?: string | undefined },
        extra?: { caption?: string | undefined }
      ) => {
        documents.push({ document, extra });
      }
    )
  };
  const downloadBuffer = vi.fn(async () => {
    if (options.sourceDownloadError) {
      throw options.sourceDownloadError;
    }

    return Buffer.from("source");
  });
  const service = {
    answerQuestion: vi.fn(async () => {
      if (options.error) {
        throw options.error;
      }

      return {
        answer: options.answer ?? "Answer",
        sourceCount: options.sources?.length ?? 0,
        contextCharacters: 10,
        sources: options.sources ?? []
      };
    })
  };

  return {
    handler: new TelegramQuestionHandler({
      service: service as unknown as DocumentQuestionAnsweringService,
      sourceDownloader: options.sources ? { downloadBuffer } : undefined,
      maxSourceDocuments: options.sources ? 3 : 0,
      sourceDownloadMaxBytes: 1000,
      logger: options.logger
    }),
    ctx,
    service,
    downloadBuffer
  };
}

function sourceDocument(): AnswerSourceDocument {
  return {
    uploadRecordId: "upload-1",
    bucket: "telegram-documents",
    objectKey: "telegram/source.pdf",
    originalFileName: "source.pdf",
    mimeType: "application/pdf",
    telegramChatId: "456",
    telegramMessageId: 42
  };
}
