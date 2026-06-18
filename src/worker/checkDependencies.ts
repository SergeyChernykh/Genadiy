import { loadConfig } from "../config/env.js";
import { ProcessCommandRunner } from "./system/commands.js";
import { validateWorkerDependencies } from "./system/dependencies.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const result = await validateWorkerDependencies(new ProcessCommandRunner(), config.worker);
  console.info("Document processing dependencies are available.");
  console.info(`OCR languages: ${config.worker.ocrLanguages}`);
  console.info(`Tools: ${Object.entries(result.toolVersions).map(([name, version]) => `${name}=${version}`).join(", ")}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
