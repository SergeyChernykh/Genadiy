import { describe, expect, it, vi } from "vitest";
import {
  routeTextMessage,
  TelegramMessageRouter
} from "../../src/telegram/messageRouter.js";
import type { TelegramMessageLike } from "../../src/telegram/files.js";
import type { TelegramQuestionHandler } from "../../src/telegram/questionHandler.js";
import type { TelegramUploadHandler } from "../../src/telegram/uploadHandler.js";

const baseMessage: TelegramMessageLike = {
  message_id: 1,
  from: { id: 123 },
  chat: { id: 456 }
};

describe("TelegramMessageRouter", () => {
  it("rejects unauthorized text without asking questions or handling uploads", async () => {
    const { router, ctx, uploadHandler, questionHandler } = createHarness({
      message: { ...baseMessage, from: { id: 999 }, text: "What is this?" },
      fromId: 999
    });

    await router.handle(ctx);

    expect(ctx.replies).toEqual(["You are not authorized to use this bot."]);
    expect(uploadHandler.handle).not.toHaveBeenCalled();
    expect(questionHandler.handleQuestion).not.toHaveBeenCalled();
  });

  it("routes uploads to the existing upload handler", async () => {
    const { router, ctx, uploadHandler, questionHandler } = createHarness({
      message: {
        ...baseMessage,
        document: {
          file_id: "file-1",
          file_name: "report.pdf",
          mime_type: "application/pdf"
        }
      }
    });

    await router.handle(ctx);

    expect(uploadHandler.handle).toHaveBeenCalledWith(ctx);
    expect(questionHandler.handleQuestion).not.toHaveBeenCalled();
  });

  it("routes plain text to document question answering", async () => {
    const { router, ctx, questionHandler } = createHarness({
      message: { ...baseMessage, text: "  What is the diagnosis?  " }
    });

    await router.handle(ctx);

    expect(questionHandler.handleQuestion).toHaveBeenCalledWith(
      ctx,
      123,
      "What is the diagnosis?"
    );
  });

  it("routes /ask command arguments to document question answering", async () => {
    const { router, ctx, questionHandler } = createHarness({
      message: { ...baseMessage, text: "/ask What is the result?" }
    });

    await router.handle(ctx);

    expect(questionHandler.handleQuestion).toHaveBeenCalledWith(
      ctx,
      123,
      "What is the result?"
    );
  });

  it("replies to /start with usage guidance", async () => {
    const { router, ctx, questionHandler } = createHarness({
      message: { ...baseMessage, text: "/start" }
    });

    await router.handle(ctx);

    expect(ctx.replies[0]).toContain("Send documents or photos");
    expect(questionHandler.handleQuestion).not.toHaveBeenCalled();
  });

  it("asks for question text when /ask has no argument", async () => {
    const { router, ctx, questionHandler } = createHarness({
      message: { ...baseMessage, text: "/ask" }
    });

    await router.handle(ctx);

    expect(ctx.replies[0]).toContain("Send your question after /ask");
    expect(questionHandler.handleQuestion).not.toHaveBeenCalled();
  });
});

describe("routeTextMessage", () => {
  it("supports bot mention commands", () => {
    expect(routeTextMessage("/ask@GenadiyBot What changed?")).toEqual({
      kind: "question",
      question: "What changed?"
    });
    expect(routeTextMessage("/start@GenadiyBot")).toEqual({ kind: "start" });
  });
});

function createHarness(options: {
  message?: TelegramMessageLike;
  fromId?: number;
} = {}) {
  const replies: string[] = [];
  const message = options.message ?? baseMessage;
  const ctx = {
    from: { id: options.fromId ?? message.from?.id ?? 123 },
    message,
    replies,
    reply: vi.fn(async (text: string) => {
      replies.push(text);
    })
  };
  const uploadHandler = {
    handle: vi.fn(async () => {})
  } as unknown as TelegramUploadHandler;
  const questionHandler = {
    handleQuestion: vi.fn(async () => {})
  } as unknown as TelegramQuestionHandler;

  return {
    router: new TelegramMessageRouter({
      config: { allowedTelegramUserIds: new Set([123]) },
      uploadHandler,
      questionHandler
    }),
    ctx,
    uploadHandler,
    questionHandler
  };
}
