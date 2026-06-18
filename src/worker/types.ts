import type { ExtractionMethod } from "../generated/prisma/enums.js";

export type ProcessingKind = "pdf" | "image" | "unsupported";

export interface StoredUploadForProcessing {
  id: string;
  telegramFileType: string;
  originalFileName: string | null;
  mimeType: string | null;
  fileSizeBytes: bigint | null;
  bucket: string | null;
  objectKey: string | null;
}

export interface ClaimedProcessingJob {
  id: string;
  uploadRecordId: string;
  attempts: number;
  maxAttempts: number;
  uploadRecord: StoredUploadForProcessing;
}

export interface PageExtractionResult {
  pageNumber: number;
  method: ExtractionMethod;
  rawText: string;
  normalizedText: string;
  confidence?: number | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface DocumentProcessingResult {
  method: ExtractionMethod;
  rawText: string;
  normalizedText: string;
  pageCount: number;
  averageConfidence?: number | undefined;
  pages: PageExtractionResult[];
  metadata: Record<string, unknown>;
  toolVersions: Record<string, string>;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export interface CommandRunner {
  run(command: string, args: string[], options?: CommandRunOptions): Promise<CommandResult>;
}

export interface CommandRunOptions {
  timeoutMs?: number | undefined;
  cwd?: string | undefined;
}
