import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExtractionMethod } from "../../src/generated/prisma/enums.js";
import { DocumentProcessor } from "../../src/worker/processing/documentProcessor.js";
import { averageConfidenceFromTsv } from "../../src/worker/processing/ocr.js";
import type { CommandRunner, StoredUploadForProcessing } from "../../src/worker/types.js";

let workDir: string;

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), "worker-test-"));
});

afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
});

describe("document processing", () => {
  it("extracts text-layer PDF pages before OCR", async () => {
    const runner = createRunner({
      pdfTextByPage: new Map([[1, "Hello PDF"]])
    });
    const processor = createProcessor(runner);

    const result = await processor.process(pdfUpload(), Buffer.from("%PDF"), workDir);

    expect("skipped" in result).toBe(false);
    if ("skipped" in result) return;
    expect(result.method).toBe(ExtractionMethod.TEXT_LAYER);
    expect(result.normalizedText).toBe("Hello PDF");
    expect(result.pages[0]?.method).toBe(ExtractionMethod.TEXT_LAYER);
  });

  it("renders and OCRs scanned PDF pages", async () => {
    const runner = createRunner({
      pdfTextByPage: new Map([[1, "   "]]),
      ocrText: "Привет scan"
    });
    const processor = createProcessor(runner);

    const result = await processor.process(pdfUpload(), Buffer.from("%PDF"), workDir);

    expect("skipped" in result).toBe(false);
    if ("skipped" in result) return;
    expect(result.method).toBe(ExtractionMethod.OCR);
    expect(result.normalizedText).toBe("Привет scan");
    expect(runner.run).toHaveBeenCalledWith(
      "pdftoppm",
      expect.arrayContaining(["-png"]),
      expect.any(Object)
    );
  });

  it("OCRs image uploads with eng+rus", async () => {
    const runner = createRunner({ ocrText: "Hello фото" });
    const processor = createProcessor(runner);

    const result = await processor.process(imageUpload(), Buffer.from("not-real-image"), workDir);

    expect("skipped" in result).toBe(false);
    if ("skipped" in result) return;
    expect(result.method).toBe(ExtractionMethod.OCR);
    expect(result.metadata.ocrLanguages).toBe("eng+rus");
  });

  it("skips unsupported uploads", async () => {
    const processor = createProcessor(createRunner());

    const result = await processor.process(
      {
        ...pdfUpload(),
        mimeType: "application/zip",
        originalFileName: "archive.zip"
      },
      Buffer.from("zip"),
      workDir
    );

    expect(result).toMatchObject({ skipped: true });
  });

  it("calculates average OCR confidence from TSV output", () => {
    expect(
      averageConfidenceFromTsv("level\tpage\tblock\tpar\tline\tword\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t0\t0\t1\t1\t80\tHello\n5\t1\t1\t1\t1\t2\t0\t0\t1\t1\t90\tWorld\n")
    ).toBe(85);
  });
});

function createProcessor(runner: CommandRunner): DocumentProcessor {
  return new DocumentProcessor(runner, {
    languages: "eng+rus",
    timeoutMs: 1000,
    maxPdfPages: 5,
    maxFileBytes: 1024,
    toolVersions: { tesseract: "tesseract 5", pdfinfo: "pdfinfo 1" }
  });
}

function createRunner(options: {
  pdfTextByPage?: Map<number, string>;
  ocrText?: string;
} = {}): CommandRunner {
  return {
    run: vi.fn(async (command: string, args: string[]) => {
      if (command === "pdfinfo") {
        return { stdout: "Pages: 1\nTitle: Test\nEncrypted: no\n", stderr: "" };
      }

      if (command === "pdftotext") {
        const page = Number(args[args.indexOf("-f") + 1]);
        return { stdout: options.pdfTextByPage?.get(page) ?? "Hello PDF", stderr: "" };
      }

      if (command === "pdftoppm") {
        return { stdout: "", stderr: "" };
      }

      if (command === "tesseract" && args.includes("tsv")) {
        return {
          stdout:
            "level\tpage\tblock\tpar\tline\tword\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t0\t0\t1\t1\t70\ttext\n",
          stderr: ""
        };
      }

      if (command === "tesseract") {
        return { stdout: options.ocrText ?? "OCR text", stderr: "" };
      }

      return { stdout: "", stderr: "" };
    })
  };
}

function pdfUpload(): StoredUploadForProcessing {
  return {
    id: "upload-1",
    telegramFileType: "document",
    originalFileName: "doc.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: 10n,
    bucket: "telegram-documents",
    objectKey: "doc.pdf"
  };
}

function imageUpload(): StoredUploadForProcessing {
  return {
    id: "upload-2",
    telegramFileType: "photo",
    originalFileName: "photo.jpg",
    mimeType: "image/jpeg",
    fileSizeBytes: 10n,
    bucket: "telegram-documents",
    objectKey: "photo.jpg"
  };
}
