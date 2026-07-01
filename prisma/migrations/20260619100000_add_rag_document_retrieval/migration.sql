CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "RagContentBlockType" AS ENUM ('TEXT', 'TABLE');

CREATE TABLE "DocumentRagIndexJob" (
  "id" TEXT NOT NULL,
  "uploadRecordId" TEXT NOT NULL,
  "documentTextId" TEXT NOT NULL,
  "status" "ProcessingJobStatus" NOT NULL DEFAULT 'PENDING',
  "indexVersion" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "claimedBy" TEXT,
  "lockedAt" TIMESTAMP(3),
  "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentRagIndexJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentContentBlock" (
  "id" TEXT NOT NULL,
  "uploadRecordId" TEXT NOT NULL,
  "documentTextId" TEXT NOT NULL,
  "pageTextId" TEXT,
  "indexVersion" TEXT NOT NULL,
  "blockType" "RagContentBlockType" NOT NULL,
  "blockIndex" INTEGER NOT NULL,
  "pageNumber" INTEGER,
  "rawText" TEXT NOT NULL,
  "aiText" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "characterCount" INTEGER NOT NULL,
  "wordCount" INTEGER NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentContentBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentChunk" (
  "id" TEXT NOT NULL,
  "uploadRecordId" TEXT NOT NULL,
  "contentBlockId" TEXT NOT NULL,
  "indexVersion" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "textForEmbedding" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "characterCount" INTEGER NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentChunkEmbedding" (
  "id" TEXT NOT NULL,
  "chunkId" TEXT NOT NULL,
  "embeddingModel" TEXT NOT NULL,
  "dimensions" INTEGER NOT NULL,
  "embedding" vector(1536) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentChunkEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentRagIndexJob_documentTextId_indexVersion_key"
  ON "DocumentRagIndexJob"("documentTextId", "indexVersion");
CREATE INDEX "DocumentRagIndexJob_status_nextRunAt_idx"
  ON "DocumentRagIndexJob"("status", "nextRunAt");
CREATE INDEX "DocumentRagIndexJob_uploadRecordId_idx"
  ON "DocumentRagIndexJob"("uploadRecordId");
CREATE INDEX "DocumentRagIndexJob_indexVersion_idx"
  ON "DocumentRagIndexJob"("indexVersion");

CREATE UNIQUE INDEX "DocumentContentBlock_documentTextId_indexVersion_blockIndex_key"
  ON "DocumentContentBlock"("documentTextId", "indexVersion", "blockIndex");
CREATE INDEX "DocumentContentBlock_uploadRecordId_idx"
  ON "DocumentContentBlock"("uploadRecordId");
CREATE INDEX "DocumentContentBlock_pageTextId_idx"
  ON "DocumentContentBlock"("pageTextId");
CREATE INDEX "DocumentContentBlock_blockType_idx"
  ON "DocumentContentBlock"("blockType");
CREATE INDEX "DocumentContentBlock_contentHash_idx"
  ON "DocumentContentBlock"("contentHash");

CREATE UNIQUE INDEX "DocumentChunk_contentBlockId_chunkIndex_key"
  ON "DocumentChunk"("contentBlockId", "chunkIndex");
CREATE INDEX "DocumentChunk_uploadRecordId_idx"
  ON "DocumentChunk"("uploadRecordId");
CREATE INDEX "DocumentChunk_indexVersion_idx"
  ON "DocumentChunk"("indexVersion");
CREATE INDEX "DocumentChunk_contentHash_idx"
  ON "DocumentChunk"("contentHash");

CREATE UNIQUE INDEX "DocumentChunkEmbedding_chunkId_key"
  ON "DocumentChunkEmbedding"("chunkId");
CREATE INDEX "DocumentChunkEmbedding_embeddingModel_idx"
  ON "DocumentChunkEmbedding"("embeddingModel");

ALTER TABLE "DocumentRagIndexJob"
  ADD CONSTRAINT "DocumentRagIndexJob_uploadRecordId_fkey"
  FOREIGN KEY ("uploadRecordId") REFERENCES "UploadRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentRagIndexJob"
  ADD CONSTRAINT "DocumentRagIndexJob_documentTextId_fkey"
  FOREIGN KEY ("documentTextId") REFERENCES "DocumentText"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentContentBlock"
  ADD CONSTRAINT "DocumentContentBlock_uploadRecordId_fkey"
  FOREIGN KEY ("uploadRecordId") REFERENCES "UploadRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentContentBlock"
  ADD CONSTRAINT "DocumentContentBlock_documentTextId_fkey"
  FOREIGN KEY ("documentTextId") REFERENCES "DocumentText"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentContentBlock"
  ADD CONSTRAINT "DocumentContentBlock_pageTextId_fkey"
  FOREIGN KEY ("pageTextId") REFERENCES "DocumentPageText"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentChunk"
  ADD CONSTRAINT "DocumentChunk_uploadRecordId_fkey"
  FOREIGN KEY ("uploadRecordId") REFERENCES "UploadRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentChunk"
  ADD CONSTRAINT "DocumentChunk_contentBlockId_fkey"
  FOREIGN KEY ("contentBlockId") REFERENCES "DocumentContentBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentChunkEmbedding"
  ADD CONSTRAINT "DocumentChunkEmbedding_chunkId_fkey"
  FOREIGN KEY ("chunkId") REFERENCES "DocumentChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
