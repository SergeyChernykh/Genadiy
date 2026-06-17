CREATE TYPE "UploadStatus" AS ENUM ('STORED', 'FAILED');

CREATE TABLE "UploadRecord" (
    "id" TEXT NOT NULL,
    "status" "UploadStatus" NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "telegramChatId" BIGINT NOT NULL,
    "telegramMessageId" INTEGER NOT NULL,
    "telegramFileId" TEXT NOT NULL,
    "telegramFileUniqueId" TEXT,
    "telegramFileType" TEXT NOT NULL,
    "originalFileName" TEXT,
    "mimeType" TEXT,
    "fileSizeBytes" BIGINT,
    "bucket" TEXT,
    "objectKey" TEXT,
    "etag" TEXT,
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UploadRecord_telegramUserId_idx" ON "UploadRecord"("telegramUserId");
CREATE INDEX "UploadRecord_telegramChatId_telegramMessageId_idx" ON "UploadRecord"("telegramChatId", "telegramMessageId");
CREATE INDEX "UploadRecord_status_idx" ON "UploadRecord"("status");
