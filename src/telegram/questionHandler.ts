import {
  EmptyQuestionError,
  NoRelevantDocumentContextError,
  NoProcessedDocumentTextError,
  type DocumentQuestionAnsweringService
} from "../questionAnswering/documentQuestionAnswering.js";
import type { AnswerSourceDocument, ObjectDownloader } from "../types.js";

const TELEGRAM_REPLY_CHUNK_SIZE = 3900;

export interface TelegramQuestionContextLike {
  reply(text: string): Promise<unknown>;
  replyWithDocument?(
    document: { source: Buffer; filename?: string | undefined },
    extra?: { caption?: string | undefined }
  ): Promise<unknown>;
}

export interface TelegramQuestionHandlerDependencies {
  service: DocumentQuestionAnsweringService;
  sourceDownloader?: ObjectDownloader | undefined;
  maxSourceDocuments?: number | undefined;
  sourceDownloadMaxBytes?: number | undefined;
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
      await this.sendSources(ctx, result.sources);
    } catch (error) {
      await this.replyForError(ctx, telegramUserId, error);
    }
  }

  private async sendSources(
    ctx: TelegramQuestionContextLike,
    sources: readonly AnswerSourceDocument[]
  ): Promise<void> {
    if (!this.deps.sourceDownloader || !ctx.replyWithDocument) {
      return;
    }

    const maxSourceDocuments = this.deps.maxSourceDocuments ?? 0;
    if (maxSourceDocuments <= 0) {
      return;
    }

    for (const source of sources.slice(0, maxSourceDocuments)) {
      try {
        const file = await this.deps.sourceDownloader.downloadBuffer({
          bucket: source.bucket,
          key: source.objectKey
        });

        const maxBytes = this.deps.sourceDownloadMaxBytes;
        if (typeof maxBytes === "number" && file.byteLength > maxBytes) {
          this.logger.error(
            `Skipped source document ${source.uploadRecordId}; size ${file.byteLength} exceeds ${maxBytes}.`
          );
          continue;
        }

        await ctx.replyWithDocument(
          {
            source: file,
            filename: source.originalFileName ?? `source-${source.telegramMessageId}`
          },
          {
            caption: `Source: ${source.originalFileName ?? source.telegramMessageId}`
          }
        );
      } catch (error) {
        this.logger.error(
          `Failed to send source document ${source.uploadRecordId}: ${errorToMessage(error)}`
        );
      }
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
        "I do not have indexed document context yet. Upload documents and keep the worker running until RAG indexing finishes."
      );
      return;
    }

    if (error instanceof NoRelevantDocumentContextError) {
      await ctx.reply(
        "I could not find relevant document context for this question."
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
