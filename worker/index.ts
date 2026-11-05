import { searchVideos } from "../lib/video-search.mjs";
import { weatherRequest } from "../lib/weather.mjs";
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { handleVoiceRequest } from "../lib/voice-api.mjs";
import { handleAuthRequest, sanitizeRequest } from "../lib/auth.mjs";
import { securityHeaders, withHeaders } from "../lib/security-headers.mjs";

export const APP_VERSION = "37";

const worker = {
  async fetch(rawRequest: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    // Outside ChatGPT Sites the proxy identity headers are untrusted and removed before any route reads them.
    const request = sanitizeRequest(rawRequest, env);
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith("/api/")) {
      const response = await apiRoute(pathname, request, env);
      return withHeaders(response, securityHeaders(env, { api: true }));
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    const response = await runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
    return withHeaders(response, securityHeaders(env, { api: false }));
  },
};

async function apiRoute(pathname: string, request: Request, env: Cloudflare.Env): Promise<Response> {
  if (pathname === "/api/health") {
    return Response.json(
      { ok: true, version: APP_VERSION, voice: !!env.OPENAI_API_KEY, videoSearch: !!env.YOUTUBE_DATA_API_KEY, authMode: env.AUTH_MODE || "chatgpt" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (pathname === "/api/videos/search") return searchVideos(request, env);
  if (pathname === "/api/weather") return weatherRequest(request, fetch, env);
  if (pathname.startsWith("/api/voice/")) return handleVoiceRequest(request, env);
  if (pathname.startsWith("/api/auth/")) return handleAuthRequest(request, env);
  return Response.json({ error: "not_found", message: "Page introuvable." }, { status: 404, headers: { "Cache-Control": "no-store" } });
}

export default worker;
