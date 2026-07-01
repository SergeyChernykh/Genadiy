import { loadConfig } from "../config/env.js";
import {
  OpenAiEmbeddingClient,
  requireOpenAiEmbeddingConfig
} from "../openai/embeddings.js";
import { RagIndexer } from "../rag/indexer.js";
import { RagIndexRepository } from "../rag/persistence.js";
import {
  createPrismaClient,
  PrismaUploadRecordRepository
} from "../persistence/uploadRecords.js";
import { createS3Client, S3ObjectStorage } from "../storage/s3ObjectStorage.js";
import { DocumentProcessor } from "./processing/documentProcessor.js";
import { ProcessingJobRepository } from "./persistence/processingJobs.js";
import { DocumentWorker } from "./runner.js";
import { ProcessCommandRunner } from "./system/commands.js";
import { validateWorkerDependencies } from "./system/dependencies.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const commandRunner = new ProcessCommandRunner();
  const dependencyResult = await validateWorkerDependencies(commandRunner, config.worker);
  const prisma = createPrismaClient(config.databaseUrl);
  const storage = new S3ObjectStorage(
    createS3Client({
      endpoint: config.s3Endpoint,
      region: config.s3Region,
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
      forcePathStyle: config.s3ForcePathStyle
    }),
    config.s3Bucket
  );

  const repository = new ProcessingJobRepository(prisma, {
    maxAttempts: config.worker.maxAttempts,
    retryDelayMs: config.worker.retryDelayMs
  });
  const ragRepository = new RagIndexRepository(prisma, {
    indexVersion: config.rag.indexVersion,
    maxAttempts: config.worker.maxAttempts,
    retryDelayMs: config.worker.retryDelayMs
  });
  const embeddings = new OpenAiEmbeddingClient(
    requireOpenAiEmbeddingConfig(config.openAi, config.openAi.documentPrefix)
  );
  const ragIndexer = new RagIndexer({
    repository: ragRepository,
    embeddings,
    options: {
      indexVersion: config.rag.indexVersion,
      embeddingProvider: config.openAi.provider,
      maxChars: config.rag.chunkMaxChars,
      overlapChars: config.rag.chunkOverlapChars
    },
    logger: console
  });
  const processor = new DocumentProcessor(commandRunner, {
    languages: config.worker.ocrLanguages,
    timeoutMs: config.worker.commandTimeoutMs,
    maxPdfPages: config.worker.maxPdfPages,
    maxFileBytes: config.worker.maxFileBytes,
    toolVersions: dependencyResult.toolVersions
  });
  const worker = new DocumentWorker({
    repository,
    ragIndexer,
    downloader: storage,
    processor,
    config: config.worker,
    logger: console
  });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    console.info(`Received ${signal}; stopping document processor worker.`);
    worker.stop();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await worker.runForever();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
