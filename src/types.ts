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

export interface ProcessedDocumentText {
  uploadRecordId: string;
  telegramChatId: string;
  telegramMessageId: number;
  originalFileName?: string | undefined;
  mimeType?: string | undefined;
  rawText: string;
  characterCount: number;
  wordCount: number;
  createdAt: Date;
}

export interface DocumentTextRepository {
  findProcessedTextsByTelegramUserId(telegramUserId: number): Promise<ProcessedDocumentText[]>;
}

export type DeepSeekChatRole = "system" | "user" | "assistant";

export interface DeepSeekChatMessage {
  role: DeepSeekChatRole;
  content: string;
}

export interface DeepSeekChatCompletionInput {
  messages: readonly DeepSeekChatMessage[];
  userId: string;
}

export interface DeepSeekChatClient {
  createChatCompletion(input: DeepSeekChatCompletionInput): Promise<string>;
}

export interface EmbeddingInput {
  input: readonly string[];
}

export interface EmbeddingResult {
  embeddings: readonly number[][];
  model: string;
  dimensions: number;
}

export interface EmbeddingClient {
  createEmbeddings(input: EmbeddingInput): Promise<EmbeddingResult>;
}

export type RagContentBlockKind = "TEXT" | "TABLE";

export interface RetrievedDocumentChunk {
  chunkId: string;
  uploadRecordId: string;
  bucket: string;
  objectKey: string;
  originalFileName?: string | undefined;
  mimeType?: string | undefined;
  telegramChatId: string;
  telegramMessageId: number;
  pageNumber?: number | undefined;
  blockType: RagContentBlockKind;
  text: string;
  similarity: number;
  exactMatchScore: number;
  score: number;
}

export interface AnswerSourceDocument {
  uploadRecordId: string;
  bucket: string;
  objectKey: string;
  originalFileName?: string | undefined;
  mimeType?: string | undefined;
  telegramChatId: string;
  telegramMessageId: number;
}
