import { describe, expect, it, vi } from "vitest";
import {
  buildDocumentQuestionPrompt,
  deepSeekUserIdForTelegramUser,
  DocumentQuestionAnsweringService,
  NoProcessedDocumentTextError,
  NoRelevantDocumentContextError
} from "../../src/questionAnswering/documentQuestionAnswering.js";
import type { RagRetriever } from "../../src/rag/retrieval.js";
import type {
  AnswerSourceDocument,
  DeepSeekChatClient,
  RetrievedDocumentChunk
} from "../../src/types.js";

const retrievedChunk: RetrievedDocumentChunk = {
  chunkId: "chunk-1",
  uploadRecordId: "upload-1",
  bucket: "telegram-documents",
  objectKey: "telegram/source.pdf",
  originalFileName: "analysis.pdf",
  mimeType: "application/pdf",
  telegramChatId: "456",
  telegramMessageId: 42,
  pageNumber: 1,
  blockType: "TABLE",
  text: "| Test | Result |\n| PCR | negative |",
  similarity: 0.82,
  exactMatchScore: 0.08,
  score: 0.9
};

const source: AnswerSourceDocument = {
  uploadRecordId: "upload-1",
  bucket: "telegram-documents",
  objectKey: "telegram/source.pdf",
  originalFileName: "analysis.pdf",
  mimeType: "application/pdf",
  telegramChatId: "456",
  telegramMessageId: 42
};

describe("document question answering", () => {
  it("builds a grounded prompt with retrieved chunk source labels", () => {
    const prompt = buildDocumentQuestionPrompt({
      question: "What is the result?",
      chunks: [retrievedChunk],
      maxContextChars: 1000
    });

    expect(prompt.sourceCount).toBe(1);
    expect(prompt.contextCharacters).toBeGreaterThan(retrievedChunk.text.length);
    expect(prompt.messages[0]?.role).toBe("system");
    expect(prompt.messages[1]?.content).toContain("Question:\nWhat is the result?");
    expect(prompt.messages[1]?.content).toContain("Filename: analysis.pdf");
    expect(prompt.messages[1]?.content).toContain("Block type: TABLE");
    expect(prompt.messages[1]?.content).toContain("| PCR | negative |");
  });

  it("uses retrieved chunks and calls DeepSeek with a hashed user id", async () => {
    const retriever = {
      retrieve: vi.fn(async () => ({
        chunks: [retrievedChunk],
        sources: [source],
        indexedChunkCount: 1
      }))
    } as unknown as RagRetriever;
    const deepSeek: DeepSeekChatClient = {
      createChatCompletion: vi.fn(async () => "The result is negative.")
    };
    const service = new DocumentQuestionAnsweringService({
      retriever,
      deepSeek,
      options: { maxContextChars: 1000 }
    });

    const result = await service.answerQuestion({
      telegramUserId: 123,
      question: "What is the result?"
    });

    expect(result.answer).toBe("The result is negative.");
    expect(result.sources).toEqual([source]);
    expect(deepSeek.createChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: deepSeekUserIdForTelegramUser(123)
      })
    );
    expect(deepSeekUserIdForTelegramUser(123)).not.toContain("123");
  });

  it("does not call DeepSeek when there are no indexed chunks", async () => {
    const retriever = {
      retrieve: vi.fn(async () => ({
        chunks: [],
        sources: [],
        indexedChunkCount: 0
      }))
    } as unknown as RagRetriever;
    const deepSeek: DeepSeekChatClient = {
      createChatCompletion: vi.fn(async () => "unused")
    };
    const service = new DocumentQuestionAnsweringService({
      retriever,
      deepSeek,
      options: { maxContextChars: 1000 }
    });

    await expect(
      service.answerQuestion({ telegramUserId: 123, question: "Anything?" })
    ).rejects.toBeInstanceOf(NoProcessedDocumentTextError);
    expect(deepSeek.createChatCompletion).not.toHaveBeenCalled();
  });

  it("does not call DeepSeek when retrieval finds no relevant chunks", async () => {
    const retriever = {
      retrieve: vi.fn(async () => ({
        chunks: [],
        sources: [],
        indexedChunkCount: 10
      }))
    } as unknown as RagRetriever;
    const deepSeek: DeepSeekChatClient = {
      createChatCompletion: vi.fn(async () => "unused")
    };
    const service = new DocumentQuestionAnsweringService({
      retriever,
      deepSeek,
      options: { maxContextChars: 1000 }
    });

    await expect(
      service.answerQuestion({ telegramUserId: 123, question: "Anything?" })
    ).rejects.toBeInstanceOf(NoRelevantDocumentContextError);
    expect(deepSeek.createChatCompletion).not.toHaveBeenCalled();
  });
});
