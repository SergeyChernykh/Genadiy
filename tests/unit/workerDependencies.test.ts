import { describe, expect, it, vi } from "vitest";
import { validateWorkerDependencies } from "../../src/worker/system/dependencies.js";
import type { CommandRunner } from "../../src/worker/types.js";

describe("worker dependency checks", () => {
  it("validates required binaries and OCR languages", async () => {
    const runner = createRunner();

    const result = await validateWorkerDependencies(runner, {
      ocrLanguageCodes: ["eng", "rus"]
    });

    expect(result.availableLanguages).toEqual(["eng", "rus"]);
    expect(result.toolVersions.tesseract).toContain("tesseract");
  });

  it("fails when an OCR language pack is missing", async () => {
    const runner = createRunner({ languages: "eng\n" });

    await expect(
      validateWorkerDependencies(runner, { ocrLanguageCodes: ["eng", "rus"] })
    ).rejects.toThrow("Missing Tesseract language data");
  });
});

function createRunner(options: { languages?: string } = {}): CommandRunner {
  return {
    run: vi.fn(async (command: string, args: string[]) => {
      if (command === "which") {
        return { stdout: `/usr/bin/${args[0]}\n`, stderr: "" };
      }

      if (command === "tesseract" && args[0] === "--list-langs") {
        return { stdout: `List of available languages\n${options.languages ?? "eng\nrus\n"}`, stderr: "" };
      }

      return { stdout: `${command} version 1.0\n`, stderr: "" };
    })
  };
}
