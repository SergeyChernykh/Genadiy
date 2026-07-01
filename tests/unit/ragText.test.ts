import { describe, expect, it } from "vitest";
import {
  buildContentBlocksFromPages,
  isTableLikeText,
  tableTextToMarkdown
} from "../../src/rag/contentBlocks.js";
import { chunkTextForEmbedding } from "../../src/rag/chunking.js";
import { exactTermsFromQuestion } from "../../src/rag/retrieval.js";

describe("RAG content blocks", () => {
  it("detects table-like text and renders markdown rows", () => {
    const text = "Virus        Result\nCMV          negative\nHSV          positive";

    expect(isTableLikeText(text)).toBe(true);
    expect(tableTextToMarkdown(text)).toContain("| Virus | Result |");
    expect(tableTextToMarkdown(text)).toContain("| HSV | positive |");
  });

  it("builds table and text blocks from page raw text", () => {
    const blocks = buildContentBlocksFromPages([
      {
        id: "page-1",
        pageNumber: 1,
        rawText: "Intro paragraph.\n\nAnalyte      Value\nPCR          not detected"
      }
    ]);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ blockType: "TEXT", pageNumber: 1 });
    expect(blocks[1]).toMatchObject({ blockType: "TABLE", pageNumber: 1 });
    expect(blocks[1]?.aiText).toContain("| PCR | not detected |");
  });
});

describe("RAG chunking", () => {
  it("splits long text with overlap", () => {
    const chunks = chunkTextForEmbedding("a ".repeat(200), {
      maxChars: 100,
      overlapChars: 20
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.textForEmbedding.length <= 100)).toBe(true);
    expect(chunks[0]?.chunkIndex).toBe(0);
    expect(chunks[1]?.chunkIndex).toBe(1);
  });
});

describe("RAG exact terms", () => {
  it("keeps dates, numbers, and useful words", () => {
    expect(exactTermsFromQuestion("Были ли вирусы 16.06.2026 HSV?")).toEqual(
      expect.arrayContaining(["вирусы", "16.06.2026", "hsv"])
    );
  });
});
