/* One identity resolver for every /api route. The server picks the mode (AUTH_MODE); the client never does. */
export const AUTH_MODES = ['chatgpt', 'access', 'password', 'open'];
const OAI_PREFIX = 'oai-authenticated-user-';
const COOKIE = 'beyboo_session';
const encoder = new TextEncoder();

export function authMode(env) {
  const mode = String(env?.AUTH_MODE || 'chatgpt').toLowerCase();
  return AUTH_MODES.includes(mode) ? mode : 'chatgpt';
}

/* Outside ChatGPT Sites nobody may impersonate the hosting proxy: drop its identity headers early. */
export function sanitizeRequest(request, env) {
  if (authMode(env) === 'chatgpt') return request;
  let tainted = false;
  for (const name of request.headers.keys()) if (name.toLowerCase().startsWith(OAI_PREFIX)) tainted = true;
  if (!tainted) return request;
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) if (name.toLowerCase().startsWith(OAI_PREFIX)) headers.delete(name);
  return new Request(request, {headers});
}

const base64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const fromBase64url = text => Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - text.length % 4) % 4)), c => c.charCodeAt(0));
const hmacKey = (secret, usage) => crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, [usage]);

export async function sha256(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* Compact signed token: base64url(JSON payload).base64url(HMAC-SHA-256). */
export async function signToken(payload, secret) {
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), encoder.encode(body));
  return body + '.' + base64url(signature);
}
export async function verifyToken(token, secret) {
  try {
    const [body, signature] = String(token || '').split('.');
    if (!body || !signature) return null;
    if (!await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), fromBase64url(signature), encoder.encode(body))) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body)));
    return payload && typeof payload === 'object' && (!payload.exp || payload.exp > Date.now()) ? payload : null;
  } catch { return null; }
}

export function timingSafeEqual(a, b) {
  const left = encoder.encode(String(a)), right = encoder.encode(String(b));
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) diff |= (left[i] || 0) ^ (right[i] || 0);
  return diff === 0;
}

function cookieValue(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}

/* Cloudflare Access: verify the RS256 assertion against the team's JWKS. Nothing else is trusted. */
const jwksCache = new Map();
async function accessKeys(team, fetcher) {
  const cached = jwksCache.get(team);
  if (cached && cached.expires > Date.now()) return cached.keys;
  const response = await fetcher('https://' + team + '/cdn-cgi/access/certs', {signal: AbortSignal.timeout(5000)});
  if (!response.ok) throw Error('jwks');
  const {keys} = await response.json();
  const imported = new Map();
  for (const jwk of keys || []) {
    if (jwk.kty !== 'RSA' || !jwk.kid) continue;
    imported.set(jwk.kid, await crypto.subtle.importKey('jwk', jwk, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify']));
  }
  jwksCache.set(team, {keys: imported, expires: Date.now() + 3600000});
  return imported;
}
export async function verifyAccessJwt(token, env, fetcher = fetch) {
  try {
    const team = String(env.ACCESS_TEAM_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const audience = env.ACCESS_AUD;
    if (!team || !audience || !token) return null;
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const header = JSON.parse(new TextDecoder().decode(fromBase64url(h)));
    if (header.alg !== 'RS256') return null;
    const keys = await accessKeys(team, fetcher);
    const key = keys.get(header.kid);
    if (!key) return null;
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromBase64url(s), encoder.encode(h + '.' + p))) return null;
    const claims = JSON.parse(new TextDecoder().decode(fromBase64url(p)));
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(audience)) return null;
    if (!(claims.exp * 1000 > Date.now())) return null;
    if (claims.iss && claims.iss !== 'https://' + team) return null;
    return claims.email || claims.sub || null;
  } catch { return null; }
}

/* Resolve who is calling. Returns {userId|null, mode, signIn} without ever throwing. */
export async function identify(request, env = {}, fetcher = fetch) {
  const mode = authMode(env);
  const path = new URL(request.url).pathname;
  const returnTo = /^\/index(-en)?\.html$/.test(path) ? path : (request.headers.get('referer') || '').includes('index-en.html') ? '/index-en.html' : '/index.html';
  if (mode === 'chatgpt') {
    const userId = request.headers.get('oai-authenticated-user-id');
    return {mode, userId: userId || null, signIn: {kind: 'link', url: '/signin-with-chatgpt?return_to=' + encodeURIComponent(returnTo + '#experience')}};
  }
  if (mode === 'access') {
    const email = await verifyAccessJwt(request.headers.get('cf-access-jwt-assertion'), env, fetcher);
    return {mode, userId: email ? 'access:' + await sha256(email) : null, signIn: {kind: 'reload'}};
  }
  if (mode === 'password') {
    const session = env.AUTH_SECRET ? await verifyToken(cookieValue(request, COOKIE), env.AUTH_SECRET) : null;
    return {mode, userId: session?.sub ? 'family:' + session.sub : null, signIn: {kind: 'password', url: '/api/auth/login'}};
  }
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  return {mode, userId: 'open:' + (await sha256(ip + '|' + new Date().toISOString().slice(0, 10))).slice(0, 32), signIn: {kind: 'none'}};
}

const json = (body, status = 200, headers = {}) => Response.json(body, {status, headers: {'Cache-Control': 'no-store', ...headers}});

/* Password mode: a shared family code exchanged for a signed, HttpOnly cookie. */
export async function handleAuthRequest(request, env) {
  const path = new URL(request.url).pathname;
  if (authMode(env) !== 'password') return json({error: 'not_found', message: 'Page introuvable.'}, 404);
  if (request.method !== 'POST') return json({error: 'method_not_allowed', message: 'Méthode non autorisée.'}, 405);
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  if (path === '/api/auth/logout') {
    return json({signedOut: true}, 200, {'Set-Cookie': COOKIE + '=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax' + secure});
  }
  if (path !== '/api/auth/login') return json({error: 'not_found', message: 'Page introuvable.'}, 404);
  if (!env.AUTH_SECRET || !env.SITE_PASSWORD) return json({error: 'not_configured', message: 'L’accès par code n’est pas configuré sur ce serveur.'}, 503);
  let body;
  try { body = await request.json(); } catch { return json({error: 'invalid_json', message: 'Demande illisible.'}, 400); }
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!password || password.length > 200 || !timingSafeEqual(password, env.SITE_PASSWORD)) {
    return json({error: 'invalid_password', message: 'Code d’accès incorrect.'}, 401);
  }
  const days = Math.min(90, Math.max(1, Number(env.SESSION_DAYS) || 30));
  const token = await signToken({sub: (await sha256(env.SITE_PASSWORD + '|' + env.AUTH_SECRET)).slice(0, 16), exp: Date.now() + days * 86400000}, env.AUTH_SECRET);
  return json({signedIn: true}, 200, {'Set-Cookie': COOKIE + '=' + token + '; Max-Age=' + days * 86400 + '; Path=/; HttpOnly; SameSite=Lax' + secure});
}

/* Same-site check that works behind proxies: Sec-Fetch-Site first, then Origin against the allow list. */
export function sameSite(request, env = {}) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite) return fetchSite === 'same-origin' || fetchSite === 'none';
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return origin === new URL(request.url).origin || allowed.includes(origin);
}
