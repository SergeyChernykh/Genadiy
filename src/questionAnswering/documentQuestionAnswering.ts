import { createHash } from "node:crypto";
import type { RagRetriever } from "../rag/retrieval.js";
import type {
  AnswerSourceDocument,
  DeepSeekChatClient,
  DeepSeekChatMessage,
  RetrievedDocumentChunk
} from "../types.js";

const SYSTEM_PROMPT = [
  "You are Genadiy, a Telegram assistant that answers questions using uploaded documents.",
  "Answer only from the retrieved document context provided in the user message.",
  "If the documents do not contain enough information, say that the answer is not present in the uploaded documents.",
  "Do not invent facts. Keep the answer concise.",
  "When possible, mention the source filename, page, or Telegram message ID used for the answer."
].join(" ");

export interface DocumentQuestionAnsweringOptions {
  maxContextChars: number;
}

export interface DocumentQuestionAnsweringDependencies {
  retriever: RagRetriever;
  deepSeek: DeepSeekChatClient;
  options: DocumentQuestionAnsweringOptions;
}

export interface AnswerDocumentQuestionInput {
  telegramUserId: number;
  question: string;
}

export interface AnswerDocumentQuestionResult {
  answer: string;
  sourceCount: number;
  contextCharacters: number;
  sources: readonly AnswerSourceDocument[];
}

export interface BuildDocumentQuestionPromptInput {
  question: string;
  chunks: readonly RetrievedDocumentChunk[];
  maxContextChars: number;
}

export interface BuiltDocumentQuestionPrompt {
  messages: readonly DeepSeekChatMessage[];
  sourceCount: number;
  contextCharacters: number;
}

export class EmptyQuestionError extends Error {
  constructor() {
    super("Question text is empty.");
    this.name = "EmptyQuestionError";
  }
}

export class NoProcessedDocumentTextError extends Error {
  constructor() {
    super("No indexed document context is available.");
    this.name = "NoProcessedDocumentTextError";
  }
}

export class NoRelevantDocumentContextError extends Error {
  constructor() {
    super("No relevant document context was found.");
    this.name = "NoRelevantDocumentContextError";
  }
}

export class DocumentQuestionAnsweringService {
  constructor(private readonly deps: DocumentQuestionAnsweringDependencies) {}

  async answerQuestion(
    input: AnswerDocumentQuestionInput
  ): Promise<AnswerDocumentQuestionResult> {
    const retrieved = await this.deps.retriever.retrieve(input.question);
    if (retrieved.indexedChunkCount === 0) {
      throw new NoProcessedDocumentTextError();
    }

    if (retrieved.chunks.length === 0) {
      throw new NoRelevantDocumentContextError();
    }

    const prompt = buildDocumentQuestionPrompt({
      question: input.question,
      chunks: retrieved.chunks,
      maxContextChars: this.deps.options.maxContextChars
    });
    const answer = await this.deps.deepSeek.createChatCompletion({
      messages: prompt.messages,
      userId: deepSeekUserIdForTelegramUser(input.telegramUserId)
    });

    return {
      answer,
      sourceCount: prompt.sourceCount,
      contextCharacters: prompt.contextCharacters,
      sources: retrieved.sources
    };
  }
}

export function buildDocumentQuestionPrompt(
  input: BuildDocumentQuestionPromptInput
): BuiltDocumentQuestionPrompt {
  const question = input.question.trim();
  if (question.length === 0) {
    throw new EmptyQuestionError();
  }

  const chunks = input.chunks.filter((chunk) => chunk.text.trim().length > 0);
  if (chunks.length === 0) {
    throw new NoProcessedDocumentTextError();
  }

  const context = contextWithinLimit(chunks, input.maxContextChars);

  return {
    sourceCount: new Set(chunks.map((chunk) => chunk.uploadRecordId)).size,
    contextCharacters: context.length,
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      {
        role: "user",
        content: [
          `Question:\n${question}`,
          "Retrieved uploaded document context:",
          context
        ].join("\n\n")
      }
    ]
  };
}

export function deepSeekUserIdForTelegramUser(telegramUserId: number): string {
  const digest = createHash("sha256").update(String(telegramUserId)).digest("hex").slice(0, 32);
  return `telegram-${digest}`;
}

function contextWithinLimit(chunks: readonly RetrievedDocumentChunk[], maxContextChars: number): string {
  const sources: string[] = [];
  let size = 0;

  for (const [index, chunk] of chunks.entries()) {
    const source = formatRetrievedChunkSource(chunk, index);
    if (sources.length > 0 && size + source.length + 2 > maxContextChars) {
      break;
    }

    if (sources.length === 0 && source.length > maxContextChars) {
      return source.slice(0, maxContextChars);
    }

    sources.push(source);
    size += source.length + 2;
  }

  return sources.join("\n\n");
}

function formatRetrievedChunkSource(chunk: RetrievedDocumentChunk, index: number): string {
  const sourceTitle = chunk.originalFileName?.trim() || `message-${chunk.telegramMessageId}`;
  return [
    `[SOURCE ${index + 1}]`,
    `Upload ID: ${chunk.uploadRecordId}`,
    `Filename: ${sourceTitle}`,
    `Telegram chat/message: ${chunk.telegramChatId}/${chunk.telegramMessageId}`,
    typeof chunk.pageNumber === "number" ? `Page: ${chunk.pageNumber}` : undefined,
    `Block type: ${chunk.blockType}`,
    `Retrieval score: ${chunk.score.toFixed(4)}`,
    "Text:",
    chunk.text
  ]
    .filter((line): line is string => typeof line === "string")
    .join("\n");
}
