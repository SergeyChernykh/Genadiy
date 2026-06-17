import type { TelegramUploadMetadata } from "../types.js";

export interface TelegramUserLike {
  id: number;
}

export interface TelegramChatLike {
  id: number;
}

export interface TelegramDocumentLike {
  file_id: string;
  file_unique_id?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramPhotoSizeLike {
  file_id: string;
  file_unique_id?: string;
  file_size?: number;
  width: number;
  height: number;
}

export interface TelegramMessageLike {
  message_id: number;
  from?: TelegramUserLike;
  chat: TelegramChatLike;
  document?: TelegramDocumentLike;
  photo?: TelegramPhotoSizeLike[];
}

export function extractTelegramUpload(
  message: TelegramMessageLike | undefined
): TelegramUploadMetadata | null {
  if (!message?.from) {
    return null;
  }

  if (message.document) {
    return withOptionalUploadFields(
      {
        userId: message.from.id,
        chatId: message.chat.id,
        messageId: message.message_id,
        fileId: message.document.file_id,
        fileKind: "document"
      },
      {
        fileUniqueId: message.document.file_unique_id,
        originalFileName: message.document.file_name,
        mimeType: message.document.mime_type,
        fileSizeBytes: message.document.file_size
      }
    );
  }

  const largestPhoto = selectLargestPhoto(message.photo);
  if (largestPhoto) {
    return withOptionalUploadFields(
      {
        userId: message.from.id,
        chatId: message.chat.id,
        messageId: message.message_id,
        fileId: largestPhoto.file_id,
        fileKind: "photo"
      },
      {
        fileUniqueId: largestPhoto.file_unique_id,
        originalFileName: `photo-${largestPhoto.file_unique_id ?? largestPhoto.file_id}.jpg`,
        fileSizeBytes: largestPhoto.file_size
      }
    );
  }

  return null;
}

export function isOverMaxFileSize(
  fileSizeBytes: number | undefined,
  maxFileBytes: number
): boolean {
  return typeof fileSizeBytes === "number" && fileSizeBytes > maxFileBytes;
}

function selectLargestPhoto(
  photos: TelegramPhotoSizeLike[] | undefined
): TelegramPhotoSizeLike | undefined {
  return photos?.reduce<TelegramPhotoSizeLike | undefined>((largest, current) => {
    if (!largest) {
      return current;
    }

    return photoWeight(current) > photoWeight(largest) ? current : largest;
  }, undefined);
}

function photoWeight(photo: TelegramPhotoSizeLike): number {
  return photo.file_size ?? photo.width * photo.height;
}

function withOptionalUploadFields(
  base: TelegramUploadMetadata,
  optional: {
    fileUniqueId?: string | undefined;
    originalFileName?: string | undefined;
    mimeType?: string | undefined;
    fileSizeBytes?: number | undefined;
  }
): TelegramUploadMetadata {
  const upload = { ...base };

  if (optional.fileUniqueId) {
    upload.fileUniqueId = optional.fileUniqueId;
  }

  if (optional.originalFileName) {
    upload.originalFileName = optional.originalFileName;
  }

  if (optional.mimeType) {
    upload.mimeType = optional.mimeType;
  }

  if (typeof optional.fileSizeBytes === "number") {
    upload.fileSizeBytes = optional.fileSizeBytes;
  }

  return upload;
}
