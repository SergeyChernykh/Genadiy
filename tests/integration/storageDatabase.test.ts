import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config/env.js";
import {
  createPrismaClient,
  PrismaUploadRecordRepository
} from "../../src/persistence/uploadRecords.js";
import { createS3Client, S3ObjectStorage } from "../../src/storage/s3ObjectStorage.js";
import type { TelegramUploadMetadata } from "../../src/types.js";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "true";

describe.skipIf(!runIntegration)("local MinIO and PostgreSQL smoke", () => {
  it("stores an object and creates a PostgreSQL upload record", async () => {
    const config = loadConfig({
      BOT_TOKEN: "123:test",
      ALLOWED_TELEGRAM_USER_IDS: "123",
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://telegram:telegram@localhost:5432/telegram_documents",
      S3_ENDPOINT: process.env.S3_ENDPOINT ?? "http://localhost:9000",
      S3_REGION: process.env.S3_REGION ?? "us-east-1",
      S3_BUCKET: process.env.S3_BUCKET ?? "telegram-documents",
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? "minioadmin",
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin",
      S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE ?? "true",
      MAX_FILE_BYTES: "1024"
    });

    const prisma = createPrismaClient(config.databaseUrl);
    const storage = new S3ObjectStorage(
      createS3Client({
        endpoint: config.s3Endpoint,
        region: config.s3Region,
        accessKeyId: config.s3AccessKeyId,
        secretAccessKey: config.s3SecretAccessKey,
        forcePathStyle: config.s3ForcePathStyle
      }),
      config.s3Bucket
    );
    const records = new PrismaUploadRecordRepository(prisma);
    const objectKey = `telegram/integration/${Date.now()}-fixture.pdf`;
    const upload: TelegramUploadMetadata = {
      userId: 123,
      chatId: 456,
      messageId: 789,
      fileId: `integration-${Date.now()}`,
      fileKind: "document",
      originalFileName: "fixture.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 7
    };

    try {
      const stored = await storage.uploadBuffer({
        key: objectKey,
        body: Buffer.from("fixture"),
        contentType: "application/pdf",
        contentLength: 7
      });
      await records.createStored(upload, stored);

      const row = await prisma.uploadRecord.findFirstOrThrow({
        where: { objectKey }
      });

      expect(row.status).toBe("STORED");
      expect(row.bucket).toBe(config.s3Bucket);
      expect(row.telegramFileId).toBe(upload.fileId);
    } finally {
      await prisma.uploadRecord.deleteMany({ where: { objectKey } });
      await prisma.$disconnect();
    }
  });
});
