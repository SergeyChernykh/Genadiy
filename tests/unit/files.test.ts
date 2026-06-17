import { describe, expect, it } from "vitest";
import {
  extractTelegramUpload,
  isOverMaxFileSize,
  type TelegramMessageLike
} from "../../src/telegram/files.js";

describe("Telegram file extraction", () => {
  it("maps document metadata", () => {
    const message: TelegramMessageLike = {
      message_id: 10,
      from: { id: 123 },
      chat: { id: 456 },
      document: {
        file_id: "doc-file",
        file_unique_id: "doc-unique",
        file_name: "contract.docx",
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        file_size: 4096
      }
    };

    expect(extractTelegramUpload(message)).toMatchObject({
      userId: 123,
      chatId: 456,
      messageId: 10,
      fileId: "doc-file",
      fileKind: "document",
      originalFileName: "contract.docx",
      fileSizeBytes: 4096
    });
  });

  it("chooses the largest photo variant", () => {
    const message: TelegramMessageLike = {
      message_id: 11,
      from: { id: 123 },
      chat: { id: 456 },
      photo: [
        { file_id: "small", width: 100, height: 100, file_size: 100 },
        { file_id: "large", file_unique_id: "photo-unique", width: 1000, height: 1000 }
      ]
    };

    expect(extractTelegramUpload(message)).toMatchObject({
      fileId: "large",
      fileKind: "photo",
      originalFileName: "photo-photo-unique.jpg"
    });
  });

  it("detects oversize metadata only when Telegram provides size", () => {
    expect(isOverMaxFileSize(101, 100)).toBe(true);
    expect(isOverMaxFileSize(100, 100)).toBe(false);
    expect(isOverMaxFileSize(undefined, 100)).toBe(false);
  });
});
