import { createHash } from "node:crypto";
import type {
  DeepSeekChatClient,
  DeepSeekChatMessage,
  DocumentTextRepository,
  ProcessedDocumentText
} from "../types.js";

const SYSTEM_PROMPT = [
  "You are Genadiy, a Telegram assistant that answers questions using uploaded documents.",
  "Answer only from the document text provided in the user message.",
  "If the documents do not contain enough information, say that the answer is not present in the uploaded documents.",
  "Do not invent facts. Keep the answer concise.",
  "When possible, mention the source filename or Telegram message ID used for the answer."
].join(" ");

export interface DocumentQuestionAnsweringOptions {
  maxContextChars: number;
}

export interface DocumentQuestionAnsweringDependencies {
  documents: DocumentTextRepository;
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
}

export interface BuildDocumentQuestionPromptInput {
  question: string;
  documents: readonly ProcessedDocumentText[];
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
    super("No processed document text is available.");
    this.name = "NoProcessedDocumentTextError";
  }
}

export class DocumentCorpusTooLargeError extends Error {
  constructor(
    readonly actualCharacters: number,
    readonly maxCharacters: number
  ) {
    super(
      `Processed document text is too large for v1 question answering (${actualCharacters}/${maxCharacters} characters).`
    );
    this.name = "DocumentCorpusTooLargeError";
  }
}

export class DocumentQuestionAnsweringService {
  constructor(private readonly deps: DocumentQuestionAnsweringDependencies) {}

  async answerQuestion(
    input: AnswerDocumentQuestionInput
  ): Promise<AnswerDocumentQuestionResult> {
    const documents = await this.deps.documents.findProcessedTextsByTelegramUserId(
      input.telegramUserId
    );
    const prompt = buildDocumentQuestionPrompt({
      question: input.question,
      documents,
      maxContextChars: this.deps.options.maxContextChars
    });
    const answer = await this.deps.deepSeek.createChatCompletion({
      messages: prompt.messages,
      userId: deepSeekUserIdForTelegramUser(input.telegramUserId)
    });

    return {
      answer,
      sourceCount: prompt.sourceCount,
      contextCharacters: prompt.contextCharacters
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

  const documents = input.documents.filter((document) => document.rawText.trim().length > 0);
  if (documents.length === 0) {
    throw new NoProcessedDocumentTextError();
  }

  const context = documents.map(formatDocumentSource).join("\n\n");
  if (context.length > input.maxContextChars) {
    throw new DocumentCorpusTooLargeError(context.length, input.maxContextChars);
  }

  return {
    sourceCount: documents.length,
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
          "Uploaded document text:",
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

function formatDocumentSource(document: ProcessedDocumentText, index: number): string {
  const sourceTitle = document.originalFileName?.trim() || `message-${document.telegramMessageId}`;
  return [
    `[SOURCE ${index + 1}]`,
    `Upload ID: ${document.uploadRecordId}`,
    `Filename: ${sourceTitle}`,
    `Telegram chat/message: ${document.telegramChatId}/${document.telegramMessageId}`,
    document.mimeType ? `MIME type: ${document.mimeType}` : undefined,
    `Characters: ${document.characterCount}`,
    `Words: ${document.wordCount}`,
    "Text:",
    document.rawText
  ]
    .filter((line): line is string => typeof line === "string")
    .join("\n");
}
