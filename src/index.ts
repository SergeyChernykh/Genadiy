import { createTelegramBot } from "./bot.js";
import { loadConfig } from "./config/env.js";
import {
  createPrismaClient,
  PrismaUploadRecordRepository
} from "./persistence/uploadRecords.js";
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

  const bot = createTelegramBot(config, {
    storage,
    records: new PrismaUploadRecordRepository(prisma),
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
