import { describe, expect, it, vi } from "vitest";
import {
  buildDocumentQuestionPrompt,
  deepSeekUserIdForTelegramUser,
  DocumentCorpusTooLargeError,
  DocumentQuestionAnsweringService,
  NoProcessedDocumentTextError
} from "../../src/questionAnswering/documentQuestionAnswering.js";
import type {
  DeepSeekChatClient,
  DocumentTextRepository,
  ProcessedDocumentText
} from "../../src/types.js";

const documentText: ProcessedDocumentText = {
  uploadRecordId: "upload-1",
  telegramChatId: "456",
  telegramMessageId: 42,
  originalFileName: "analysis.pdf",
  mimeType: "application/pdf",
  rawText: "Patient test result is negative.",
  characterCount: 32,
  wordCount: 5,
  createdAt: new Date("2026-06-18T10:00:00.000Z")
};

describe("document question answering", () => {
  it("builds a grounded prompt with source labels and raw text", () => {
    const prompt = buildDocumentQuestionPrompt({
      question: "What is the result?",
      documents: [documentText],
      maxContextChars: 1000
    });

    expect(prompt.sourceCount).toBe(1);
    expect(prompt.contextCharacters).toBeGreaterThan(documentText.rawText.length);
    expect(prompt.messages[0]?.role).toBe("system");
    expect(prompt.messages[1]?.content).toContain("Question:\nWhat is the result?");
    expect(prompt.messages[1]?.content).toContain("Filename: analysis.pdf");
    expect(prompt.messages[1]?.content).toContain("Patient test result is negative.");
  });

  it("uses the repository documents and calls DeepSeek with a hashed user id", async () => {
    const documents: DocumentTextRepository = {
      findProcessedTextsByTelegramUserId: vi.fn(async () => [documentText])
    };
    const deepSeek: DeepSeekChatClient = {
      createChatCompletion: vi.fn(async () => "The result is negative.")
    };
    const service = new DocumentQuestionAnsweringService({
      documents,
      deepSeek,
      options: { maxContextChars: 1000 }
    });

    const result = await service.answerQuestion({
      telegramUserId: 123,
      question: "What is the result?"
    });

    expect(result.answer).toBe("The result is negative.");
    expect(documents.findProcessedTextsByTelegramUserId).toHaveBeenCalledWith(123);
    expect(deepSeek.createChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: deepSeekUserIdForTelegramUser(123)
      })
    );
    expect(deepSeekUserIdForTelegramUser(123)).not.toContain("123");
  });

  it("does not call DeepSeek when there is no processed text", async () => {
    const documents: DocumentTextRepository = {
      findProcessedTextsByTelegramUserId: vi.fn(async () => [])
    };
    const deepSeek: DeepSeekChatClient = {
      createChatCompletion: vi.fn(async () => "unused")
    };
    const service = new DocumentQuestionAnsweringService({
      documents,
      deepSeek,
      options: { maxContextChars: 1000 }
    });

    await expect(
      service.answerQuestion({ telegramUserId: 123, question: "Anything?" })
    ).rejects.toBeInstanceOf(NoProcessedDocumentTextError);
    expect(deepSeek.createChatCompletion).not.toHaveBeenCalled();
  });

  it("rejects oversized all-document context before calling DeepSeek", async () => {
    const documents: DocumentTextRepository = {
      findProcessedTextsByTelegramUserId: vi.fn(async () => [
        { ...documentText, rawText: "x".repeat(200) }
      ])
    };
    const deepSeek: DeepSeekChatClient = {
      createChatCompletion: vi.fn(async () => "unused")
    };
    const service = new DocumentQuestionAnsweringService({
      documents,
      deepSeek,
      options: { maxContextChars: 100 }
    });

    await expect(
      service.answerQuestion({ telegramUserId: 123, question: "Anything?" })
    ).rejects.toBeInstanceOf(DocumentCorpusTooLargeError);
    expect(deepSeek.createChatCompletion).not.toHaveBeenCalled();
  });
});
