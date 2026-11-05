declare namespace Cloudflare {
  interface Env {
    /** Voice conversation (OpenAI Realtime). Required for /api/voice. */
    OPENAI_API_KEY?: string;
    /** Overrides the Realtime model id (default gpt-realtime-2.1). */
    OPENAI_REALTIME_MODEL?: string;
    /** Dedicated secret for the hangup tokens; falls back to the OpenAI key. */
    SESSION_SIGNING_SECRET?: string;
    /** Optional: YouTube Data API v3 key for in-eye search. */
    YOUTUBE_DATA_API_KEY?: string;
    /** chatgpt (default, ChatGPT Sites proxy) | access (Cloudflare Access) | password (shared family code) | open */
    AUTH_MODE?: "chatgpt" | "access" | "password" | "open";
    ACCESS_TEAM_DOMAIN?: string;
    ACCESS_AUD?: string;
    AUTH_SECRET?: string;
    SITE_PASSWORD?: string;
    SESSION_DAYS?: string;
    ALLOWED_ORIGINS?: string;
    /** Public site URL and contact, sent to MET Norway as required by their terms. */
    SITE_URL?: string;
    CONTACT_EMAIL?: string;
    /** Spending caps (see lib/quota.mjs for defaults). */
    VOICE_SESSIONS_PER_USER_PER_DAY?: string;
    VOICE_SESSIONS_PER_DAY?: string;
    VOICE_PREVIEWS_PER_USER_PER_DAY?: string;
    VOICE_MINUTES_PER_MONTH?: string;
    VOICE_MIN_INTERVAL_SECONDS?: string;
    VOICE_SESSION_SECONDS?: string;
    VIDEO_SEARCHES_PER_USER_PER_DAY?: string;
    VIDEO_SEARCHES_PER_DAY?: string;
    /** Shared counters across isolates. KV namespace binding (wrangler.toml: BEYBOO_KV). */
    BEYBOO_KV?: KVNamespace;
    /** Standalone Worker (wrangler.toml): the family room Durable Object, one instance per family code. */
    FAMILY_ROOM?: DurableObjectNamespace;
    /** Standalone Worker (wrangler.toml): static files from public/, fetched by the Worker for / and anything outside /api. */
    ASSETS?: Fetcher;
    /** Cloudflare Realtime TURN credentials for /api/calls/turn. Optional: without them only STUN is offered. */
    TURN_KEY_ID?: string;
    TURN_KEY_API_TOKEN?: string;
    /** Tests only: overrides the YouTube Data API base URL (default https://www.googleapis.com/youtube/v3). */
    YOUTUBE_API_BASE?: string;
    /** Security headers: CSP_MODE report (default) | enforce | off ; HSTS off to disable. */
    CSP_MODE?: string;
    HSTS?: string;
    JITSI_HOST?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
