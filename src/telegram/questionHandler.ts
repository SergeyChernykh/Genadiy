import {
  DocumentCorpusTooLargeError,
  EmptyQuestionError,
  NoProcessedDocumentTextError,
  type DocumentQuestionAnsweringService
} from "../questionAnswering/documentQuestionAnswering.js";

const TELEGRAM_REPLY_CHUNK_SIZE = 3900;

export interface TelegramQuestionContextLike {
  reply(text: string): Promise<unknown>;
}

export interface TelegramQuestionHandlerDependencies {
  service: DocumentQuestionAnsweringService;
  logger?: Pick<Console, "error"> | undefined;
}

export class TelegramQuestionHandler {
  private readonly logger: Pick<Console, "error">;

  constructor(private readonly deps: TelegramQuestionHandlerDependencies) {
    this.logger = deps.logger ?? console;
  }

  async handleQuestion(
    ctx: TelegramQuestionContextLike,
    telegramUserId: number,
    question: string
  ): Promise<void> {
    try {
      const result = await this.deps.service.answerQuestion({
        telegramUserId,
        question
      });
      await replyInChunks(ctx, result.answer);
    } catch (error) {
      await this.replyForError(ctx, telegramUserId, error);
    }
  }

  private async replyForError(
    ctx: TelegramQuestionContextLike,
    telegramUserId: number,
    error: unknown
  ): Promise<void> {
    if (error instanceof EmptyQuestionError) {
      await ctx.reply("Send your question after /ask, or send a plain text question.");
      return;
    }

    if (error instanceof NoProcessedDocumentTextError) {
      await ctx.reply(
        "I do not have processed document text for you yet. Upload a document or photo and run the worker first."
      );
      return;
    }

    if (error instanceof DocumentCorpusTooLargeError) {
      await ctx.reply(
        `Your processed documents are too large for the current all-documents question mode (${error.actualCharacters}/${error.maxCharacters} characters). Increase DEEPSEEK_MAX_CONTEXT_CHARS or reduce the corpus.`
      );
      return;
    }

    this.logger.error(
      `Document question answering failed for Telegram user ${telegramUserId}: ${errorToMessage(error)}`
    );
    await ctx.reply("I could not answer this question right now. Please try again later.");
  }
}

export async function replyInChunks(
  ctx: TelegramQuestionContextLike,
  text: string
): Promise<void> {
  const chunks = splitTelegramReply(text, TELEGRAM_REPLY_CHUNK_SIZE);
  for (const chunk of chunks) {
    await ctx.reply(chunk);
  }
}

export function splitTelegramReply(text: string, maxChunkSize: number): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > maxChunkSize) {
    const splitAt = findSplitIndex(remaining, maxChunkSize);
    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

function findSplitIndex(text: string, maxChunkSize: number): number {
  const newlineIndex = text.lastIndexOf("\n", maxChunkSize);
  if (newlineIndex > maxChunkSize * 0.6) {
    return newlineIndex;
  }

  const spaceIndex = text.lastIndexOf(" ", maxChunkSize);
  if (spaceIndex > maxChunkSize * 0.6) {
    return spaceIndex;
  }

  return maxChunkSize;
}

function errorToMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
