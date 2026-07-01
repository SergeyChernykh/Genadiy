import type { EmbeddingClient } from "../types.js";
import { chunkTextForEmbedding, type ChunkingOptions } from "./chunking.js";
import {
  buildContentBlocksFromPages,
  type BuiltContentBlock
} from "./contentBlocks.js";
import type {
  PersistedRagBlock,
  RagDocumentForIndexing,
  RagIndexRepository
} from "./persistence.js";

export interface RagIndexerOptions extends ChunkingOptions {
  indexVersion: string;
  embeddingProvider: string;
}

export interface RagIndexerDependencies {
  repository: RagIndexRepository;
  embeddings: EmbeddingClient;
  options: RagIndexerOptions;
  logger?: Pick<Console, "error" | "info"> | undefined;
}

export class RagIndexer {
  private readonly logger: Pick<Console, "error" | "info">;

  constructor(private readonly deps: RagIndexerDependencies) {
    this.logger = deps.logger ?? console;
  }

  async runOnce(workerId: string): Promise<boolean> {
    await this.deps.repository.ensurePendingJobs();
    const job = await this.deps.repository.claimNextJob(workerId);
    if (!job) {
      return false;
    }

    await this.indexJob(job);
    return true;
  }

  private async indexJob(job: RagDocumentForIndexing): Promise<void> {
    this.logger.info(
      `Claimed RAG indexing job ${job.jobId} for upload ${job.uploadRecordId}, attempt ${job.attempts}/${job.maxAttempts}.`
    );

    try {
      const blocks = await buildRagIndexBlocks(job, this.deps.embeddings, this.deps.options);
      await this.deps.repository.completeSucceeded(job, blocks, {
        indexVersion: this.deps.options.indexVersion,
        embeddingProvider: this.deps.options.embeddingProvider,
        blockCount: blocks.length,
        chunkCount: blocks.reduce((sum, block) => sum + block.chunks.length, 0),
        embeddingModel: await embeddingModelForBlocks(blocks, this.deps.embeddings),
        embeddingDimensions: await embeddingDimensionsForBlocks(blocks, this.deps.embeddings)
      });
      this.logger.info(`Completed RAG indexing job ${job.jobId} with ${blocks.length} block(s).`);
    } catch (error) {
      await this.deps.repository.completeFailed(job, error);
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed RAG indexing job ${job.jobId}: ${message}`);
    }
  }
}

export async function buildRagIndexBlocks(
  job: RagDocumentForIndexing,
  embeddings: EmbeddingClient,
  options: RagIndexerOptions
): Promise<PersistedRagBlock[]> {
  const contentBlocks = buildContentBlocksFromPages(job.pages);
  const chunkInputs = contentBlocks.flatMap((block) =>
    chunksForBlock(job, block, options).map((chunk) => ({
      block,
      chunk
    }))
  );

  if (chunkInputs.length === 0) {
    return [];
  }

  const embeddingResult = await embeddings.createEmbeddings({
    input: chunkInputs.map((input) => input.chunk.textForEmbedding)
  });
  const blocks = new Map<BuiltContentBlock, PersistedRagBlock>();

  chunkInputs.forEach((input, index) => {
    const embedding = embeddingResult.embeddings[index];
    if (!embedding) {
      throw new Error("Missing embedding for generated RAG chunk.");
    }

    const block = blocks.get(input.block) ?? {
      block: input.block,
      chunks: []
    };
    block.chunks.push({
      ...input.chunk,
      metadata: {
        ...input.chunk.metadata,
        embeddingModel: embeddingResult.model,
        embeddingProvider: options.embeddingProvider,
        embeddingDimensions: embeddingResult.dimensions
      },
      embedding
    });
    blocks.set(input.block, block);
  });

  return [...blocks.values()];
}

function chunksForBlock(
  job: RagDocumentForIndexing,
  block: BuiltContentBlock,
  options: RagIndexerOptions
) {
  const sourceTitle = job.uploadRecord.originalFileName ?? `upload-${job.uploadRecordId}`;
  const header = [
    `Filename: ${sourceTitle}`,
    `Page: ${block.pageNumber}`,
    `Block type: ${block.blockType}`,
    "Content:"
  ].join("\n");
  const text = `${header}\n${block.aiText}`;

  return chunkTextForEmbedding(text, options).map((chunk) => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      pageNumber: block.pageNumber,
      blockType: block.blockType,
      sourceFileName: sourceTitle
    }
  }));
}

async function embeddingModelForBlocks(
  blocks: readonly PersistedRagBlock[],
  embeddings: EmbeddingClient
): Promise<string> {
  const existing = blocks[0]?.chunks[0]?.metadata.embeddingModel;
  if (typeof existing === "string") {
    return existing;
  }

  const result = await embeddings.createEmbeddings({ input: [] });
  return result.model;
}

async function embeddingDimensionsForBlocks(
  blocks: readonly PersistedRagBlock[],
  embeddings: EmbeddingClient
): Promise<number> {
  const existing = blocks[0]?.chunks[0]?.metadata.embeddingDimensions;
  if (typeof existing === "number") {
    return existing;
  }

  const result = await embeddings.createEmbeddings({ input: [] });
  return result.dimensions;
}
