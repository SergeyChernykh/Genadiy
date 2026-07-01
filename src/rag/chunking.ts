import { contentHash } from "./contentBlocks.js";

export interface ChunkingOptions {
  maxChars: number;
  overlapChars: number;
}

export interface BuiltChunk {
  chunkIndex: number;
  textForEmbedding: string;
  contentHash: string;
  characterCount: number;
  metadata: Record<string, unknown>;
}

export function chunkTextForEmbedding(
  text: string,
  options: ChunkingOptions
): BuiltChunk[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  if (options.overlapChars >= options.maxChars) {
    throw new Error("chunk overlap must be smaller than chunk size");
  }

  if (trimmed.length <= options.maxChars) {
    return [chunk(0, trimmed, false)];
  }

  const chunks: BuiltChunk[] = [];
  let start = 0;
  while (start < trimmed.length) {
    const end = Math.min(trimmed.length, chooseChunkEnd(trimmed, start, options.maxChars));
    const textForEmbedding = trimmed.slice(start, end).trim();
    if (textForEmbedding) {
      chunks.push(chunk(chunks.length, textForEmbedding, true));
    }

    if (end >= trimmed.length) {
      break;
    }

    start = Math.max(0, end - options.overlapChars);
  }

  return chunks;
}

function chunk(chunkIndex: number, textForEmbedding: string, split: boolean): BuiltChunk {
  return {
    chunkIndex,
    textForEmbedding,
    contentHash: contentHash(textForEmbedding),
    characterCount: textForEmbedding.length,
    metadata: { split }
  };
}

function chooseChunkEnd(text: string, start: number, maxChars: number): number {
  const hardEnd = Math.min(text.length, start + maxChars);
  if (hardEnd >= text.length) {
    return hardEnd;
  }

  const window = text.slice(start, hardEnd);
  const paragraphBreak = window.lastIndexOf("\n\n");
  if (paragraphBreak > maxChars * 0.55) {
    return start + paragraphBreak;
  }

  const lineBreak = window.lastIndexOf("\n");
  if (lineBreak > maxChars * 0.65) {
    return start + lineBreak;
  }

  const sentenceBreak = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("? "),
    window.lastIndexOf("! ")
  );
  if (sentenceBreak > maxChars * 0.65) {
    return start + sentenceBreak + 1;
  }

  const space = window.lastIndexOf(" ");
  if (space > maxChars * 0.65) {
    return start + space;
  }

  return hardEnd;
}
