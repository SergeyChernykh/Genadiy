import type { Context, Telegraf } from "telegraf";

export async function downloadTelegramFile(
  bot: Telegraf<Context>,
  fileId: string
): Promise<Buffer> {
  const fileLink = await bot.telegram.getFileLink(fileId);
  const response = await fetch(fileLink);

  if (!response.ok) {
    throw new Error(`Telegram file download failed with status ${response.status}.`);
  }

  const body = await response.arrayBuffer();
  return Buffer.from(body);
}
