import { describe, expect, it, vi } from "vitest";
import {
  NoProcessedDocumentTextError,
  type DocumentQuestionAnsweringService
} from "../../src/questionAnswering/documentQuestionAnswering.js";
import {
  splitTelegramReply,
  TelegramQuestionHandler
} from "../../src/telegram/questionHandler.js";

describe("TelegramQuestionHandler", () => {
  it("replies when no processed document text exists", async () => {
    const { handler, ctx } = createHarness({
      error: new NoProcessedDocumentTextError()
    });

    await handler.handleQuestion(ctx, 123, "What is in my documents?");

    expect(ctx.replies[0]).toContain("I do not have processed document text");
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
} = {}) {
  const replies: string[] = [];
  const ctx = {
    replies,
    reply: vi.fn(async (text: string) => {
      replies.push(text);
    })
  };
  const service = {
    answerQuestion: vi.fn(async () => {
      if (options.error) {
        throw options.error;
      }

      return {
        answer: options.answer ?? "Answer",
        sourceCount: 1,
        contextCharacters: 10
      };
    })
  };

  return {
    handler: new TelegramQuestionHandler({
      service: service as unknown as DocumentQuestionAnsweringService,
      logger: options.logger
    }),
    ctx,
    service
  };
}
