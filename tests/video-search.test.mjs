import test from 'node:test';
import assert from 'node:assert/strict';
import {searchVideos, videoSearchMode, apiBase, resetVideoCache} from '../lib/video-search.mjs';
import {resetFeedCache, FEED_BASE} from '../lib/video-feeds.mjs';
import {resetQuotaMemory} from '../lib/quota.mjs';

const site = 'https://beyboo.test';
const request = (query, {user = 'owner', origin = site, lang = 'fr'} = {}) => new Request(site + '/api/videos/search', {method: 'POST', headers: {origin, ...(user ? {'oai-authenticated-user-id': user} : {})}, body: JSON.stringify({query, lang})});
const atom = entries => `<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom"><title>Chaîne</title><author><name>Chaîne</name></author>${entries.map(([id, title, date]) => `<entry><yt:videoId>${id}</yt:videoId><title>${title}</title><author><name>Chaîne</name></author><published>${date}</published></entry>`).join('')}</feed>`;

test.beforeEach(() => { resetVideoCache(); resetFeedCache(); resetQuotaMemory(); });

test('the mode follows the key: google with YOUTUBE_DATA_API_KEY, feeds without', () => {
  assert.equal(videoSearchMode({YOUTUBE_DATA_API_KEY: 'k'}), 'google');
  assert.equal(videoSearchMode({}), 'feeds');
  assert.equal(videoSearchMode(undefined), 'feeds');
  assert.equal(videoSearchMode({YOUTUBE_DATA_API_KEY: ''}), 'feeds');
  assert.equal(apiBase({}), 'https://www.googleapis.com');
  assert.equal(apiBase({YOUTUBE_API_BASE: 'http://127.0.0.1:9999/mock/'}), 'http://127.0.0.1:9999/mock');
  assert.equal(apiBase({YOUTUBE_API_BASE: 'not a url'}), 'https://www.googleapis.com');
});

test('Google path: the upstream base is overridable, the key travels in a header, results are cached and filtered', async () => {
  const env = {YOUTUBE_DATA_API_KEY: 'test-only', YOUTUBE_API_BASE: 'http://127.0.0.1:9999'};
  assert.equal((await searchVideos(new Request(site + '/api/videos/search'), env)).status, 405);
  assert.equal((await searchVideos(request('lune', {user: ''}), env)).status, 401);
  assert.equal((await searchVideos(request('lune', {origin: 'https://other.test'}), env)).status, 403);
  assert.equal((await searchVideos(request('', {}), env)).status, 400);
  assert.equal((await searchVideos(request('x'.repeat(181)), env)).status, 400);
  let calls = 0;
  const fetcher = async (url, options) => {
    calls++;
    assert.equal(url.origin, 'http://127.0.0.1:9999'); assert.equal(url.pathname, '/youtube/v3/search');
    assert.equal(url.searchParams.get('q'), 'lune'); assert.equal(url.searchParams.get('safeSearch'), 'strict');
    assert.equal(url.searchParams.get('videoEmbeddable'), 'true'); assert.equal(url.searchParams.get('relevanceLanguage'), 'fr');
    assert.equal(url.searchParams.has('key'), false); assert.equal(options.headers['X-Goog-Api-Key'], 'test-only');
    return Response.json({items: [{id: {videoId: 'HPFXqqe971I'}, snippet: {title: 'Paxi et la Lune', channelTitle: 'ESA'}}, {id: {videoId: 'bad'}, snippet: {title: 'x'}}]});
  };
  const result = await searchVideos(request('lune'), env, fetcher);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), {enabled: true, items: [{id: 'HPFXqqe971I', title: 'Paxi et la Lune', channel: 'ESA'}], source: 'google'});
  const again = await (await searchVideos(request('Lune '), env, () => assert.fail('should be cached'))).json();
  assert.equal(again.cached, true); assert.equal(again.source, 'google'); assert.equal(calls, 1);
  resetVideoCache();
  assert.equal((await searchVideos(request('lune'), env, async () => new Response(null, {status: 403}))).status, 503);
  assert.equal((await searchVideos(request('lune'), env, async () => Response.json({}))).status, 503);
  assert.equal((await searchVideos(request('lune'), env, async () => { throw Error('timeout'); })).status, 503);
});

test('Google path: the daily quota answers 429 with Retry-After before any upstream call', async () => {
  const env = {YOUTUBE_DATA_API_KEY: 'k', VIDEO_SEARCHES_PER_USER_PER_DAY: '1'};
  const ok = await searchVideos(request('lune'), env, async () => Response.json({items: []}));
  assert.equal(ok.status, 200);
  const blocked = await searchVideos(request('soleil'), env, () => assert.fail('quota must be checked first'));
  assert.equal(blocked.status, 429); assert.match(blocked.headers.get('Retry-After'), /^\d+$/);
  assert.equal((await blocked.json()).error, 'quota');
});

test('without a key the search falls back to the curated feeds, with the same response shape and no Google call', async () => {
  const env = {};
  assert.equal((await searchVideos(request('lune', {user: ''}), env)).status, 401);
  const urls = [];
  const fetcher = async (url) => {
    urls.push(String(url));
    assert.ok(String(url).startsWith(FEED_BASE), 'only feeds are fetched');
    if (String(url).endsWith('UCENv8pH4LkzvuSV_qHIcslg')) return new Response(atom([['UBEvvPNJL3s', 'Pourquoi l’escargot…', '2026-11-05T17:30:01+00:00'], ['shQJd3oGYn8', 'Du canon à la Lune : la gravité', '2026-10-20T10:00:00+00:00']]));
    if (String(url).endsWith('UCIBaDdAbGlFDeS33shmlD0A')) return new Response(atom([['w4U_cuF-_hI', 'Paxi explores the Moon', '2026-10-25T10:00:00+00:00']]));
    return new Response(null, {status: 503});
  };
  const result = await searchVideos(request('la lune'), env, fetcher);
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.deepEqual(body, {enabled: true, items: [{id: 'shQJd3oGYn8', title: 'Du canon à la Lune : la gravité', channel: 'Chaîne'}, {id: 'w4U_cuF-_hI', title: 'Paxi explores the Moon', channel: 'Chaîne'}], source: 'feeds'}, 'French channel first, then the translated topic');
  assert.ok(urls.length >= 12 && urls.every(u => !u.includes('googleapis')));
  const english = await (await searchVideos(request('moon', {lang: 'en'}), env, () => assert.fail('feeds are cached'))).json();
  assert.deepEqual(english.items.map(v => v.id), ['w4U_cuF-_hI', 'shQJd3oGYn8'], 'an English caller sees the English channel first');
  const cached = await (await searchVideos(request('LA LUNE'), env, () => assert.fail('cached'))).json();
  assert.equal(cached.cached, true); assert.equal(cached.source, 'feeds');
  const none = await (await searchVideos(request('girafe'), env, () => assert.fail('cached'))).json();
  assert.deepEqual(none, {enabled: true, items: [], source: 'feeds'});
  resetFeedCache(); resetVideoCache();
  const down = await searchVideos(request('lune'), env, async () => new Response(null, {status: 503}));
  assert.equal(down.status, 503); assert.deepEqual(await down.json(), {error: 'unavailable'});
});
