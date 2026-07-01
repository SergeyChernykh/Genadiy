import { createTelegramBot } from "./bot.js";
import { loadConfig } from "./config/env.js";
import { DeepSeekClient, requireDeepSeekConfig } from "./deepseek/client.js";
import {
  OpenAiEmbeddingClient,
  requireOpenAiEmbeddingConfig
} from "./openai/embeddings.js";
import {
  createPrismaClient,
  PrismaUploadRecordRepository
} from "./persistence/uploadRecords.js";
import { RagRetrievalRepository } from "./rag/persistence.js";
import { RagRetriever } from "./rag/retrieval.js";
import { createS3Client, S3ObjectStorage } from "./storage/s3ObjectStorage.js";

async function main(): Promise<void> {
  const config = loadConfig();
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
  const records = new PrismaUploadRecordRepository(prisma);
  const deepSeek = new DeepSeekClient(requireDeepSeekConfig(config.deepSeek));
  const embeddings = new OpenAiEmbeddingClient(
    requireOpenAiEmbeddingConfig(config.openAi, config.openAi.queryPrefix)
  );
  const retriever = new RagRetriever({
    embeddings,
    repository: new RagRetrievalRepository(prisma),
    options: {
      indexVersion: config.rag.indexVersion,
      embeddingModel: config.openAi.embeddingModel,
      embeddingDimensions: config.openAi.embeddingDimensions,
      retrievalLimit: config.rag.retrievalLimit,
      retrievalCandidateLimit: config.rag.retrievalCandidateLimit,
      minSimilarity: config.rag.minSimilarity,
      exactMatchBoost: config.rag.exactMatchBoost
    }
  });

  const bot = createTelegramBot(config, {
    storage,
    sourceDownloader: storage,
    records,
    retriever,
    deepSeek,
    logger: console
  });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    console.info(`Received ${signal}; stopping Telegram bot.`);
    try {
      bot.stop(signal);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message !== "Bot is not running!") {
        throw error;
      }
    }
    await prisma.$disconnect();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await bot.launch(() => {
    console.info("Telegram document ingestion bot started.");
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
