import path from "node:path";
import { ExtractionMethod } from "../../generated/prisma/enums.js";
import { hasUsableText } from "../textNormalization.js";
import type {
  CommandRunner,
  DocumentProcessingResult,
  PageExtractionResult
} from "../types.js";
import { ocrImageFile, type OcrOptions } from "./ocr.js";

export interface PdfProcessingOptions extends OcrOptions {
  maxPdfPages: number;
  toolVersions: Record<string, string>;
}

export async function processPdfFile(
  runner: CommandRunner,
  pdfPath: string,
  workDir: string,
  options: PdfProcessingOptions
): Promise<DocumentProcessingResult> {
  const pdfInfo = await readPdfInfo(runner, pdfPath, options.timeoutMs);
  const pageCount = Number(pdfInfo.Pages ?? 0);

  if (!Number.isSafeInteger(pageCount) || pageCount <= 0) {
    throw new Error("PDF page count is unavailable or invalid.");
  }

  if (pageCount > options.maxPdfPages) {
    throw new Error(`PDF has ${pageCount} pages, above configured limit ${options.maxPdfPages}.`);
  }

  const pages: PageExtractionResult[] = [];
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const textLayer = await extractPdfPageText(runner, pdfPath, pageNumber, options.timeoutMs);
    if (hasUsableText(textLayer)) {
      pages.push({
        pageNumber,
        method: ExtractionMethod.TEXT_LAYER,
        rawText: textLayer,
        metadata: { source: "pdftotext" }
      });
      continue;
    }

    const imagePath = await renderPdfPage(runner, pdfPath, workDir, pageNumber, options.timeoutMs);
    pages.push(
      await ocrImageFile(runner, imagePath, pageNumber, options, {
        source: "pdftoppm",
        fallbackFrom: "TEXT_LAYER"
      })
    );
  }

  return buildDocumentResult(pages, {
    pdfInfo,
    toolVersions: options.toolVersions,
    ocrLanguages: options.languages
  });
}

export async function readPdfInfo(
  runner: CommandRunner,
  pdfPath: string,
  timeoutMs: number
): Promise<Record<string, string>> {
  const result = await runner.run("pdfinfo", [pdfPath], { timeoutMs });
  return parsePdfInfo(result.stdout);
}

export function parsePdfInfo(output: string): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const line of output.split(/\r?\n/)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key && value) {
      metadata[key] = value;
    }
  }

  return metadata;
}

async function extractPdfPageText(
  runner: CommandRunner,
  pdfPath: string,
  pageNumber: number,
  timeoutMs: number
): Promise<string> {
  const result = await runner.run(
    "pdftotext",
    ["-layout", "-f", String(pageNumber), "-l", String(pageNumber), pdfPath, "-"],
    { timeoutMs }
  );
  return result.stdout;
}

async function renderPdfPage(
  runner: CommandRunner,
  pdfPath: string,
  workDir: string,
  pageNumber: number,
  timeoutMs: number
): Promise<string> {
  const prefix = path.join(workDir, `page-${pageNumber}`);
  await runner.run(
    "pdftoppm",
    ["-f", String(pageNumber), "-l", String(pageNumber), "-png", "-singlefile", pdfPath, prefix],
    { timeoutMs }
  );
  return `${prefix}.png`;
}

function buildDocumentResult(
  pages: PageExtractionResult[],
  metadata: {
    pdfInfo: Record<string, string>;
    toolVersions: Record<string, string>;
    ocrLanguages: string;
  }
): DocumentProcessingResult {
  const rawText = pages.map((page) => page.rawText).join("\n\n");
  const method = pages.every((page) => page.method === ExtractionMethod.TEXT_LAYER)
    ? ExtractionMethod.TEXT_LAYER
    : pages.every((page) => page.method === ExtractionMethod.OCR)
      ? ExtractionMethod.OCR
      : ExtractionMethod.MIXED;
  const confidences = pages
    .map((page) => page.confidence)
    .filter((value): value is number => typeof value === "number");

  return {
    method,
    rawText,
    pageCount: pages.length,
    averageConfidence:
      confidences.length > 0
        ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
        : undefined,
    pages,
    metadata: {
      pdfInfo: metadata.pdfInfo,
      ocrLanguages: metadata.ocrLanguages
    },
    toolVersions: metadata.toolVersions
  };
}
