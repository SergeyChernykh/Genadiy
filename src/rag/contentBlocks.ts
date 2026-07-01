import { createHash } from "node:crypto";
import type { RagContentBlockKind } from "../types.js";
import { getTextMetrics } from "../worker/textNormalization.js";

export interface PageTextForBlocks {
  id: string;
  pageNumber: number;
  rawText: string;
}

export interface BuiltContentBlock {
  pageTextId: string;
  pageNumber: number;
  blockType: RagContentBlockKind;
  rawText: string;
  aiText: string;
  contentHash: string;
  characterCount: number;
  wordCount: number;
  metadata: Record<string, unknown>;
}

export function buildContentBlocksFromPages(
  pages: readonly PageTextForBlocks[]
): BuiltContentBlock[] {
  const blocks: BuiltContentBlock[] = [];

  for (const page of pages) {
    for (const segment of splitPageIntoSegments(page.rawText)) {
      const block = buildContentBlock(page, segment);
      if (block) {
        blocks.push(block);
      }
    }
  }

  return blocks;
}

export function isTableLikeText(text: string): boolean {
  const rows = tableRows(text);
  return rows.length >= 2 && rows.filter((row) => row.cells.length >= 2).length >= 2;
}

export function tableTextToMarkdown(text: string): string {
  const rows = tableRows(text).filter((row) => row.cells.length > 0);
  if (rows.length === 0) {
    return text.trim();
  }

  const maxCells = Math.max(...rows.map((row) => row.cells.length));
  return rows
    .map((row) => {
      const cells = [...row.cells];
      while (cells.length < maxCells) {
        cells.push("");
      }
      return `| ${cells.map(escapeMarkdownTableCell).join(" | ")} |`;
    })
    .join("\n");
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function buildContentBlock(
  page: PageTextForBlocks,
  segment: string
): BuiltContentBlock | null {
  const rawText = segment.trim();
  if (!rawText) {
    return null;
  }

  const blockType: RagContentBlockKind = isTableLikeText(rawText) ? "TABLE" : "TEXT";
  const aiText = blockType === "TABLE" ? tableTextToMarkdown(rawText) : rawText;
  const metrics = getTextMetrics(aiText);

  return {
    pageTextId: page.id,
    pageNumber: page.pageNumber,
    blockType,
    rawText,
    aiText,
    contentHash: contentHash(`${blockType}\n${aiText}`),
    characterCount: metrics.characterCount,
    wordCount: metrics.wordCount,
    metadata: {
      source: "pageText",
      tableLike: blockType === "TABLE"
    }
  };
}

function splitPageIntoSegments(rawText: string): string[] {
  const normalized = rawText.replace(/\r\n/g, "\n");
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (paragraphs.length > 0) {
    return paragraphs;
  }

  return [normalized.trim()].filter(Boolean);
}

function tableRows(text: string): Array<{ cells: string[] }> {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      cells: line
        .split(/\t+|\s{2,}/)
        .map((cell) => cell.trim())
        .filter(Boolean)
    }));
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}
