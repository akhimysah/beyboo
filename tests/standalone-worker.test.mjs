import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/standalone.mjs';
import {signToken} from '../lib/auth.mjs';

/* Le Worker autonome (wrangler.toml) avec des liaisons factices : ASSETS répond selon le chemin,
   FAMILY_ROOM enregistre l'identifiant de salle et la requête transmise au Durable Object. */
const site = 'https://beyboo.test';
const SECRET = 'unit-secret';
const MEMBER = 'a'.repeat(32);

function fakeEnv(overrides = {}) {
  const assets = [], rooms = [];
  const env = {
    AUTH_MODE: 'password', AUTH_SECRET: SECRET, SITE_PASSWORD: 'code-test', CSP_MODE: 'report',
    ASSETS: {
      async fetch(request) {
        const url = new URL(request.url);
        assets.push(url.pathname + url.search);
        if (url.pathname === '/index.html') return new Response('<!doctype html><title>BOOZZO</title>', {headers: {'Content-Type': 'text/html; charset=utf-8'}});
        if (url.pathname === '/beyboo.bundle.css') return new Response('body{}', {headers: {'Content-Type': 'text/css'}});
        return new Response('absent', {status: 404});
      }
    },
    FAMILY_ROOM: {
      idFromName: name => 'room:' + name,
      get: id => ({async fetch(request) { rooms.push({id, request}); return Response.json({reached: true, id}); }})
    },
    ...overrides
  };
  return {env, assets, rooms};
}
const call = (env, path, init) => worker.fetch(new Request(site + path, init), env, {waitUntil() {}});
const sessionCookie = async (sub = 'f'.repeat(16), exp = Date.now() + 60000) => 'beyboo_session=' + await signToken({sub, exp}, SECRET);

test('/api/health describes the standalone worker as JSON with API security headers', async () => {
  const {env} = fakeEnv();
  const response = await call(env, '/api/health');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.match(String(body.version), /^\d+$/);
  assert.equal(body.authMode, 'password');
  assert.equal(body.room, true);
  assert.equal(body.voice, false);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Content-Security-Policy'), "default-src 'none'; frame-ancestors 'none'");
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal((await call(fakeEnv({FAMILY_ROOM: undefined}).env, '/api/health').then(r => r.json())).room, false);
});

test('/ is rewritten to /index.html keeping the query, static files get the report-only CSP', async () => {
  const {env, assets} = fakeEnv();
  const response = await call(env, '/?app=1&lang=fr');
  assert.equal(response.status, 200);
  assert.deepEqual(assets, ['/index.html?app=1&lang=fr']);
  assert.match(await response.text(), /BOOZZO/);
  assert.match(response.headers.get('Content-Security-Policy-Report-Only'), /default-src 'self'/);
  assert.equal(response.headers.get('Content-Security-Policy'), null);
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(response.headers.get('Strict-Transport-Security'), 'max-age=31536000; includeSubDomains');
  assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
  const css = await call(env, '/beyboo.bundle.css');
  assert.equal(css.status, 200);
  assert.equal(assets.at(-1), '/beyboo.bundle.css');
  assert.equal((await call(env, '/nulle-part.png')).status, 404);
});

test('CSP_MODE=enforce turns the page policy into an enforced header; without ASSETS the worker answers 404 JSON', async () => {
  const enforced = await call(fakeEnv({CSP_MODE: 'enforce'}).env, '/');
  assert.match(enforced.headers.get('Content-Security-Policy'), /^default-src 'self'/);
  assert.equal(enforced.headers.get('Content-Security-Policy-Report-Only'), null);
  const bare = await call(fakeEnv({ASSETS: undefined}).env, '/');
  assert.equal(bare.status, 404);
  assert.equal((await bare.json()).error, 'not_found');
});

test('unknown API routes answer 404 JSON', async () => {
  const response = await call(fakeEnv().env, '/api/inconnu');
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {error: 'not_found', message: 'Page introuvable.'});
  assert.equal(response.headers.get('Content-Security-Policy'), "default-src 'none'; frame-ancestors 'none'");
});

test('the family room requires a signed session cookie', async () => {
  const {env, rooms} = fakeEnv();
  const anonymous = await call(env, '/api/messages', {headers: {'X-Beyboo-Member': MEMBER}});
  assert.equal(anonymous.status, 401);
  const body = await anonymous.json();
  assert.equal(body.error, 'sign_in_required');
  assert.deepEqual(body.signIn, {kind: 'password', url: '/api/auth/login'});
  const expired = await call(env, '/api/messages', {headers: {'X-Beyboo-Member': MEMBER, cookie: await sessionCookie('f'.repeat(16), Date.now() - 1)}});
  assert.equal(expired.status, 401);
  const forged = await call(env, '/api/messages', {headers: {'X-Beyboo-Member': MEMBER, cookie: (await sessionCookie()).slice(0, -2) + 'zz'}});
  assert.equal(forged.status, 401);
  assert.equal(rooms.length, 0, 'the Durable Object is never reached without identity');
});

test('with a valid cookie the request reaches the Durable Object of the family, with the member headers set by the worker', async () => {
  const {env, rooms} = fakeEnv();
  const cookie = await sessionCookie('0123456789abcdef');
  const response = await call(env, '/api/messages?since=12', {headers: {cookie, 'X-Beyboo-Member': MEMBER.toUpperCase(), 'X-Beyboo-Name': encodeURIComponent('Mamie Jo')}});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {reached: true, id: 'room:family:0123456789abcdef'});
  assert.equal(rooms.length, 1);
  const forwarded = rooms[0].request;
  assert.equal(forwarded.method, 'GET');
  assert.equal(new URL(forwarded.url).search, '?since=12');
  assert.equal(forwarded.headers.get('x-beyboo-member'), MEMBER, 'member is lower-cased');
  assert.equal(forwarded.headers.get('x-beyboo-name'), 'Mamie%20Jo');
  assert.equal(forwarded.headers.get('cookie'), cookie);
  assert.equal(response.headers.get('Content-Security-Policy'), "default-src 'none'; frame-ancestors 'none'");

  /* Identité par la query (WebSocket) : ?member= et ?name= priment, un nom vide retombe sur le défaut. */
  const other = 'b'.repeat(16);
  await call(env, '/api/room/peers?member=' + other + '&name=', {headers: {cookie}});
  assert.equal(rooms[1].request.headers.get('x-beyboo-member'), other);
  assert.equal(rooms[1].request.headers.get('x-beyboo-name'), encodeURIComponent('Un proche'));
  assert.equal(rooms[1].id, rooms[0].id, 'same family, same room');
  const another = await call(env, '/api/room/peers?member=' + other, {headers: {cookie: await sessionCookie('fedcba9876543210')}});
  assert.equal((await another.json()).id, 'room:family:fedcba9876543210');
});

test('an invalid member id is refused before the Durable Object; writes must come from the site', async () => {
  const {env, rooms} = fakeEnv();
  const cookie = await sessionCookie();
  for (const member of ['', 'short', 'A'.repeat(33), 'g'.repeat(32), '../x']) {
    const response = await call(env, '/api/messages', {headers: {cookie, 'X-Beyboo-Member': member}});
    assert.equal(response.status, 400, JSON.stringify(member));
    assert.equal((await response.json()).error, 'invalid_member');
  }
  assert.equal(rooms.length, 0);
  const crossSite = await call(env, '/api/messages', {method: 'POST', headers: {cookie, 'X-Beyboo-Member': MEMBER, origin: 'https://evil.test', 'Content-Type': 'application/json'}, body: '{"text":"x"}'});
  assert.equal(crossSite.status, 403);
  assert.equal((await crossSite.json()).error, 'invalid_origin');
  assert.equal(rooms.length, 0);
  const sameSite = await call(env, '/api/messages', {method: 'POST', headers: {cookie, 'X-Beyboo-Member': MEMBER, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json'}, body: '{"text":"coucou"}'});
  assert.equal(sameSite.status, 200);
  assert.equal(rooms.length, 1);
  assert.equal(rooms[0].request.method, 'POST');
  assert.equal(await rooms[0].request.text(), '{"text":"coucou"}');
  const deletion = await call(env, '/api/messages/42', {method: 'DELETE', headers: {cookie, 'X-Beyboo-Member': MEMBER, origin: site}});
  assert.equal(deletion.status, 200);
  assert.equal(new URL(rooms[1].request.url).pathname, '/api/messages/42');
});

test('ChatGPT proxy headers are stripped in password mode and never grant an identity', async () => {
  const {env, rooms} = fakeEnv();
  const response = await call(env, '/api/messages', {headers: {'oai-authenticated-user-id': 'mallory', 'X-Beyboo-Member': MEMBER}});
  assert.equal(response.status, 401);
  assert.equal(rooms.length, 0);
});
