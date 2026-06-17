import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UploadStatus } from "../generated/prisma/client.js";
import type {
  FailedUploadRecordInput,
  StoredObject,
  TelegramUploadMetadata,
  UploadRecordRepository
} from "../types.js";

export function createPrismaClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export class PrismaUploadRecordRepository implements UploadRecordRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createStored(upload: TelegramUploadMetadata, storedObject: StoredObject): Promise<void> {
    await this.prisma.uploadRecord.create({
      data: {
        ...baseUploadData(upload),
        status: UploadStatus.STORED,
        bucket: storedObject.bucket,
        objectKey: storedObject.key,
        etag: storedObject.etag ?? null
      }
    });
  }

  async createFailed(input: FailedUploadRecordInput): Promise<void> {
    await this.prisma.uploadRecord.create({
      data: {
        ...baseUploadData(input.upload),
        status: UploadStatus.FAILED,
        bucket: input.bucket ?? null,
        objectKey: input.objectKey ?? null,
        etag: input.etag ?? null,
        failureMessage: input.failureMessage
      }
    });
  }
}

function baseUploadData(upload: TelegramUploadMetadata) {
  return {
    telegramUserId: BigInt(upload.userId),
    telegramChatId: BigInt(upload.chatId),
    telegramMessageId: upload.messageId,
    telegramFileId: upload.fileId,
    telegramFileUniqueId: upload.fileUniqueId ?? null,
    telegramFileType: upload.fileKind,
    originalFileName: upload.originalFileName ?? null,
    mimeType: upload.mimeType ?? null,
    fileSizeBytes:
      typeof upload.fileSizeBytes === "number" ? BigInt(upload.fileSizeBytes) : null
  };
}
