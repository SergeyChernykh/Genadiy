import { describe, expect, it, vi } from "vitest";
import {
  DeepSeekClient,
  DeepSeekClientError,
  requireDeepSeekConfig,
  type FetchLike
} from "../../src/deepseek/client.js";
import type { DeepSeekConfig } from "../../src/config/env.js";

describe("DeepSeekClient", () => {
  it("maps chat completions requests and extracts the answer", async () => {
    const fetch = vi.fn<FetchLike>(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "",
      json: async () => ({
        choices: [{ message: { content: "  Answer from documents.  " } }]
      })
    }));
    const client = new DeepSeekClient({
      apiKey: "deepseek-key",
      baseUrl: "https://api.deepseek.com/",
      model: "deepseek-v4-flash",
      thinkingEnabled: false,
      timeoutMs: 1000,
      maxOutputTokens: 512,
      fetch
    });

    const answer = await client.createChatCompletion({
      userId: "telegram-hash",
      messages: [{ role: "user", content: "Question" }]
    });

    expect(answer).toBe("Answer from documents.");
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer deepseek-key",
      "Content-Type": "application/json"
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "deepseek-v4-flash",
      messages: [{ role: "user", content: "Question" }],
      max_tokens: 512,
      stream: false,
      thinking: { type: "disabled" },
      user_id: "telegram-hash"
    });
  });

  it("throws typed errors for DeepSeek HTTP failures", async () => {
    const fetch = vi.fn<FetchLike>(async () => ({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: async () => "rate limit",
      json: async () => ({})
    }));
    const client = new DeepSeekClient({
      apiKey: "deepseek-key",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      thinkingEnabled: true,
      timeoutMs: 1000,
      maxOutputTokens: 512,
      fetch
    });

    await expect(
      client.createChatCompletion({
        userId: "telegram-hash",
        messages: [{ role: "user", content: "Question" }]
      })
    ).rejects.toMatchObject({
      name: "DeepSeekClientError",
      status: 429
    });
  });

  it("requires an API key before bot question answering starts", () => {
    const config: DeepSeekConfig = {
      apiKey: undefined,
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      thinkingEnabled: false,
      timeoutMs: 1000,
      maxContextChars: 1000,
      maxOutputTokens: 512
    };

    expect(() => requireDeepSeekConfig(config)).toThrow("DEEPSEEK_API_KEY");
  });

  it("rejects empty DeepSeek answers", async () => {
    const fetch = vi.fn<FetchLike>(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "",
      json: async () => ({ choices: [{ message: { content: "" } }] })
    }));
    const client = new DeepSeekClient({
      apiKey: "deepseek-key",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      thinkingEnabled: false,
      timeoutMs: 1000,
      maxOutputTokens: 512,
      fetch
    });

    await expect(
      client.createChatCompletion({
        userId: "telegram-hash",
        messages: [{ role: "user", content: "Question" }]
      })
    ).rejects.toBeInstanceOf(DeepSeekClientError);
  });
});
