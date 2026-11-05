import test from 'node:test';
import assert from 'node:assert/strict';
import {identify, sanitizeRequest, sameSite, handleAuthRequest, signToken, verifyToken, timingSafeEqual, verifyAccessJwt} from '../lib/auth.mjs';
import {consume, remaining, reserveVoiceSession, reserveVideoSearch, voiceAllowance, limits, resetQuotaMemory} from '../lib/quota.mjs';
import {handleVoiceRequest, voiceModel} from '../lib/voice-api.mjs';
import {securityHeaders, contentSecurityPolicy, withHeaders} from '../lib/security-headers.mjs';
import {weatherRequest} from '../lib/weather.mjs';

const site = 'https://beyboo.test';
const sdp = 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n';
const post = (path, body, headers = {}) => new Request(site + path, {method: 'POST', headers: {origin: site, 'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)});
const upstream = async () => new Response(sdp, {status: 201, headers: {Location: 'https://api.openai.com/v1/realtime/calls/rtc_1'}});

test.beforeEach(() => resetQuotaMemory());

test('outside ChatGPT the proxy identity headers are stripped before any route can trust them', async () => {
  const forged = new Request(site + '/api/voice/session', {method: 'POST', headers: {'oai-authenticated-user-id': 'mallory', 'OAI-Authenticated-User-Email': 'm@x', origin: site}, body: '{}'});
  assert.equal(sanitizeRequest(forged, {AUTH_MODE: 'chatgpt'}).headers.get('oai-authenticated-user-id'), 'mallory');
  for (const mode of ['access', 'password', 'open']) {
    const clean = sanitizeRequest(forged.clone(), {AUTH_MODE: mode});
    assert.equal(clean.headers.get('oai-authenticated-user-id'), null, mode);
    assert.equal(clean.headers.get('oai-authenticated-user-email'), null, mode);
    assert.equal(clean.headers.get('origin'), site);
    assert.equal(await clean.text(), '{}');
  }
  const chatgpt = await identify(forged, {});
  assert.equal(chatgpt.userId, 'mallory'); assert.equal(chatgpt.mode, 'chatgpt'); assert.match(chatgpt.signIn.url, /^\/signin-with-chatgpt\?return_to=/);
  const access = await identify(forged, {AUTH_MODE: 'access'});
  assert.equal(access.userId, null); assert.equal(access.signIn.kind, 'reload');
  const open = await identify(new Request(site + '/x', {headers: {'cf-connecting-ip': '203.0.113.9'}}), {AUTH_MODE: 'open'});
  assert.match(open.userId, /^open:[a-f0-9]{32}$/);
  assert.equal((await identify(new Request(site + '/x', {headers: {'cf-connecting-ip': '203.0.113.9'}}), {AUTH_MODE: 'open'})).userId, open.userId);
  assert.notEqual((await identify(new Request(site + '/x', {headers: {'cf-connecting-ip': '203.0.113.10'}}), {AUTH_MODE: 'open'})).userId, open.userId);
});

test('password mode exchanges the family code for a signed HttpOnly cookie and rejects anything else', async () => {
  const env = {AUTH_MODE: 'password', AUTH_SECRET: 'unit-secret', SITE_PASSWORD: 'coquelicot-42'};
  assert.equal((await handleAuthRequest(post('/api/auth/login', {password: 'x'}), {AUTH_MODE: 'chatgpt'})).status, 404);
  assert.equal((await handleAuthRequest(post('/api/auth/login', {password: 'x'}), {AUTH_MODE: 'password'})).status, 503);
  assert.equal((await handleAuthRequest(new Request(site + '/api/auth/login'), env)).status, 405);
  assert.equal((await handleAuthRequest(post('/api/auth/login', {password: 'wrong'}), env)).status, 401);
  assert.equal((await handleAuthRequest(post('/api/auth/login', {password: 'coquelicot-42 '}), env)).status, 401);
  const ok = await handleAuthRequest(post('/api/auth/login', {password: 'coquelicot-42'}), env);
  assert.equal(ok.status, 200);
  const cookie = ok.headers.get('Set-Cookie');
  assert.match(cookie, /^beyboo_session=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+; Max-Age=2592000; Path=\/; HttpOnly; SameSite=Lax; Secure$/);
  const token = cookie.split(';')[0].split('=')[1];
  const who = await identify(new Request(site + '/api/voice/status', {headers: {cookie: 'other=1; beyboo_session=' + token}}), env);
  assert.match(who.userId, /^family:[a-f0-9]{16}$/);
  assert.equal((await identify(new Request(site + '/api/voice/status', {headers: {cookie: 'beyboo_session=' + token + 'x'}}), env)).userId, null);
  assert.equal((await identify(new Request(site + '/api/voice/status', {headers: {cookie: 'beyboo_session=' + token}}), {...env, AUTH_SECRET: 'rotated'})).userId, null);
  const out = await handleAuthRequest(post('/api/auth/logout', {}), env);
  assert.match(out.headers.get('Set-Cookie'), /Max-Age=0/);
  const expired = await signToken({sub: 'a', exp: Date.now() - 1}, 'k');
  assert.equal(await verifyToken(expired, 'k'), null);
  assert.equal(timingSafeEqual('abc', 'abc'), true); assert.equal(timingSafeEqual('abc', 'abd'), false); assert.equal(timingSafeEqual('abc', 'abcd'), false);
});

test('Cloudflare Access assertions are verified against the team JWKS, audience and expiry', async () => {
  const {publicKey, privateKey} = await crypto.subtle.generateKey({name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'}, true, ['sign', 'verify']);
  const jwk = {...await crypto.subtle.exportKey('jwk', publicKey), kid: 'k1', alg: 'RS256', use: 'sig'};
  const b64 = value => btoa(String.fromCharCode(...new Uint8Array(value instanceof Uint8Array ? value : new TextEncoder().encode(JSON.stringify(value))))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const sign = async (claims, kid = 'k1') => {
    const head = b64({alg: 'RS256', kid}), body = b64(claims);
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(head + '.' + body));
    return head + '.' + body + '.' + b64(new Uint8Array(signature));
  };
  let fetched = 0;
  const jwks = async url => { fetched++; assert.equal(url, 'https://family.cloudflareaccess.com/cdn-cgi/access/certs'); return Response.json({keys: [jwk]}); };
  const env = {AUTH_MODE: 'access', ACCESS_TEAM_DOMAIN: 'family.cloudflareaccess.com', ACCESS_AUD: 'aud-1'};
  const good = await sign({aud: ['aud-1'], exp: Math.floor(Date.now() / 1000) + 60, email: 'parent@example.org', iss: 'https://family.cloudflareaccess.com'});
  assert.equal(await verifyAccessJwt(good, env, jwks), 'parent@example.org');
  assert.equal(await verifyAccessJwt(await sign({aud: 'other', exp: Math.floor(Date.now() / 1000) + 60, email: 'a@b'}), env, jwks), null);
  assert.equal(await verifyAccessJwt(await sign({aud: 'aud-1', exp: Math.floor(Date.now() / 1000) - 5, email: 'a@b'}), env, jwks), null);
  assert.equal(await verifyAccessJwt(await sign({aud: 'aud-1', exp: Math.floor(Date.now() / 1000) + 60, email: 'a@b'}, 'unknown'), env, jwks), null);
  assert.equal(await verifyAccessJwt(good.slice(0, -4) + 'AAAA', env, jwks), null);
  assert.equal(fetched, 1, 'the JWKS is cached');
  const identity = await identify(new Request(site + '/api/voice/status', {headers: {'cf-access-jwt-assertion': good}}), env, jwks);
  assert.match(identity.userId, /^access:[a-f0-9]{64}$/);
});

test('same-site checks prefer Sec-Fetch-Site and accept configured extra origins', () => {
  const req = headers => new Request(site + '/api/voice/session', {method: 'POST', headers});
  assert.equal(sameSite(req({'sec-fetch-site': 'same-origin'})), true);
  assert.equal(sameSite(req({'sec-fetch-site': 'cross-site', origin: site})), false);
  assert.equal(sameSite(req({origin: site})), true);
  assert.equal(sameSite(req({origin: 'https://evil.test'})), false);
  assert.equal(sameSite(req({origin: 'https://beyboo.family'}), {ALLOWED_ORIGINS: 'https://beyboo.family, https://beyboo.app'}), true);
  assert.equal(sameSite(req({})), false);
});

test('quotas count before any paid call: interval, per-user day, site day and monthly minutes', async () => {
  const env = {VOICE_SESSIONS_PER_USER_PER_DAY: '2', VOICE_SESSIONS_PER_DAY: '3', VOICE_MIN_INTERVAL_SECONDS: '0', VOICE_MINUTES_PER_MONTH: '9'};
  assert.equal((await reserveVoiceSession(env, 'ana')).ok, true);
  assert.equal((await reserveVoiceSession(env, 'ana')).ok, true);
  const third = await reserveVoiceSession(env, 'ana');
  assert.equal(third.ok, false); assert.equal(third.reason, 'user_quota'); assert.ok(third.retryAfter > 0);
  assert.deepEqual(await voiceAllowance(env, 'ana'), {sessionsToday: 0, siteSessionsToday: 1, minutesThisMonth: 3});
  assert.equal((await reserveVoiceSession(env, 'ben')).ok, true);
  assert.equal((await reserveVoiceSession(env, 'cat')).reason, 'site_quota');
  resetQuotaMemory();
  const budget = {VOICE_MIN_INTERVAL_SECONDS: '0', VOICE_MINUTES_PER_MONTH: '4'};
  assert.equal((await reserveVoiceSession(budget, 'dan')).ok, true);
  assert.equal((await reserveVoiceSession(budget, 'dan')).reason, 'budget');
  assert.equal((await reserveVoiceSession(budget, 'dan', {preview: true, seconds: 20})).ok, true, 'a 20 s preview only costs one minute');
  resetQuotaMemory();
  const paced = {VOICE_MIN_INTERVAL_SECONDS: '60'};
  assert.equal((await reserveVoiceSession(paced, 'eve')).ok, true);
  assert.equal((await reserveVoiceSession(paced, 'eve')).reason, 'too_fast');
  assert.equal((await consume({}, 'x', 0, 60)).ok, true, 'a zero limit disables the counter');
  assert.equal(await remaining({}, 'never', 5, 60), 5);
  const kvStore = new Map();
  const kv = {get: async (k) => kvStore.has(k) ? JSON.parse(kvStore.get(k)) : null, put: async (k, v, options) => { assert.ok(options.expirationTtl >= 60); kvStore.set(k, v); }};
  const shared = {BEYBOO_KV: kv, VIDEO_SEARCHES_PER_USER_PER_DAY: '1'};
  assert.equal((await reserveVideoSearch(shared, 'ana')).ok, true);
  assert.equal((await reserveVideoSearch(shared, 'ana')).reason, 'user_quota');
  assert.ok([...kvStore.keys()].includes('video:user:ana'));
  assert.equal(limits({}).voiceSessionsPerUserPerDay, 24);
});

test('the voice route reports quotas and the sign-in method, and refuses with 429 before contacting OpenAI', async () => {
  const env = {OPENAI_API_KEY: 'test-only-secret', VOICE_SESSIONS_PER_USER_PER_DAY: '1', VOICE_MIN_INTERVAL_SECONDS: '0', OPENAI_REALTIME_MODEL: 'gpt-realtime-next'};
  const user = {'oai-authenticated-user-id': 'owner'};
  const status = await (await handleVoiceRequest(new Request(site + '/api/voice/status', {headers: user}), env)).json();
  assert.equal(status.model, 'gpt-realtime-next'); assert.equal(status.authMode, 'chatgpt'); assert.equal(status.signIn.kind, 'link');
  assert.deepEqual(status.quota, {sessionsToday: 1, siteSessionsToday: 240, minutesThisMonth: 600});
  const anonymous = await handleVoiceRequest(post('/api/voice/session', {character: 'noah', voiceProfile: 'bulle', sdp}), env, upstream);
  assert.equal(anonymous.status, 401); assert.equal((await anonymous.json()).signIn.kind, 'link');
  let calls = 0;
  const counted = async (...args) => { calls++; return upstream(...args); };
  const first = await handleVoiceRequest(post('/api/voice/session', {character: 'noah', voiceProfile: 'bulle', sdp}, user), env, counted);
  assert.equal(first.status, 200); assert.equal(calls, 1);
  const second = await handleVoiceRequest(post('/api/voice/session', {character: 'noah', voiceProfile: 'bulle', sdp}, user), env, counted);
  assert.equal(second.status, 429); assert.equal(calls, 1);
  const body = await second.json();
  assert.equal(body.error, 'quota_exceeded'); assert.equal(body.reason, 'user_quota'); assert.match(second.headers.get('Retry-After'), /^\d+$/);
  assert.equal(voiceModel({OPENAI_REALTIME_MODEL: 'bad model!'}), 'gpt-realtime-2.1');
  const signed = {...env, VOICE_SESSIONS_PER_USER_PER_DAY: '5', SESSION_SIGNING_SECRET: 'dedicated'};
  const answer = await (await handleVoiceRequest(post('/api/voice/session', {character: 'noah', voiceProfile: 'bulle', sdp}, user), signed, upstream)).json();
  assert.ok(answer.endToken);
  assert.equal((await handleVoiceRequest(post('/api/voice/end', {token: answer.endToken}, user), {...signed, SESSION_SIGNING_SECRET: 'other'}, upstream)).status, 403, 'tokens are bound to the signing secret');
  assert.equal((await handleVoiceRequest(post('/api/voice/end', {token: answer.endToken}, user), signed, async () => new Response(null, {status: 200}))).status, 200);
  const limited = await handleVoiceRequest(post('/api/voice/session', {character: 'noah', voiceProfile: 'bulle', sdp}, user), signed, async () => new Response('slow down', {status: 429, headers: {'Retry-After': '30'}}));
  assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '30');
});

test('security headers: strict for the API, report-only CSP by default for pages, enforce on request', () => {
  const api = securityHeaders({}, {api: true});
  assert.equal(api['Content-Security-Policy'], "default-src 'none'; frame-ancestors 'none'");
  assert.equal(api['X-Frame-Options'], 'DENY'); assert.match(api['Strict-Transport-Security'], /max-age=31536000/);
  const page = securityHeaders({});
  assert.ok(page['Content-Security-Policy-Report-Only'].includes("frame-src https://www.youtube-nocookie.com https://www.youtube.com;"));
  assert.ok(page['Content-Security-Policy-Report-Only'].includes("connect-src 'self' https://api.openai.com;"), "'self' covers the same-origin family-room WebSocket");
  assert.equal(page['Content-Security-Policy'], undefined);
  assert.equal(page['Permissions-Policy'], 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()', 'calls are peer-to-peer: only this origin may capture media');
  const enforced = securityHeaders({CSP_MODE: 'enforce', HSTS: 'off'});
  assert.equal(enforced['Content-Security-Policy'], contentSecurityPolicy());
  assert.equal(enforced['Strict-Transport-Security'], undefined);
  assert.ok(!/jit\.si|jitsi/i.test(JSON.stringify(securityHeaders({CSP_MODE: 'enforce'}))), 'no Jitsi host remains in any header');
  const wrapped = withHeaders(new Response('x', {headers: {'X-Frame-Options': 'SAMEORIGIN'}}), api);
  assert.equal(wrapped.headers.get('X-Frame-Options'), 'SAMEORIGIN', 'existing headers win');
  assert.equal(wrapped.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
});

test('weather identifies the deployment to MET Norway and serves a stale forecast when the upstream fails', async () => {
  const req = () => new Request(site + '/api/weather?city=sydney');
  const forecast = async (url, options) => {
    assert.equal(options.headers['User-Agent'], 'BEYBOO/1.0 (+https://beyboo.family; contact@beyboo.family)');
    return Response.json({properties: {timeseries: [{time: new Date().toISOString(), data: {instant: {details: {air_temperature: 21.4}}, next_1_hours: {summary: {symbol_code: 'clearsky_day'}}}}]}}, {headers: {Expires: new Date(Date.now() + 1000).toUTCString()}});
  };
  const env = {SITE_URL: 'https://beyboo.family', CONTACT_EMAIL: 'contact@beyboo.family'};
  assert.equal((await (await weatherRequest(req(), forecast, env)).json()).temperature, 21);
  await new Promise(resolve => setTimeout(resolve, 1100));
  const stale = await weatherRequest(req(), async () => new Response(null, {status: 503}), env);
  assert.equal(stale.status, 200);
  const data = await stale.json();
  assert.equal(data.temperature, 21); assert.equal(data.stale, true);
  assert.equal(stale.headers.get('Cache-Control'), 'public, max-age=300');
});
