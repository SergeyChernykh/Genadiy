import fs from "node:fs/promises";
import path from "node:path";
import { ExtractionMethod } from "../../generated/prisma/enums.js";
import type {
  CommandRunner,
  DocumentProcessingResult,
  StoredUploadForProcessing
} from "../types.js";
import { getProcessingKind } from "../fileTypes.js";
import { ocrImageFile, readImageMetadata, type OcrOptions } from "./ocr.js";
import { processPdfFile, type PdfProcessingOptions } from "./pdf.js";

export interface DocumentProcessorOptions extends OcrOptions {
  maxPdfPages: number;
  maxFileBytes: number;
  toolVersions: Record<string, string>;
}

export class DocumentProcessor {
  constructor(
    private readonly runner: CommandRunner,
    private readonly options: DocumentProcessorOptions
  ) {}

  async process(
    upload: StoredUploadForProcessing,
    fileBuffer: Buffer,
    workDir: string
  ): Promise<DocumentProcessingResult | { skipped: true; reason: string }> {
    if (fileBuffer.byteLength > this.options.maxFileBytes) {
      throw new Error(
        `File has ${fileBuffer.byteLength} bytes, above configured limit ${this.options.maxFileBytes}.`
      );
    }

    const kind = getProcessingKind(upload);
    if (kind === "unsupported") {
      return {
        skipped: true,
        reason: `Unsupported file type: ${upload.mimeType ?? upload.originalFileName ?? "unknown"}`
      };
    }

    const filePath = path.join(workDir, safeWorkFileName(upload, kind));
    await fs.writeFile(filePath, fileBuffer);

    if (kind === "pdf") {
      return processPdfFile(this.runner, filePath, workDir, this.options as PdfProcessingOptions);
    }

    const page = await ocrImageFile(this.runner, filePath, 1, this.options, {
      ...readImageMetadata(fileBuffer),
      mimeType: upload.mimeType,
      byteSize: fileBuffer.byteLength
    });
    const rawText = page.rawText;

    return {
      method: ExtractionMethod.OCR,
      rawText,
      pageCount: 1,
      averageConfidence: page.confidence,
      pages: [page],
      metadata: {
        image: page.metadata ?? {},
        ocrLanguages: this.options.languages
      },
      toolVersions: this.options.toolVersions
    };
  }
}

function safeWorkFileName(upload: StoredUploadForProcessing, kind: "pdf" | "image"): string {
  const fallback = kind === "pdf" ? "document.pdf" : "image";
  return (upload.originalFileName ?? upload.objectKey ?? fallback)
    .replace(/\\/g, "/")
    .split("/")
    .at(-1)
    ?.replace(/[^A-Za-z0-9._-]+/g, "_") || fallback;
}
