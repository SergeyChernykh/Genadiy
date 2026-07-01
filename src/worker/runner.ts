import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { WorkerConfig } from "../config/env.js";
import type { ObjectDownloader } from "../types.js";
import { DocumentProcessor } from "./processing/documentProcessor.js";
import type { ProcessingJobRepository } from "./persistence/processingJobs.js";
import type { ClaimedProcessingJob } from "./types.js";

export interface DocumentWorkerDependencies {
  repository: ProcessingJobRepository;
  ragIndexer?: { runOnce(workerId: string): Promise<boolean> } | undefined;
  downloader: ObjectDownloader;
  processor: DocumentProcessor;
  config: WorkerConfig;
  workerId?: string | undefined;
  logger?: Pick<Console, "error" | "info" | "warn"> | undefined;
}

export class DocumentWorker {
  private readonly workerId: string;
  private readonly logger: Pick<Console, "error" | "info" | "warn">;
  private stopping = false;

  constructor(private readonly deps: DocumentWorkerDependencies) {
    this.workerId = deps.workerId ?? `worker-${process.pid}-${randomUUID()}`;
    this.logger = deps.logger ?? console;
  }

  stop(): void {
    this.stopping = true;
  }

  async runOnce(): Promise<boolean> {
    await this.deps.repository.ensurePendingJobs();
    const job = await this.deps.repository.claimNextJob(this.workerId);
    if (!job) {
      return this.deps.ragIndexer ? this.deps.ragIndexer.runOnce(this.workerId) : false;
    }

    await this.processClaimedJob(job);
    return true;
  }

  async runForever(): Promise<void> {
    this.logger.info(`Document processor worker ${this.workerId} started.`);
    while (!this.stopping) {
      const processed = await this.runOnce();
      if (!processed) {
        await wait(this.deps.config.pollIntervalMs);
      }
    }
  }

  private async processClaimedJob(job: ClaimedProcessingJob): Promise<void> {
    this.logger.info(
      `Claimed processing job ${job.id} for upload ${job.uploadRecordId}, attempt ${job.attempts}/${job.maxAttempts}.`
    );

    const bucket = job.uploadRecord.bucket;
    const key = job.uploadRecord.objectKey;
    if (!bucket || !key) {
      await this.deps.repository.completeSkipped(job, "Stored upload is missing bucket or object key.", {
        uploadRecordId: job.uploadRecordId
      });
      this.logger.warn(`Skipped processing job ${job.id}; missing object reference.`);
      return;
    }

    const startedAt = Date.now();
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "document-worker-"));
    try {
      const fileBuffer = await this.deps.downloader.downloadBuffer({ bucket, key });
      const result = await this.deps.processor.process(job.uploadRecord, fileBuffer, workDir);
      if ("skipped" in result) {
        await this.deps.repository.completeSkipped(job, result.reason, {
          uploadRecordId: job.uploadRecordId,
          mimeType: job.uploadRecord.mimeType,
          telegramFileType: job.uploadRecord.telegramFileType
        });
        this.logger.info(`Skipped processing job ${job.id}: ${result.reason}`);
        return;
      }

      await this.deps.repository.completeSucceeded(job, result, Date.now() - startedAt);
      this.logger.info(`Completed processing job ${job.id} with ${result.pageCount} page(s).`);
    } catch (error) {
      await this.deps.repository.completeFailed(job, error);
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed processing job ${job.id}: ${message}`);
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
