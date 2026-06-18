import type { WorkerConfig } from "../../config/env.js";
import type { CommandRunner } from "../types.js";

const REQUIRED_BINARIES = ["pdfinfo", "pdftotext", "pdftoppm", "tesseract"] as const;

export interface DependencyCheckResult {
  toolVersions: Record<string, string>;
  availableLanguages: readonly string[];
}

export async function validateWorkerDependencies(
  runner: CommandRunner,
  config: Pick<WorkerConfig, "ocrLanguageCodes">
): Promise<DependencyCheckResult> {
  const toolVersions: Record<string, string> = {};

  for (const binary of REQUIRED_BINARIES) {
    await assertBinaryAvailable(runner, binary);
    toolVersions[binary] = await readVersion(runner, binary);
  }

  const availableLanguages = await readTesseractLanguages(runner);
  const missingLanguages = config.ocrLanguageCodes.filter(
    (language) => !availableLanguages.includes(language)
  );

  if (missingLanguages.length > 0) {
    throw new Error(
      `Missing Tesseract language data: ${missingLanguages.join(", ")}. Install required language packs.`
    );
  }

  return { toolVersions, availableLanguages };
}

async function assertBinaryAvailable(runner: CommandRunner, binary: string): Promise<void> {
  try {
    await runner.run("which", [binary], { timeoutMs: 5000 });
  } catch (error) {
    throw new Error(`Required binary '${binary}' is not available in PATH.`, { cause: error });
  }
}

async function readVersion(runner: CommandRunner, binary: string): Promise<string> {
  const args = binary === "tesseract" ? ["--version"] : ["-v"];
  const result = await runner.run(binary, args, { timeoutMs: 5000 });
  return firstLine(result.stdout) || firstLine(result.stderr) || "unknown";
}

async function readTesseractLanguages(runner: CommandRunner): Promise<readonly string[]> {
  const result = await runner.run("tesseract", ["--list-langs"], { timeoutMs: 5000 });
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.toLowerCase().startsWith("list of available"));
}

function firstLine(value: string): string {
  return value.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
}
