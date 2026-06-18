import { describe, expect, it, vi } from "vitest";
import { ExtractionMethod, ProcessingJobStatus, UploadStatus } from "../../src/generated/prisma/enums.js";
import { ProcessingJobRepository } from "../../src/worker/persistence/processingJobs.js";
import type { ClaimedProcessingJob, DocumentProcessingResult } from "../../src/worker/types.js";

describe("ProcessingJobRepository", () => {
  it("creates pending jobs for stored uploads", async () => {
    const prisma = {
      uploadRecord: {
        findMany: vi.fn(async () => [{ id: "upload-1" }, { id: "upload-2" }])
      },
      documentProcessingJob: {
        createMany: vi.fn(async () => ({ count: 2 }))
      }
    };
    const repo = new ProcessingJobRepository(prisma as never, {
      maxAttempts: 3,
      retryDelayMs: 1000
    });

    await expect(repo.ensurePendingJobs()).resolves.toBe(2);
    expect(prisma.uploadRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: UploadStatus.STORED,
          processingJobs: { none: {} }
        })
      })
    );
    expect(prisma.documentProcessingJob.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
  });

  it("claims the next retryable job", async () => {
    const prisma = {
      $queryRawUnsafe: vi.fn(async () => [{ id: "job-1" }]),
      documentProcessingJob: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: "job-1",
          uploadRecordId: "upload-1",
          attempts: 1,
          maxAttempts: 3,
          uploadRecord: uploadRecord()
        }))
      }
    };
    const repo = new ProcessingJobRepository(prisma as never, {
      maxAttempts: 3,
      retryDelayMs: 1000
    });

    const job = await repo.claimNextJob("worker-1");

    const rawQueryCall = prisma.$queryRawUnsafe.mock.calls[0] as unknown[] | undefined;
    expect(job?.id).toBe("job-1");
    expect(rawQueryCall?.[0]).toContain("FOR UPDATE SKIP LOCKED");
    expect(rawQueryCall?.[1]).toBe("worker-1");
  });

  it("persists successful extraction output", async () => {
    const tx = {
      documentExtractionRun: {
        create: vi.fn(async () => ({ id: "run-1" }))
      },
      documentText: {
        create: vi.fn(async () => ({}))
      },
      documentPageText: {
        createMany: vi.fn(async () => ({ count: 1 }))
      },
      documentProcessingJob: {
        update: vi.fn(async () => ({}))
      }
    };
    const prisma = {
      $transaction: vi.fn(async (fn) => fn(tx))
    };
    const repo = new ProcessingJobRepository(prisma as never, {
      maxAttempts: 3,
      retryDelayMs: 1000
    });

    await repo.completeSucceeded(claimedJob(), processingResult(), 123);

    expect(tx.documentExtractionRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ProcessingJobStatus.SUCCEEDED,
          method: ExtractionMethod.TEXT_LAYER,
          durationMs: 123
        })
      })
    );
    expect(tx.documentText.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rawText: "Hello world",
          wordCount: 2
        })
      })
    );
    const documentTextCreateCalls = tx.documentText.create.mock.calls as unknown as Array<
      [{ data: Record<string, unknown> }]
    >;
    const pageTextCreateManyCalls = tx.documentPageText.createMany.mock.calls as unknown as Array<
      [{ data: Array<Record<string, unknown>> }]
    >;
    const documentTextCreateArgs = documentTextCreateCalls[0]?.[0];
    const pageTextCreateArgs = pageTextCreateManyCalls[0]?.[0];
    expect(documentTextCreateArgs?.data).not.toHaveProperty("normalizedText");
    expect(pageTextCreateArgs?.data[0]).not.toHaveProperty("normalizedText");
    expect(tx.documentPageText.createMany).toHaveBeenCalledOnce();
  });

  it("records skipped and failed jobs", async () => {
    const prisma = {
      documentProcessingJob: {
        update: vi.fn(async () => ({}))
      }
    };
    const repo = new ProcessingJobRepository(prisma as never, {
      maxAttempts: 3,
      retryDelayMs: 1000
    });

    await repo.completeSkipped(claimedJob(), "Unsupported");
    await repo.completeFailed(claimedJob(), new Error("OCR failed"));

    expect(prisma.documentProcessingJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ProcessingJobStatus.SKIPPED,
          skipReason: "Unsupported"
        })
      })
    );
    expect(prisma.documentProcessingJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ProcessingJobStatus.FAILED,
          errorMessage: "OCR failed"
        })
      })
    );
  });
});

function uploadRecord() {
  return {
    id: "upload-1",
    status: UploadStatus.STORED,
    telegramUserId: 123n,
    telegramChatId: 456n,
    telegramMessageId: 1,
    telegramFileId: "file",
    telegramFileUniqueId: null,
    telegramFileType: "document",
    originalFileName: "doc.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: 10n,
    bucket: "telegram-documents",
    objectKey: "doc.pdf",
    etag: null,
    failureMessage: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function claimedJob(): ClaimedProcessingJob {
  return {
    id: "job-1",
    uploadRecordId: "upload-1",
    attempts: 1,
    maxAttempts: 3,
    uploadRecord: uploadRecord()
  };
}

function processingResult(): DocumentProcessingResult {
  return {
    method: ExtractionMethod.TEXT_LAYER,
    rawText: "Hello world",
    pageCount: 1,
    pages: [
      {
        pageNumber: 1,
        method: ExtractionMethod.TEXT_LAYER,
        rawText: "Hello world",
        metadata: { source: "pdftotext" }
      }
    ],
    metadata: { ocrLanguages: "eng+rus" },
    toolVersions: { pdftotext: "1.0" }
  };
}
