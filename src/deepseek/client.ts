import fetch, { type RequestInit } from "node-fetch";
import type { DeepSeekConfig } from "../config/env.js";
import type { DeepSeekChatClient, DeepSeekChatCompletionInput } from "../types.js";

export interface RequiredDeepSeekConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  thinkingEnabled: boolean;
  timeoutMs: number;
  maxOutputTokens: number;
}

export interface DeepSeekClientOptions extends RequiredDeepSeekConfig {
  fetch?: FetchLike | undefined;
}

export type FetchLike = (
  url: string,
  init?: RequestInit
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export class DeepSeekClientError extends Error {
  constructor(
    message: string,
    readonly status?: number | undefined
  ) {
    super(message);
    this.name = "DeepSeekClientError";
  }
}

export class DeepSeekClient implements DeepSeekChatClient {
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: DeepSeekClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async createChatCompletion(input: DeepSeekChatCompletionInput): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const requestInit: RequestInit = {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.options.model,
          messages: input.messages,
          max_tokens: this.options.maxOutputTokens,
          stream: false,
          thinking: {
            type: this.options.thinkingEnabled ? "enabled" : "disabled"
          },
          user_id: input.userId
        }),
        signal: controller.signal as unknown as RequestInit["signal"]
      };
      const response = await this.fetchImpl(deepSeekChatUrl(this.options.baseUrl), requestInit);

      if (!response.ok) {
        throw new DeepSeekClientError(
          `DeepSeek request failed with HTTP ${response.status}: ${await responseBodyForError(response)}`,
          response.status
        );
      }

      return extractAnswer(await response.json());
    } catch (error) {
      if (error instanceof DeepSeekClientError) {
        throw error;
      }

      if (isAbortError(error)) {
        throw new DeepSeekClientError("DeepSeek request timed out.");
      }

      throw new DeepSeekClientError(
        `DeepSeek request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function requireDeepSeekConfig(config: DeepSeekConfig): RequiredDeepSeekConfig {
  if (!config.apiKey) {
    throw new Error("DEEPSEEK_API_KEY is required to enable document question answering.");
  }

  return {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    thinkingEnabled: config.thinkingEnabled,
    timeoutMs: config.timeoutMs,
    maxOutputTokens: config.maxOutputTokens
  };
}

function deepSeekChatUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function extractAnswer(responseBody: unknown): string {
  const body = responseBody as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const answer = body.choices?.[0]?.message?.content;

  if (typeof answer !== "string" || answer.trim().length === 0) {
    throw new DeepSeekClientError("DeepSeek response did not include an answer.");
  }

  return answer.trim();
}

async function responseBodyForError(response: { text(): Promise<string> }): Promise<string> {
  try {
    const body = await response.text();
    return body.length > 500 ? `${body.slice(0, 500)}...` : body;
  } catch {
    return "unreadable response body";
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
