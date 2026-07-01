import { describe, expect, it, vi } from "vitest";
import { UploadStatus, type PrismaClient } from "../../src/generated/prisma/client.js";
import {
  RagRetrievalRepository,
  type RagRetrievalOptions
} from "../../src/rag/persistence.js";
import { RagRetriever } from "../../src/rag/retrieval.js";
import type { EmbeddingClient } from "../../src/types.js";

describe("RAG retrieval", () => {
  it("passes configured embedding dimensions to repository calls", async () => {
    const embeddings: EmbeddingClient = {
      createEmbeddings: vi.fn(async () => ({
        embeddings: [[0.1, 0.2]],
        model: "qwen3-embedding:0.6b",
        dimensions: 1024
      }))
    };
    const repository = {
      countIndexedChunks: vi.fn(async () => 1),
      searchRelevantChunks: vi.fn(async () => [])
    };
    const retriever = new RagRetriever({
      embeddings,
      repository: repository as unknown as RagRetrievalRepository,
      options: {
        indexVersion: "rag-local-qwen3-v1",
        embeddingModel: "qwen3-embedding:0.6b",
        embeddingDimensions: 1024,
        retrievalLimit: 8,
        retrievalCandidateLimit: 32,
        minSimilarity: 0,
        exactMatchBoost: 0.08
      }
    });

    await retriever.retrieve("HSV result 16.06.2026");

    expect(repository.countIndexedChunks).toHaveBeenCalledWith(
      "rag-local-qwen3-v1",
      "qwen3-embedding:0.6b",
      1024
    );
    expect(repository.searchRelevantChunks).toHaveBeenCalledWith(
      [0.1, 0.2],
      expect.arrayContaining(["hsv", "16.06.2026"]),
      expect.objectContaining({
        embeddingModel: "qwen3-embedding:0.6b",
        embeddingDimensions: 1024
      })
    );
  });
});

describe("RagRetrievalRepository", () => {
  const options: RagRetrievalOptions = {
    indexVersion: "rag-local-qwen3-v1",
    embeddingModel: "qwen3-embedding:0.6b",
    embeddingDimensions: 1024,
    candidateLimit: 32,
    limit: 8,
    minSimilarity: 0,
    exactMatchBoost: 0.08
  };

  it("counts only indexed chunks with matching model and dimensions", async () => {
    const count = vi.fn(async () => 3);
    const repository = new RagRetrievalRepository({
      documentChunkEmbedding: { count }
    } as unknown as PrismaClient);

    await expect(
      repository.countIndexedChunks("rag-local-qwen3-v1", "qwen3-embedding:0.6b", 1024)
    ).resolves.toBe(3);

    expect(count).toHaveBeenCalledWith({
      where: {
        embeddingModel: "qwen3-embedding:0.6b",
        dimensions: 1024,
        chunk: {
          indexVersion: "rag-local-qwen3-v1",
          uploadRecord: {
            status: UploadStatus.STORED
          }
        }
      }
    });
  });

  it("filters vector search by model and dimensions", async () => {
    const queryRawUnsafe = vi.fn<(...args: unknown[]) => Promise<unknown[]>>(async () => []);
    const repository = new RagRetrievalRepository({
      $queryRawUnsafe: queryRawUnsafe
    } as unknown as PrismaClient);

    await repository.searchRelevantChunks([0.1, 0.2], [], options);

    const [sql, vector, indexVersion, model, dimensions, candidateLimit] =
      queryRawUnsafe.mock.calls[0]!;
    expect(String(sql)).toContain('AND e."dimensions" = $4');
    expect(vector).toBe("[0.1,0.2]");
    expect(indexVersion).toBe("rag-local-qwen3-v1");
    expect(model).toBe("qwen3-embedding:0.6b");
    expect(dimensions).toBe(1024);
    expect(candidateLimit).toBe(32);
  });
});
