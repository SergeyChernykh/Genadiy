export interface TextMetrics {
  characterCount: number;
  wordCount: number;
}

function simplifyTextForUsability(rawText: string): string {
  return rawText
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/([A-Za-zА-Яа-яЁё])-\n([A-Za-zА-Яа-яЁё])/g, "$1$2")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getTextMetrics(text: string): TextMetrics {
  const words = text.match(/[\p{L}\p{N}]+/gu) ?? [];
  return {
    characterCount: Array.from(text).length,
    wordCount: words.length
  };
}

export function hasUsableText(text: string): boolean {
  return getTextMetrics(simplifyTextForUsability(text)).characterCount >= 3;
}
