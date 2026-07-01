import { randomUUID } from "node:crypto";
import {
  ProcessingJobStatus,
  RagContentBlockType,
  UploadStatus,
  type PrismaClient
} from "../generated/prisma/client.js";
import type {
  AnswerSourceDocument,
  RagContentBlockKind,
  RetrievedDocumentChunk
} from "../types.js";
import type { BuiltChunk } from "./chunking.js";
import type { BuiltContentBlock } from "./contentBlocks.js";

export interface RagIndexRepositoryOptions {
  indexVersion: string;
  maxAttempts: number;
  retryDelayMs: number;
  jobDiscoveryBatchSize?: number | undefined;
}

export interface RagDocumentForIndexing {
  jobId: string;
  uploadRecordId: string;
  documentTextId: string;
  attempts: number;
  maxAttempts: number;
  uploadRecord: {
    originalFileName?: string | undefined;
    mimeType?: string | undefined;
  };
  pages: Array<{
    id: string;
    pageNumber: number;
    rawText: string;
  }>;
}

export interface PersistedRagBlock {
  block: BuiltContentBlock;
  chunks: Array<BuiltChunk & { embedding: readonly number[] }>;
}

export interface RagRetrievalOptions {
  indexVersion: string;
  embeddingModel: string;
  embeddingDimensions: number;
  candidateLimit: number;
  limit: number;
  minSimilarity: number;
  exactMatchBoost: number;
}

export class RagIndexRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly options: RagIndexRepositoryOptions
  ) {}

  async ensurePendingJobs(): Promise<number> {
    const documentTexts = await this.prisma.documentText.findMany({
      where: {
        rawText: { not: "" },
        extractionRun: { status: ProcessingJobStatus.SUCCEEDED },
        uploadRecord: { status: UploadStatus.STORED },
        ragIndexJobs: {
          none: {
            indexVersion: this.options.indexVersion
          }
        }
      },
      select: {
        id: true,
        uploadRecordId: true
      },
      take: this.options.jobDiscoveryBatchSize ?? 100
    });

    if (documentTexts.length === 0) {
      return 0;
    }

    const result = await this.prisma.documentRagIndexJob.createMany({
      data: documentTexts.map((documentText) => ({
        id: randomUUID(),
        uploadRecordId: documentText.uploadRecordId,
        documentTextId: documentText.id,
        indexVersion: this.options.indexVersion,
        maxAttempts: this.options.maxAttempts
      })),
      skipDuplicates: true
    });

    return result.count;
  }

  async claimNextJob(workerId: string): Promise<RagDocumentForIndexing | null> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      UPDATE "DocumentRagIndexJob"
      SET
        "status" = 'RUNNING',
        "attempts" = "attempts" + 1,
        "claimedBy" = $1,
        "lockedAt" = NOW(),
        "startedAt" = NOW(),
        "completedAt" = NULL,
        "errorMessage" = NULL,
        "updatedAt" = NOW()
      WHERE "id" = (
        SELECT "id"
        FROM "DocumentRagIndexJob"
        WHERE
          "indexVersion" = $2
          AND "nextRunAt" <= NOW()
          AND (
            "status" = 'PENDING'
            OR ("status" = 'FAILED' AND "attempts" < "maxAttempts")
          )
        ORDER BY "nextRunAt" ASC, "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING "id"
      `,
      workerId,
      this.options.indexVersion
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    const job = await this.prisma.documentRagIndexJob.findUniqueOrThrow({
      where: { id: row.id },
      include: {
        uploadRecord: {
          select: {
            originalFileName: true,
            mimeType: true
          }
        },
        documentText: {
          include: {
            uploadRecord: true
          }
        }
      }
    });
    const pages = await this.prisma.documentPageText.findMany({
      where: { uploadRecordId: job.uploadRecordId },
      select: {
        id: true,
        pageNumber: true,
        rawText: true
      },
      orderBy: { pageNumber: "asc" }
    });

    return {
      jobId: job.id,
      uploadRecordId: job.uploadRecordId,
      documentTextId: job.documentTextId,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      uploadRecord: {
        originalFileName: job.uploadRecord.originalFileName ?? undefined,
        mimeType: job.uploadRecord.mimeType ?? undefined
      },
      pages:
        pages.length > 0
          ? pages
          : [
              {
                id: job.documentText.id,
                pageNumber: 1,
                rawText: job.documentText.rawText
              }
            ]
    };
  }

  async completeSucceeded(
    job: RagDocumentForIndexing,
    blocks: readonly PersistedRagBlock[],
    metadata: Record<string, unknown>
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.documentContentBlock.deleteMany({
        where: {
          documentTextId: job.documentTextId,
          indexVersion: this.options.indexVersion
        }
      });

      let blockIndex = 0;
      for (const blockWithChunks of blocks) {
        const createdBlock = await tx.documentContentBlock.create({
          data: {
            uploadRecordId: job.uploadRecordId,
            documentTextId: job.documentTextId,
            pageTextId:
              blockWithChunks.block.pageTextId === job.documentTextId
                ? null
                : blockWithChunks.block.pageTextId,
            indexVersion: this.options.indexVersion,
            blockType:
              blockWithChunks.block.blockType === "TABLE"
                ? RagContentBlockType.TABLE
                : RagContentBlockType.TEXT,
            blockIndex,
            pageNumber: blockWithChunks.block.pageNumber,
            rawText: blockWithChunks.block.rawText,
            aiText: blockWithChunks.block.aiText,
            contentHash: blockWithChunks.block.contentHash,
            characterCount: blockWithChunks.block.characterCount,
            wordCount: blockWithChunks.block.wordCount,
            metadataJson: jsonInput(blockWithChunks.block.metadata)
          }
        });

        for (const chunk of blockWithChunks.chunks) {
          const createdChunk = await tx.documentChunk.create({
            data: {
              uploadRecordId: job.uploadRecordId,
              contentBlockId: createdBlock.id,
              indexVersion: this.options.indexVersion,
              chunkIndex: chunk.chunkIndex,
              textForEmbedding: chunk.textForEmbedding,
              contentHash: chunk.contentHash,
              characterCount: chunk.characterCount,
              metadataJson: jsonInput(chunk.metadata)
            }
          });

          await tx.$executeRawUnsafe(
            `
            INSERT INTO "DocumentChunkEmbedding"
              ("id", "chunkId", "embeddingModel", "dimensions", "embedding", "createdAt")
            VALUES ($1, $2, $3, $4, $5::vector, NOW())
            `,
            randomUUID(),
            createdChunk.id,
            String(metadata.embeddingModel ?? ""),
            Number(metadata.embeddingDimensions ?? 0),
            vectorLiteral(chunk.embedding)
          );
        }

        blockIndex += 1;
      }

      await tx.documentRagIndexJob.update({
        where: { id: job.jobId },
        data: {
          status: ProcessingJobStatus.SUCCEEDED,
          completedAt: new Date(),
          errorMessage: null,
          metadataJson: jsonInput(metadata)
        }
      });
    });
  }

  async completeFailed(job: RagDocumentForIndexing, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await this.prisma.documentRagIndexJob.update({
      where: { id: job.jobId },
      data: {
        status: ProcessingJobStatus.FAILED,
        completedAt: new Date(),
        errorMessage,
        nextRunAt: new Date(Date.now() + this.options.retryDelayMs),
        metadataJson: jsonInput({
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          retryable: job.attempts < job.maxAttempts
        })
      }
    });
  }
}

export class RagRetrievalRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async countIndexedChunks(
    indexVersion: string,
    embeddingModel: string,
    embeddingDimensions: number
  ): Promise<number> {
    return this.prisma.documentChunkEmbedding.count({
      where: {
        embeddingModel,
        dimensions: embeddingDimensions,
        chunk: {
          indexVersion,
          uploadRecord: {
            status: UploadStatus.STORED
          }
        }
      }
    });
  }

  async searchRelevantChunks(
    queryEmbedding: readonly number[],
    exactTerms: readonly string[],
    options: RagRetrievalOptions
  ): Promise<RetrievedDocumentChunk[]> {
    const rows = await this.prisma.$queryRawUnsafe<RetrievedChunkRow[]>(
      `
      SELECT
        c."id" AS "chunkId",
        c."uploadRecordId" AS "uploadRecordId",
        u."bucket" AS "bucket",
        u."objectKey" AS "objectKey",
        u."originalFileName" AS "originalFileName",
        u."mimeType" AS "mimeType",
        u."telegramChatId"::text AS "telegramChatId",
        u."telegramMessageId" AS "telegramMessageId",
        b."pageNumber" AS "pageNumber",
        b."blockType"::text AS "blockType",
        c."textForEmbedding" AS "text",
        1 - (e."embedding" <=> $1::vector) AS "similarity"
      FROM "DocumentChunkEmbedding" e
      JOIN "DocumentChunk" c ON c."id" = e."chunkId"
      JOIN "DocumentContentBlock" b ON b."id" = c."contentBlockId"
      JOIN "UploadRecord" u ON u."id" = c."uploadRecordId"
      WHERE
        c."indexVersion" = $2
        AND e."embeddingModel" = $3
        AND e."dimensions" = $4
        AND u."status" = 'STORED'
        AND u."bucket" IS NOT NULL
        AND u."objectKey" IS NOT NULL
      ORDER BY e."embedding" <=> $1::vector
      LIMIT $5
      `,
      vectorLiteral(queryEmbedding),
      options.indexVersion,
      options.embeddingModel,
      options.embeddingDimensions,
      options.candidateLimit
    );

    return rows
      .map((row) => mapRetrievedChunkRow(row, exactTerms, options.exactMatchBoost))
      .filter((row) => row.similarity >= options.minSimilarity || row.exactMatchScore > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, options.limit);
  }
}

export function sourcesFromRetrievedChunks(
  chunks: readonly RetrievedDocumentChunk[]
): AnswerSourceDocument[] {
  const seen = new Set<string>();
  const sources: AnswerSourceDocument[] = [];

  for (const chunk of chunks) {
    if (seen.has(chunk.uploadRecordId)) {
      continue;
    }

    seen.add(chunk.uploadRecordId);
    sources.push({
      uploadRecordId: chunk.uploadRecordId,
      bucket: chunk.bucket,
      objectKey: chunk.objectKey,
      originalFileName: chunk.originalFileName,
      mimeType: chunk.mimeType,
      telegramChatId: chunk.telegramChatId,
      telegramMessageId: chunk.telegramMessageId
    });
  }

  return sources;
}

interface RetrievedChunkRow {
  chunkId: string;
  uploadRecordId: string;
  bucket: string;
  objectKey: string;
  originalFileName: string | null;
  mimeType: string | null;
  telegramChatId: string;
  telegramMessageId: number;
  pageNumber: number | null;
  blockType: string;
  text: string;
  similarity: number;
}

function mapRetrievedChunkRow(
  row: RetrievedChunkRow,
  exactTerms: readonly string[],
  exactMatchBoost: number
): RetrievedDocumentChunk {
  const exactMatchScore = exactMatchScoreForText(row.text, exactTerms) * exactMatchBoost;

  return {
    chunkId: row.chunkId,
    uploadRecordId: row.uploadRecordId,
    bucket: row.bucket,
    objectKey: row.objectKey,
    originalFileName: row.originalFileName ?? undefined,
    mimeType: row.mimeType ?? undefined,
    telegramChatId: row.telegramChatId,
    telegramMessageId: row.telegramMessageId,
    pageNumber: row.pageNumber ?? undefined,
    blockType: row.blockType === "TABLE" ? "TABLE" : "TEXT",
    text: row.text,
    similarity: Number(row.similarity),
    exactMatchScore,
    score: Number(row.similarity) + exactMatchScore
  };
}

function exactMatchScoreForText(text: string, terms: readonly string[]): number {
  if (terms.length === 0) {
    return 0;
  }

  const normalized = text.toLowerCase();
  const matches = terms.filter((term) => normalized.includes(term.toLowerCase())).length;
  return matches / terms.length;
}

function vectorLiteral(values: readonly number[]): string {
  return `[${values.map((value) => formatVectorNumber(value)).join(",")}]`;
}

function formatVectorNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error("Embedding vector contains non-finite values.");
  }

  return String(value);
}

function jsonInput(value: Record<string, unknown>): never {
  return value as never;
}
