import { describe, expect, it, vi } from "vitest";
import { buildRagIndexBlocks, RagIndexer } from "../../src/rag/indexer.js";
import type { EmbeddingClient } from "../../src/types.js";
import type {
  RagDocumentForIndexing,
  RagIndexRepository
} from "../../src/rag/persistence.js";

const job: RagDocumentForIndexing = {
  jobId: "job-1",
  uploadRecordId: "upload-1",
  documentTextId: "document-text-1",
  attempts: 1,
  maxAttempts: 3,
  uploadRecord: {
    originalFileName: "analysis.pdf",
    mimeType: "application/pdf"
  },
  pages: [
    {
      id: "page-1",
      pageNumber: 1,
      rawText: "Virus      Result\nHSV        negative"
    }
  ]
};

describe("RagIndexer", () => {
  it("builds blocks, chunks, and embeddings", async () => {
    const embeddings = createEmbeddingClient();

    const blocks = await buildRagIndexBlocks(job, embeddings, {
      indexVersion: "rag-v1",
      embeddingProvider: "openai",
      maxChars: 1000,
      overlapChars: 100
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.block.blockType).toBe("TABLE");
    expect(blocks[0]?.chunks).toHaveLength(1);
    expect(blocks[0]?.chunks[0]?.embedding).toEqual([0.1, 0.2]);
    expect(blocks[0]?.chunks[0]?.metadata).toMatchObject({
      embeddingProvider: "openai",
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 2
    });
    expect(blocks[0]?.chunks[0]?.textForEmbedding).toContain("Filename: analysis.pdf");
    expect(blocks[0]?.chunks[0]?.textForEmbedding).toContain("| HSV | negative |");
  });

  it("marks jobs failed without throwing from runOnce", async () => {
    const repository = {
      ensurePendingJobs: vi.fn(async () => 0),
      claimNextJob: vi.fn(async () => job),
      completeSucceeded: vi.fn(async () => {}),
      completeFailed: vi.fn(async () => {})
    };
    const embeddings: EmbeddingClient = {
      createEmbeddings: vi.fn(async () => {
        throw new Error("OpenAI unavailable");
      })
    };
    const indexer = new RagIndexer({
      repository: repository as unknown as RagIndexRepository,
      embeddings,
      options: {
        indexVersion: "rag-v1",
        embeddingProvider: "openai",
        maxChars: 1000,
        overlapChars: 100
      },
      logger: { info: vi.fn(), error: vi.fn() }
    });

    await expect(indexer.runOnce("worker-1")).resolves.toBe(true);
    expect(repository.completeFailed).toHaveBeenCalledWith(job, expect.any(Error));
    expect(repository.completeSucceeded).not.toHaveBeenCalled();
  });
});

function createEmbeddingClient(): EmbeddingClient {
  return {
    createEmbeddings: vi.fn(async ({ input }) => ({
      embeddings: input.map(() => [0.1, 0.2]),
      model: "text-embedding-3-small",
      dimensions: 2
    }))
  };
}
