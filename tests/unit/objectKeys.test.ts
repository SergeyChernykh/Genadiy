import { describe, expect, it } from "vitest";
import {
  buildTelegramObjectKey,
  sanitizeFileName
} from "../../src/storage/objectKeys.js";

describe("object key helpers", () => {
  it("sanitizes unsafe file names", () => {
    expect(sanitizeFileName("../Quarterly Report (final).pdf")).toBe(
      "Quarterly_Report_final.pdf"
    );
  });

  it("falls back to a sanitized Telegram file ID", () => {
    expect(
      buildTelegramObjectKey({
        chatId: 100,
        messageId: 200,
        fileId: "file/id:abc",
        date: new Date("2026-06-17T10:20:30.000Z")
      })
    ).toBe("telegram/2026/06/17/100/200/id_abc");
  });

  it("uses a deterministic traceable key shape", () => {
    expect(
      buildTelegramObjectKey({
        chatId: -100123,
        messageId: 88,
        fileId: "fallback",
        fileName: "invoice.png",
        date: new Date("2026-01-02T03:04:05.000Z")
      })
    ).toBe("telegram/2026/01/02/-100123/88/invoice.png");
  });
});
