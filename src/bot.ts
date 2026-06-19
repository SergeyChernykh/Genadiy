import { Telegraf, type Context } from "telegraf";
import type { AppConfig } from "./config/env.js";
import { createProxyAgent } from "./network/proxyAgent.js";
import { DocumentQuestionAnsweringService } from "./questionAnswering/documentQuestionAnswering.js";
import type {
  DeepSeekChatClient,
  DocumentTextRepository,
  ObjectStorage,
  UploadRecordRepository
} from "./types.js";
import { downloadTelegramFile } from "./telegram/download.js";
import { TelegramMessageRouter } from "./telegram/messageRouter.js";
import { TelegramQuestionHandler } from "./telegram/questionHandler.js";
import { TelegramUploadHandler } from "./telegram/uploadHandler.js";

export interface TelegramBotDependencies {
  storage: ObjectStorage;
  records: UploadRecordRepository;
  documents: DocumentTextRepository;
  deepSeek: DeepSeekChatClient;
  logger?: Pick<Console, "error">;
}

export function createTelegramBot(
  config: AppConfig,
  deps: TelegramBotDependencies
): Telegraf<Context> {
  const telegramAgent = createProxyAgent(config.telegramProxyUrl);
  const bot = new Telegraf<Context>(
    config.botToken,
    telegramAgent ? { telegram: { agent: telegramAgent } } : undefined
  );
  const handlerDeps = {
    config,
    storage: deps.storage,
    records: deps.records,
    downloadFile: (fileId: string) => downloadTelegramFile(bot, fileId, telegramAgent)
  };

  const handler = new TelegramUploadHandler(
    deps.logger ? { ...handlerDeps, logger: deps.logger } : handlerDeps
  );
  const questionService = new DocumentQuestionAnsweringService({
    documents: deps.documents,
    deepSeek: deps.deepSeek,
    options: {
      maxContextChars: config.deepSeek.maxContextChars
    }
  });
  const questionHandler = new TelegramQuestionHandler(
    deps.logger ? { service: questionService, logger: deps.logger } : { service: questionService }
  );
  const messageRouter = new TelegramMessageRouter({
    config,
    uploadHandler: handler,
    questionHandler
  });

  bot.on("message", (ctx) => messageRouter.handle(ctx));

  bot.catch((error) => {
    (deps.logger ?? console).error(`Telegram bot error: ${error}`);
  });

  return bot;
}
