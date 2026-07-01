import { describe, expect, it, vi } from "vitest";
import {
  OpenAiEmbeddingClient,
  OpenAiEmbeddingClientError,
  requireOpenAiEmbeddingConfig,
  type FetchLike
} from "../../src/openai/embeddings.js";
import type { OpenAiConfig } from "../../src/config/env.js";

describe("OpenAiEmbeddingClient", () => {
  it("maps embedding requests and preserves response order", async () => {
    const fetch = vi.fn<FetchLike>(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "",
      json: async () => ({
        data: [
          { index: 1, embedding: [0.3, 0.4] },
          { index: 0, embedding: [0.1, 0.2] }
        ]
      })
    }));
    const client = new OpenAiEmbeddingClient({
      provider: "openai",
      apiKey: "openai-key",
      baseUrl: "https://api.openai.com/v1/",
      model: "text-embedding-3-small",
      dimensions: 2,
      timeoutMs: 1000,
      batchSize: 10,
      inputPrefix: "",
      fetch
    });

    const result = await client.createEmbeddings({ input: ["first", "second"] });

    expect(result.embeddings).toEqual([
      [0.1, 0.2],
      [0.3, 0.4]
    ]);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/embeddings");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer openai-key",
      "Content-Type": "application/json"
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "text-embedding-3-small",
      input: ["first", "second"],
      dimensions: 2
    });
  });

  it("batches embedding requests", async () => {
    const fetch = vi.fn<FetchLike>(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { input: string[] };
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => "",
        json: async () => ({
          data: body.input.map((_value, index) => ({
            index,
            embedding: [index, index + 1]
          }))
        })
      };
    });
    const client = new OpenAiEmbeddingClient({
      provider: "openai",
      apiKey: "openai-key",
      baseUrl: "https://api.openai.com/v1",
      model: "text-embedding-3-small",
      dimensions: 2,
      timeoutMs: 1000,
      batchSize: 2,
      inputPrefix: "",
      fetch
    });

    await client.createEmbeddings({ input: ["a", "b", "c"] });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws typed errors for HTTP failures", async () => {
    const fetch = vi.fn<FetchLike>(async () => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "bad key",
      json: async () => ({})
    }));
    const client = new OpenAiEmbeddingClient({
      provider: "openai",
      apiKey: "openai-key",
      baseUrl: "https://api.openai.com/v1",
      model: "text-embedding-3-small",
      dimensions: 2,
      timeoutMs: 1000,
      batchSize: 10,
      inputPrefix: "",
      fetch
    });

    await expect(client.createEmbeddings({ input: ["hello"] })).rejects.toMatchObject({
      name: "OpenAiEmbeddingClientError",
      status: 401
    });
  });

  it("requires an API key", () => {
    const config: OpenAiConfig = {
      provider: "openai",
      apiKey: undefined,
      baseUrl: "https://api.openai.com/v1",
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      embeddingTimeoutMs: 1000,
      embeddingBatchSize: 32,
      documentPrefix: "",
      queryPrefix: ""
    };

    expect(() => requireOpenAiEmbeddingConfig(config)).toThrow("OPENAI_API_KEY");
  });

  it("allows Ollama provider without a paid API key", () => {
    const config: OpenAiConfig = {
      provider: "ollama",
      apiKey: undefined,
      baseUrl: "http://localhost:11434/v1",
      embeddingModel: "qwen3-embedding:0.6b",
      embeddingDimensions: 1024,
      embeddingTimeoutMs: 1000,
      embeddingBatchSize: 8,
      documentPrefix: "",
      queryPrefix: ""
    };

    expect(requireOpenAiEmbeddingConfig(config)).toMatchObject({
      provider: "ollama",
      apiKey: "ollama",
      baseUrl: "http://localhost:11434/v1",
      model: "qwen3-embedding:0.6b",
      dimensions: 1024
    });
  });

  it("applies configured input prefixes before sending embedding requests", async () => {
    const fetch = vi.fn<FetchLike>(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "",
      json: async () => ({ data: [{ index: 0, embedding: [0.1, 0.2] }] })
    }));
    const client = new OpenAiEmbeddingClient({
      provider: "ollama",
      apiKey: "ollama",
      baseUrl: "http://localhost:11434/v1",
      model: "qwen3-embedding:0.6b",
      dimensions: 2,
      timeoutMs: 1000,
      batchSize: 10,
      inputPrefix: "query: ",
      fetch
    });

    await client.createEmbeddings({ input: ["What is HSV?"] });

    const [, init] = fetch.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "qwen3-embedding:0.6b",
      input: ["query: What is HSV?"],
      dimensions: 2
    });
  });

  it("rejects invalid embedding dimensions", async () => {
    const fetch = vi.fn<FetchLike>(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "",
      json: async () => ({ data: [{ index: 0, embedding: [0.1] }] })
    }));
    const client = new OpenAiEmbeddingClient({
      provider: "openai",
      apiKey: "openai-key",
      baseUrl: "https://api.openai.com/v1",
      model: "text-embedding-3-small",
      dimensions: 2,
      timeoutMs: 1000,
      batchSize: 10,
      inputPrefix: "",
      fetch
    });

    await expect(client.createEmbeddings({ input: ["hello"] })).rejects.toBeInstanceOf(
      OpenAiEmbeddingClientError
    );
  });
});
