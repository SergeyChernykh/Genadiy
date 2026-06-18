CREATE TYPE "ProcessingJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');
CREATE TYPE "ExtractionMethod" AS ENUM ('TEXT_LAYER', 'OCR', 'MIXED');

CREATE TABLE "DocumentProcessingJob" (
    "id" TEXT NOT NULL,
    "uploadRecordId" TEXT NOT NULL,
    "status" "ProcessingJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "claimedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "skipReason" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentProcessingJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentExtractionRun" (
    "id" TEXT NOT NULL,
    "uploadRecordId" TEXT NOT NULL,
    "processingJobId" TEXT,
    "status" "ProcessingJobStatus" NOT NULL,
    "method" "ExtractionMethod",
    "ocrLanguages" TEXT,
    "pageCount" INTEGER,
    "durationMs" INTEGER,
    "averageConfidence" DOUBLE PRECISION,
    "metadataJson" JSONB,
    "toolVersionsJson" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentExtractionRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentText" (
    "id" TEXT NOT NULL,
    "uploadRecordId" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "characterCount" INTEGER NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentText_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentPageText" (
    "id" TEXT NOT NULL,
    "uploadRecordId" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "method" "ExtractionMethod" NOT NULL,
    "rawText" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentPageText_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentProcessingJob_uploadRecordId_key" ON "DocumentProcessingJob"("uploadRecordId");
CREATE INDEX "DocumentProcessingJob_status_nextRunAt_idx" ON "DocumentProcessingJob"("status", "nextRunAt");
CREATE INDEX "DocumentProcessingJob_lockedAt_idx" ON "DocumentProcessingJob"("lockedAt");

CREATE INDEX "DocumentExtractionRun_uploadRecordId_idx" ON "DocumentExtractionRun"("uploadRecordId");
CREATE INDEX "DocumentExtractionRun_status_idx" ON "DocumentExtractionRun"("status");

CREATE UNIQUE INDEX "DocumentText_extractionRunId_key" ON "DocumentText"("extractionRunId");
CREATE INDEX "DocumentText_uploadRecordId_idx" ON "DocumentText"("uploadRecordId");

CREATE UNIQUE INDEX "DocumentPageText_extractionRunId_pageNumber_key" ON "DocumentPageText"("extractionRunId", "pageNumber");
CREATE INDEX "DocumentPageText_uploadRecordId_idx" ON "DocumentPageText"("uploadRecordId");
CREATE INDEX "DocumentPageText_method_idx" ON "DocumentPageText"("method");

ALTER TABLE "DocumentProcessingJob" ADD CONSTRAINT "DocumentProcessingJob_uploadRecordId_fkey" FOREIGN KEY ("uploadRecordId") REFERENCES "UploadRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentExtractionRun" ADD CONSTRAINT "DocumentExtractionRun_uploadRecordId_fkey" FOREIGN KEY ("uploadRecordId") REFERENCES "UploadRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentExtractionRun" ADD CONSTRAINT "DocumentExtractionRun_processingJobId_fkey" FOREIGN KEY ("processingJobId") REFERENCES "DocumentProcessingJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentText" ADD CONSTRAINT "DocumentText_uploadRecordId_fkey" FOREIGN KEY ("uploadRecordId") REFERENCES "UploadRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentText" ADD CONSTRAINT "DocumentText_extractionRunId_fkey" FOREIGN KEY ("extractionRunId") REFERENCES "DocumentExtractionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentPageText" ADD CONSTRAINT "DocumentPageText_uploadRecordId_fkey" FOREIGN KEY ("uploadRecordId") REFERENCES "UploadRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentPageText" ADD CONSTRAINT "DocumentPageText_extractionRunId_fkey" FOREIGN KEY ("extractionRunId") REFERENCES "DocumentExtractionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
