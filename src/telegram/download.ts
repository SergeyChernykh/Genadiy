import type { Agent as HttpAgent } from "node:http";
import fetch from "node-fetch";
import type { Context, Telegraf } from "telegraf";

export async function downloadTelegramFile(
  bot: Telegraf<Context>,
  fileId: string,
  agent?: HttpAgent
): Promise<Buffer> {
  const fileLink = await bot.telegram.getFileLink(fileId);
  const response = await fetch(fileLink.toString(), agent ? { agent } : undefined);

  if (!response.ok) {
    throw new Error(`Telegram file download failed with status ${response.status}.`);
  }

  const body = await response.arrayBuffer();
  return Buffer.from(body);
}
