import { describe, expect, it } from "vitest";
import { getProcessingKind } from "../../src/worker/fileTypes.js";
import {
  getTextMetrics,
  hasUsableText,
  normalizeExtractedText
} from "../../src/worker/textNormalization.js";

describe("worker file routing", () => {
  it("routes PDF uploads by MIME type or extension", () => {
    expect(
      getProcessingKind({
        telegramFileType: "document",
        mimeType: "application/pdf",
        originalFileName: null,
        objectKey: "telegram/file"
      })
    ).toBe("pdf");

    expect(
      getProcessingKind({
        telegramFileType: "document",
        mimeType: null,
        originalFileName: "scan.PDF",
        objectKey: null
      })
    ).toBe("pdf");
  });

  it("routes photos and images", () => {
    expect(
      getProcessingKind({
        telegramFileType: "photo",
        mimeType: null,
        originalFileName: null,
        objectKey: "photo"
      })
    ).toBe("image");

    expect(
      getProcessingKind({
        telegramFileType: "document",
        mimeType: "image/png",
        originalFileName: null,
        objectKey: "image"
      })
    ).toBe("image");
  });

  it("skips unsupported uploads", () => {
    expect(
      getProcessingKind({
        telegramFileType: "document",
        mimeType: "application/zip",
        originalFileName: "archive.zip",
        objectKey: "archive.zip"
      })
    ).toBe("unsupported");
  });
});

describe("text normalization", () => {
  it("normalizes conservative OCR/extraction noise", () => {
    expect(normalizeExtractedText(" docu-\r\nment   text\n\n\n  line ")).toBe(
      "document text\n\nline"
    );
  });

  it("calculates text metrics and usability", () => {
    expect(getTextMetrics("Hello мир 123")).toEqual({ characterCount: 13, wordCount: 3 });
    expect(hasUsableText("  \n")).toBe(false);
    expect(hasUsableText("abc")).toBe(true);
  });
});
