import fetch, { type RequestInit } from "node-fetch";
import type { OpenAiConfig } from "../config/env.js";
import type { EmbeddingClient, EmbeddingInput, EmbeddingResult } from "../types.js";

export interface RequiredOpenAiEmbeddingConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  dimensions: number;
  timeoutMs: number;
  batchSize: number;
  inputPrefix: string;
}

export interface OpenAiEmbeddingClientOptions extends RequiredOpenAiEmbeddingConfig {
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

export class OpenAiEmbeddingClientError extends Error {
  constructor(
    message: string,
    readonly status?: number | undefined
  ) {
    super(message);
    this.name = "OpenAiEmbeddingClientError";
  }
}

export class OpenAiEmbeddingClient implements EmbeddingClient {
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: OpenAiEmbeddingClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async createEmbeddings(input: EmbeddingInput): Promise<EmbeddingResult> {
    if (input.input.length === 0) {
      return {
        embeddings: [],
        model: this.options.model,
        dimensions: this.options.dimensions
      };
    }

    const embeddings: number[][] = [];
    for (const batch of batches(input.input, this.options.batchSize)) {
      embeddings.push(...(await this.createEmbeddingBatch(batch)));
    }

    return {
      embeddings,
      model: this.options.model,
      dimensions: this.options.dimensions
    };
  }

  private async createEmbeddingBatch(input: readonly string[]): Promise<number[][]> {
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
          input: prefixEmbeddingInput(input, this.options.inputPrefix),
          dimensions: this.options.dimensions
        }),
        signal: controller.signal as unknown as RequestInit["signal"]
      };
      const response = await this.fetchImpl(openAiEmbeddingsUrl(this.options.baseUrl), requestInit);

      if (!response.ok) {
        throw new OpenAiEmbeddingClientError(
          `OpenAI embeddings request failed with HTTP ${response.status}: ${await responseBodyForError(response)}`,
          response.status
        );
      }

      return extractEmbeddings(await response.json(), input.length, this.options.dimensions);
    } catch (error) {
      if (error instanceof OpenAiEmbeddingClientError) {
        throw error;
      }

      if (isAbortError(error)) {
        throw new OpenAiEmbeddingClientError("OpenAI embeddings request timed out.");
      }

      throw new OpenAiEmbeddingClientError(
        `OpenAI embeddings request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function requireOpenAiEmbeddingConfig(
  config: OpenAiConfig,
  inputPrefix = ""
): RequiredOpenAiEmbeddingConfig {
  if (!config.apiKey && config.provider === "openai") {
    throw new Error("OPENAI_API_KEY is required to enable OpenAI RAG embeddings.");
  }

  return {
    provider: config.provider,
    apiKey: config.apiKey ?? "ollama",
    baseUrl: config.baseUrl,
    model: config.embeddingModel,
    dimensions: config.embeddingDimensions,
    timeoutMs: config.embeddingTimeoutMs,
    batchSize: config.embeddingBatchSize,
    inputPrefix
  };
}

function openAiEmbeddingsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/embeddings`;
}

function extractEmbeddings(
  responseBody: unknown,
  expectedCount: number,
  expectedDimensions: number
): number[][] {
  const body = responseBody as {
    data?: Array<{ index?: unknown; embedding?: unknown }>;
  };
  const data = body.data;
  if (!Array.isArray(data) || data.length !== expectedCount) {
    throw new OpenAiEmbeddingClientError("OpenAI embeddings response count did not match request.");
  }

  return [...data]
    .sort((left, right) => Number(left.index ?? 0) - Number(right.index ?? 0))
    .map((item) => {
      if (!Array.isArray(item.embedding)) {
        throw new OpenAiEmbeddingClientError("OpenAI embeddings response included invalid vector.");
      }

      const embedding = item.embedding.map((value) => Number(value));
      if (
        embedding.length !== expectedDimensions ||
        embedding.some((value) => !Number.isFinite(value))
      ) {
        throw new OpenAiEmbeddingClientError("OpenAI embeddings response dimensions were invalid.");
      }

      return embedding;
    });
}

function batches<T>(items: readonly T[], batchSize: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    result.push(items.slice(index, index + batchSize));
  }
  return result;
}

function prefixEmbeddingInput(input: readonly string[], prefix: string): string[] {
  if (prefix.length === 0) {
    return [...input];
  }

  return input.map((value) => `${prefix}${value}`);
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
