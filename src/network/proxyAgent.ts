import type { Agent as HttpAgent } from "node:http";
import { ProxyAgent } from "proxy-agent";

export function createProxyAgent(proxyUrl: string | undefined): HttpAgent | undefined {
  if (!proxyUrl) {
    return undefined;
  }

  return new ProxyAgent({
    getProxyForUrl: () => proxyUrl
  }) as unknown as HttpAgent;
}
