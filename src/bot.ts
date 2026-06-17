import { Telegraf, type Context } from "telegraf";
import type { AppConfig } from "./config/env.js";
import type { ObjectStorage, UploadRecordRepository } from "./types.js";
import { downloadTelegramFile } from "./telegram/download.js";
import { TelegramUploadHandler } from "./telegram/uploadHandler.js";

export interface TelegramBotDependencies {
  storage: ObjectStorage;
  records: UploadRecordRepository;
  logger?: Pick<Console, "error">;
}

export function createTelegramBot(
  config: AppConfig,
  deps: TelegramBotDependencies
): Telegraf<Context> {
  const bot = new Telegraf<Context>(config.botToken);
  const handlerDeps = {
    config,
    storage: deps.storage,
    records: deps.records,
    downloadFile: (fileId: string) => downloadTelegramFile(bot, fileId)
  };

  const handler = new TelegramUploadHandler(
    deps.logger ? { ...handlerDeps, logger: deps.logger } : handlerDeps
  );

  bot.on("message", (ctx) => handler.handle(ctx));

  bot.catch((error) => {
    (deps.logger ?? console).error(`Telegram bot error: ${error}`);
  });

  return bot;
}
