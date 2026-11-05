import test from 'node:test';
import assert from 'node:assert/strict';
import { handleTurnRequest, fetchTurnServers, clearTurnCache, STUN_SERVERS } from '../lib/turn.mjs';

const get = () => new Request('https://beyboo.family/api/calls/turn');
const user = {userId: 'family:abc', signIn: {kind: 'password', url: '/api/auth/login'}};
const turnKeys = {TURN_KEY_ID: 'key_0123456789', TURN_KEY_API_TOKEN: 'secret-token'};
const stunUrls = STUN_SERVERS[0].urls;

test('turn: sign-in is required and the answer is never cached by browsers', async () => {
  const denied = await handleTurnRequest(get(), {}, {userId: null, signIn: user.signIn});
  assert.equal(denied.status, 401);
  assert.equal(denied.headers.get('Cache-Control'), 'no-store');
  assert.equal((await denied.json()).signIn.kind, 'password');
  assert.equal((await handleTurnRequest(new Request('https://beyboo.family/api/calls/turn', {method: 'POST'}), {}, user)).status, 405);
});

test('turn: without Cloudflare credentials only the public STUN servers are offered', async () => {
  let called = 0;
  const response = await handleTurnRequest(get(), {}, user, async () => { called++; return Response.json({}); });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), {iceServers: [{urls: stunUrls}], turn: false});
  assert.equal(called, 0, 'no upstream request without a TURN key');
});

test('turn: Cloudflare credentials are requested with a bearer token, merged with STUN and cached briefly', async () => {
  clearTurnCache();
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({url, options});
    return Response.json({iceServers: [
      {urls: ['stun:stun.cloudflare.com:3478']},
      {urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:5349?transport=tcp'], username: 'u', credential: 'c'}
    ]});
  };
  const first = await (await handleTurnRequest(get(), turnKeys, user, fetcher)).json();
  assert.equal(first.turn, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://rtc.live.cloudflare.com/v1/turn/keys/key_0123456789/credentials/generate-ice-servers');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret-token');
  assert.deepEqual(JSON.parse(calls[0].options.body), {ttl: 86400});
  assert.ok(first.iceServers.some(s => s.username === 'u' && s.credential === 'c'));
  assert.ok(first.iceServers.some(s => [].concat(s.urls).some(u => u.startsWith('stun:'))));
  const second = await (await handleTurnRequest(get(), turnKeys, user, fetcher)).json();
  assert.equal(calls.length, 1, 'the second request within ten minutes reuses the cached credentials');
  assert.deepEqual(second, first);
  clearTurnCache();
  assert.equal((await fetchTurnServers(turnKeys, fetcher, Date.now())).length, 2);
  assert.equal(calls.length, 2);
});

test('turn: an upstream failure or an answer without TURN falls back to STUN only', async () => {
  clearTurnCache();
  const failing = await (await handleTurnRequest(get(), turnKeys, user, async () => new Response('nope', {status: 500}))).json();
  assert.deepEqual(failing, {iceServers: [{urls: stunUrls}], turn: false});
  const legacy = await (await handleTurnRequest(get(), turnKeys, user, async () => Response.json({iceServers: {urls: ['turn:turn.cloudflare.com:3478'], username: 'u', credential: 'c'}}))).json();
  assert.equal(legacy.turn, true, 'the single-object form of the older endpoint is accepted');
  assert.deepEqual(legacy.iceServers[0].urls, stunUrls, 'STUN is added when Cloudflare omits it');
  clearTurnCache();
  const noTurn = await (await handleTurnRequest(get(), turnKeys, user, async () => Response.json({iceServers: [{urls: ['stun:only.example']}]}))).json();
  assert.equal(noTurn.turn, false);
  const thrown = await (await handleTurnRequest(get(), turnKeys, user, async () => { throw new Error('network'); })).json();
  assert.equal(thrown.turn, false);
  clearTurnCache();
});
