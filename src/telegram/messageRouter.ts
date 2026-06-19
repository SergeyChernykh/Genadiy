import { isAllowedUser } from "../auth.js";
import type { AppConfig } from "../config/env.js";
import { extractTelegramUpload, type TelegramMessageLike } from "./files.js";
import type { TelegramQuestionHandler } from "./questionHandler.js";
import type { TelegramUploadHandler } from "./uploadHandler.js";

export interface TelegramMessageContextLike {
  from?: {
    id: number;
  };
  message?: TelegramMessageLike;
  reply(text: string): Promise<unknown>;
}

export interface TelegramMessageRouterDependencies {
  config: Pick<AppConfig, "allowedTelegramUserIds">;
  uploadHandler: TelegramUploadHandler;
  questionHandler: TelegramQuestionHandler;
}

export class TelegramMessageRouter {
  constructor(private readonly deps: TelegramMessageRouterDependencies) {}

  async handle(ctx: TelegramMessageContextLike): Promise<void> {
    const userId = ctx.from?.id ?? ctx.message?.from?.id;
    if (
      typeof userId !== "number" ||
      !isAllowedUser(userId, this.deps.config.allowedTelegramUserIds)
    ) {
      await ctx.reply("You are not authorized to use this bot.");
      return;
    }
    const authorizedUserId = userId;

    if (extractTelegramUpload(ctx.message)) {
      await this.deps.uploadHandler.handle(ctx);
      return;
    }

    const route = routeTextMessage(ctx.message?.text);
    if (route.kind === "start") {
      await ctx.reply(
        "Send documents or photos to store them. After the worker extracts text, send a question or use /ask <question>."
      );
      return;
    }

    if (route.kind === "question") {
      await this.deps.questionHandler.handleQuestion(ctx, authorizedUserId, route.question);
      return;
    }

    if (route.kind === "emptyAsk") {
      await ctx.reply("Send your question after /ask, for example: /ask What is in my documents?");
      return;
    }

    await ctx.reply("Send a document, photo, or text question.");
  }
}

export type TextMessageRoute =
  | { kind: "start" }
  | { kind: "question"; question: string }
  | { kind: "emptyAsk" }
  | { kind: "unsupported" };

export function routeTextMessage(text: string | undefined): TextMessageRoute {
  const trimmed = text?.trim();
  if (!trimmed) {
    return { kind: "unsupported" };
  }

  if (/^\/start(?:@[a-zA-Z0-9_]+)?(?:\s|$)/.test(trimmed)) {
    return { kind: "start" };
  }

  const askMatch = trimmed.match(/^\/ask(?:@[a-zA-Z0-9_]+)?(?:\s+([\s\S]+))?$/);
  if (askMatch) {
    const question = askMatch[1]?.trim();
    return question ? { kind: "question", question } : { kind: "emptyAsk" };
  }

  if (trimmed.startsWith("/")) {
    return { kind: "unsupported" };
  }

  return { kind: "question", question: trimmed };
}
