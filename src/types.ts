export type TelegramFileKind = "document" | "photo";

export interface TelegramUploadMetadata {
  userId: number;
  chatId: number;
  messageId: number;
  fileId: string;
  fileKind: TelegramFileKind;
  fileUniqueId?: string | undefined;
  originalFileName?: string | undefined;
  mimeType?: string | undefined;
  fileSizeBytes?: number | undefined;
}

export interface StoredObject {
  bucket: string;
  key: string;
  etag?: string | undefined;
}

export interface ObjectUploadInput {
  key: string;
  body: Buffer;
  contentType?: string | undefined;
  contentLength?: number | undefined;
}

export interface ObjectStorage {
  uploadBuffer(input: ObjectUploadInput): Promise<StoredObject>;
}

export interface ObjectDownloadInput {
  bucket: string;
  key: string;
}

export interface ObjectDownloader {
  downloadBuffer(input: ObjectDownloadInput): Promise<Buffer>;
}

export interface FailedUploadRecordInput {
  upload: TelegramUploadMetadata;
  failureMessage: string;
  bucket?: string | undefined;
  objectKey?: string | undefined;
  etag?: string | undefined;
}

export interface UploadRecordRepository {
  createStored(upload: TelegramUploadMetadata, storedObject: StoredObject): Promise<void>;
  createFailed(input: FailedUploadRecordInput): Promise<void>;
}
