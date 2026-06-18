import { imageSize } from "image-size";
import { ExtractionMethod } from "../../generated/prisma/enums.js";
import { normalizeExtractedText } from "../textNormalization.js";
import type { CommandRunner, PageExtractionResult } from "../types.js";

export interface OcrOptions {
  languages: string;
  timeoutMs: number;
}

export async function ocrImageFile(
  runner: CommandRunner,
  imagePath: string,
  pageNumber: number,
  options: OcrOptions,
  metadata: Record<string, unknown> = {}
): Promise<PageExtractionResult> {
  const textResult = await runner.run(
    "tesseract",
    [imagePath, "stdout", "-l", options.languages],
    { timeoutMs: options.timeoutMs }
  );
  const confidence = await readAverageConfidence(runner, imagePath, options);
  const rawText = textResult.stdout;

  return {
    pageNumber,
    method: ExtractionMethod.OCR,
    rawText,
    normalizedText: normalizeExtractedText(rawText),
    confidence,
    metadata
  };
}

export function readImageMetadata(buffer: Buffer): Record<string, unknown> {
  try {
    const dimensions = imageSize(buffer);
    return {
      width: dimensions.width,
      height: dimensions.height,
      imageType: dimensions.type
    };
  } catch {
    return {};
  }
}

async function readAverageConfidence(
  runner: CommandRunner,
  imagePath: string,
  options: OcrOptions
): Promise<number | undefined> {
  try {
    const result = await runner.run(
      "tesseract",
      [imagePath, "stdout", "-l", options.languages, "tsv"],
      { timeoutMs: options.timeoutMs }
    );
    return averageConfidenceFromTsv(result.stdout);
  } catch {
    return undefined;
  }
}

export function averageConfidenceFromTsv(tsv: string): number | undefined {
  const confidences = tsv
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split("\t")[10])
    .map((value) => (value ? Number(value) : Number.NaN))
    .filter((value) => Number.isFinite(value) && value >= 0);

  if (confidences.length === 0) {
    return undefined;
  }

  return confidences.reduce((sum, value) => sum + value, 0) / confidences.length;
}
