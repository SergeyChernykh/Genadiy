import { randomUUID } from "node:crypto";
import {
  ExtractionMethod,
  ProcessingJobStatus,
  UploadStatus
} from "../../generated/prisma/enums.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { getTextMetrics } from "../textNormalization.js";
import type {
  ClaimedProcessingJob,
  DocumentProcessingResult,
  PageExtractionResult
} from "../types.js";

export interface ProcessingJobRepositoryOptions {
  maxAttempts: number;
  retryDelayMs: number;
  jobDiscoveryBatchSize?: number | undefined;
}

export class ProcessingJobRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly options: ProcessingJobRepositoryOptions
  ) {}

  async ensurePendingJobs(): Promise<number> {
    const uploads = await this.prisma.uploadRecord.findMany({
      where: {
        status: UploadStatus.STORED,
        bucket: { not: null },
        objectKey: { not: null },
        processingJobs: { none: {} }
      },
      select: { id: true },
      take: this.options.jobDiscoveryBatchSize ?? 100
    });

    if (uploads.length === 0) {
      return 0;
    }

    const result = await this.prisma.documentProcessingJob.createMany({
      data: uploads.map((upload) => ({
        id: randomUUID(),
        uploadRecordId: upload.id,
        status: ProcessingJobStatus.PENDING,
        maxAttempts: this.options.maxAttempts
      })),
      skipDuplicates: true
    });

    return result.count;
  }

  async claimNextJob(workerId: string): Promise<ClaimedProcessingJob | null> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      UPDATE "DocumentProcessingJob"
      SET
        "status" = 'RUNNING',
        "attempts" = "attempts" + 1,
        "claimedBy" = $1,
        "lockedAt" = NOW(),
        "startedAt" = NOW(),
        "completedAt" = NULL,
        "errorMessage" = NULL,
        "skipReason" = NULL,
        "updatedAt" = NOW()
      WHERE "id" = (
        SELECT "id"
        FROM "DocumentProcessingJob"
        WHERE
          "nextRunAt" <= NOW()
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
      workerId
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    const job = await this.prisma.documentProcessingJob.findUniqueOrThrow({
      where: { id: row.id },
      include: { uploadRecord: true }
    });

    return {
      id: job.id,
      uploadRecordId: job.uploadRecordId,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      uploadRecord: {
        id: job.uploadRecord.id,
        telegramFileType: job.uploadRecord.telegramFileType,
        originalFileName: job.uploadRecord.originalFileName,
        mimeType: job.uploadRecord.mimeType,
        fileSizeBytes: job.uploadRecord.fileSizeBytes,
        bucket: job.uploadRecord.bucket,
        objectKey: job.uploadRecord.objectKey
      }
    };
  }

  async completeSucceeded(
    job: ClaimedProcessingJob,
    result: DocumentProcessingResult,
    durationMs: number
  ): Promise<void> {
    const metrics = getTextMetrics(result.normalizedText);
    await this.prisma.$transaction(async (tx) => {
      const run = await tx.documentExtractionRun.create({
        data: {
          uploadRecordId: job.uploadRecordId,
          processingJobId: job.id,
          status: ProcessingJobStatus.SUCCEEDED,
          method: result.method,
          ocrLanguages: metadataString(result.metadata.ocrLanguages),
          pageCount: result.pageCount,
          durationMs,
          averageConfidence: result.averageConfidence ?? null,
          metadataJson: jsonInput(result.metadata),
          toolVersionsJson: jsonInput(result.toolVersions),
          completedAt: new Date()
        }
      });

      await tx.documentText.create({
        data: {
          uploadRecordId: job.uploadRecordId,
          extractionRunId: run.id,
          rawText: result.rawText,
          normalizedText: result.normalizedText,
          characterCount: metrics.characterCount,
          wordCount: metrics.wordCount
        }
      });

      await tx.documentPageText.createMany({
        data: result.pages.map((page) => pageTextData(job.uploadRecordId, run.id, page))
      });

      await tx.documentProcessingJob.update({
        where: { id: job.id },
        data: {
          status: ProcessingJobStatus.SUCCEEDED,
          completedAt: new Date(),
          errorMessage: null,
          skipReason: null,
          metadataJson: jsonInput({
            pageCount: result.pageCount,
            method: result.method,
            durationMs
          })
        }
      });
    });
  }

  async completeSkipped(
    job: ClaimedProcessingJob,
    reason: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    await this.prisma.documentProcessingJob.update({
      where: { id: job.id },
      data: {
        status: ProcessingJobStatus.SKIPPED,
        completedAt: new Date(),
        skipReason: reason,
        errorMessage: null,
        metadataJson: jsonInput(metadata)
      }
    });
  }

  async completeFailed(job: ClaimedProcessingJob, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await this.prisma.documentProcessingJob.update({
      where: { id: job.id },
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

function pageTextData(uploadRecordId: string, extractionRunId: string, page: PageExtractionResult) {
  return {
    uploadRecordId,
    extractionRunId,
    pageNumber: page.pageNumber,
    method: page.method,
    rawText: page.rawText,
    normalizedText: page.normalizedText,
    confidence: page.confidence ?? null,
    metadataJson: jsonInput(page.metadata ?? {})
  };
}

function metadataString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function jsonInput(value: Record<string, unknown>): never {
  return value as never;
}

export function methodFromPages(pages: PageExtractionResult[]): ExtractionMethod {
  if (pages.every((page) => page.method === ExtractionMethod.TEXT_LAYER)) {
    return ExtractionMethod.TEXT_LAYER;
  }

  if (pages.every((page) => page.method === ExtractionMethod.OCR)) {
    return ExtractionMethod.OCR;
  }

  return ExtractionMethod.MIXED;
}
