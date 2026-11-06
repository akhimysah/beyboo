/* Spending caps for paid services. Fixed windows, counted before any upstream call is made.
   With a KV binding (BOOZZO_KV) the counters are shared by every isolate; otherwise they live in memory. */
const memory = new Map();
const DAY = 86400, MONTH = 31 * 86400;

export const limits = env => ({
  voiceSessionsPerUserPerDay: positive(env?.VOICE_SESSIONS_PER_USER_PER_DAY, 24),
  voiceSessionsPerDay: positive(env?.VOICE_SESSIONS_PER_DAY, 240),
  voicePreviewsPerUserPerDay: positive(env?.VOICE_PREVIEWS_PER_USER_PER_DAY, 60),
  voiceMinutesPerMonth: positive(env?.VOICE_MINUTES_PER_MONTH, 600),
  voiceIntervalSeconds: positive(env?.VOICE_MIN_INTERVAL_SECONDS, 8),
  videoSearchesPerUserPerDay: positive(env?.VIDEO_SEARCHES_PER_USER_PER_DAY, 40),
  videoSearchesPerDay: positive(env?.VIDEO_SEARCHES_PER_DAY, 300)
});
function positive(value, fallback) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : fallback; }

function store(env) {
  const kv = env?.BOOZZO_KV;
  if (kv && typeof kv.get === 'function' && typeof kv.put === 'function') {
    return {
      async read(key) { try { return await kv.get(key, 'json'); } catch { return null; } },
      async write(key, value, ttl) { try { await kv.put(key, JSON.stringify(value), {expirationTtl: Math.max(60, ttl)}); } catch { /* counting must never break the service */ } }
    };
  }
  return {
    async read(key) { const entry = memory.get(key); if (entry && entry.resetAt > Date.now()) return entry; memory.delete(key); return null; },
    async write(key, value) { memory.set(key, value); if (memory.size > 5000) for (const [k, v] of memory) if (v.resetAt <= Date.now()) memory.delete(k); }
  };
}

const windowStart = seconds => Math.floor(Date.now() / 1000 / seconds) * seconds;

/* Consume `amount` from the counter `key` limited to `limit` per `seconds`. */
export async function consume(env, key, limit, seconds, amount = 1) {
  if (!limit || !(seconds > 0)) return {ok: true, remaining: Infinity, retryAfter: 0};
  const s = store(env), start = windowStart(seconds), resetAt = (start + seconds) * 1000;
  const bucket = (await s.read(key)) || {count: 0, resetAt};
  if (bucket.resetAt !== resetAt) { bucket.count = 0; bucket.resetAt = resetAt; }
  if (bucket.count + amount > limit) return {ok: false, remaining: Math.max(0, limit - bucket.count), retryAfter: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))};
  bucket.count += amount;
  await s.write(key, bucket, seconds);
  return {ok: true, remaining: limit - bucket.count, retryAfter: 0};
}

/* Peek without consuming: lets /api/voice/status show what is left today. */
export async function remaining(env, key, limit, seconds) {
  if (!limit) return Infinity;
  const bucket = await store(env).read(key);
  if (!bucket || bucket.resetAt !== (windowStart(seconds) + seconds) * 1000) return limit;
  return Math.max(0, limit - bucket.count);
}

/* Every voice session passes through here before OpenAI is contacted. */
export async function reserveVoiceSession(env, userId, {preview = false, seconds = 180} = {}) {
  const l = limits(env);
  const interval = await consume(env, 'voice:interval:' + userId, 1, l.voiceIntervalSeconds);
  if (!interval.ok) return {ok: false, reason: 'too_fast', retryAfter: interval.retryAfter};
  if (preview) {
    const previews = await consume(env, 'voice:preview:' + userId, l.voicePreviewsPerUserPerDay, DAY);
    if (!previews.ok) return {ok: false, reason: 'user_quota', retryAfter: previews.retryAfter};
  } else {
    const user = await consume(env, 'voice:user:' + userId, l.voiceSessionsPerUserPerDay, DAY);
    if (!user.ok) return {ok: false, reason: 'user_quota', retryAfter: user.retryAfter};
  }
  const global = await consume(env, 'voice:global', l.voiceSessionsPerDay, DAY);
  if (!global.ok) return {ok: false, reason: 'site_quota', retryAfter: global.retryAfter};
  const minutes = await consume(env, 'voice:minutes', l.voiceMinutesPerMonth, MONTH, Math.ceil(seconds / 60));
  if (!minutes.ok) return {ok: false, reason: 'budget', retryAfter: minutes.retryAfter};
  return {ok: true};
}

export async function voiceAllowance(env, userId) {
  const l = limits(env);
  return {
    sessionsToday: await remaining(env, 'voice:user:' + userId, l.voiceSessionsPerUserPerDay, DAY),
    siteSessionsToday: await remaining(env, 'voice:global', l.voiceSessionsPerDay, DAY),
    minutesThisMonth: await remaining(env, 'voice:minutes', l.voiceMinutesPerMonth, MONTH)
  };
}

export async function reserveVideoSearch(env, userId) {
  const l = limits(env);
  const user = await consume(env, 'video:user:' + userId, l.videoSearchesPerUserPerDay, DAY);
  if (!user.ok) return {ok: false, reason: 'user_quota', retryAfter: user.retryAfter};
  const global = await consume(env, 'video:global', l.videoSearchesPerDay, DAY);
  if (!global.ok) return {ok: false, reason: 'site_quota', retryAfter: global.retryAfter};
  return {ok: true};
}

/* Tests only: forget every in-memory counter. */
export function resetQuotaMemory() { memory.clear(); }
