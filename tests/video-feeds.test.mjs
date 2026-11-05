import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFeed, tokens, score, rank, variants, channelVideos, searchFeeds, resetFeedCache, FEED_BASE, CHANNELS} from '../lib/video-feeds.mjs';
import {resetQuotaMemory} from '../lib/quota.mjs';

const entry = (id, title, published, author) => `<entry><id>yt:video:${id}</id><yt:videoId>${id}</yt:videoId><yt:channelId>UCx</yt:channelId><title>${title}</title><link rel="alternate" href="https://www.youtube.com/watch?v=${id}"/>${author ? `<author><name>${author}</name><uri>https://www.youtube.com/channel/UCx</uri></author>` : ''}<published>${published}</published><updated>${published}</updated><media:group><media:title>${title}</media:title><media:description>Abonnez-vous ! Lune et dinosaures dans la description.</media:description></media:group></entry>`;
const feed = (name, entries) => `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">\n <link rel="self" href="http://www.youtube.com/feeds/videos.xml?channel_id=UCx"/>\n <id>yt:channel:x</id>\n <yt:channelId>x</yt:channelId>\n <title>${name}</title>\n <author>\n  <name>${name}</name>\n  <uri>https://www.youtube.com/channel/UCx</uri>\n </author>\n <published>2012-10-31T08:00:30+00:00</published>\n${entries.join('\n')}\n</feed>`;
const sample = feed("C&apos;est pas sorcier", [
  entry('UBEvvPNJL3s', 'Pourquoi l’escargot est à la fois un mâle et femelle ? - C&#39;est pas sorcier', '2026-11-05T17:30:01+00:00', "C'est pas sorcier"),
  entry('HPFXqqe971I', 'Les phases de la LUNE expliquées aux enfants', '2026-10-01T10:00:00+00:00'),
  entry('shQJd3oGYn8', 'Du canon à la Lune : la découverte de la gravité', '2026-10-20T10:00:00+00:00'),
  entry('badid', 'Entrée ignorée', '2026-10-20T10:00:00+00:00'),
  entry('aaaaaaaaaaa', '<![CDATA[Les dinosaures &amp; la lune]]>', '2024-01-01T00:00:00+00:00')
]);

test.beforeEach(() => { resetFeedCache(); resetQuotaMemory(); });

test('an Atom feed is parsed with regexes only: ids, decoded titles, per-entry or feed author, dates', () => {
  const items = parseFeed(sample);
  assert.equal(items.length, 4);
  assert.deepEqual(items[0], {id: 'UBEvvPNJL3s', title: "Pourquoi l’escargot est à la fois un mâle et femelle ? - C'est pas sorcier", channel: "C'est pas sorcier", published: Date.parse('2026-11-05T17:30:01+00:00')});
  assert.equal(items[1].channel, "C'est pas sorcier", 'feed author is used when the entry has none');
  assert.equal(items[3].title, 'Les dinosaures & la lune');
  assert.equal(parseFeed('<html>consent</html>'), null);
  assert.deepEqual(parseFeed(feed('Vide', [])), []);
});

test('matching ignores accents, case and stop words; ranking is by score, then language, then date, five at most', () => {
  assert.deepEqual(tokens('Les DINOSAURES de la Lune'), ['dinosaures', 'lune']);
  assert.equal(score('lune', 'Les phases de la LUNE'), 1);
  assert.equal(score('dinosaures', 'Un dinosaure géant'), 1, 'prefix match of four letters or more');
  assert.equal(score('lune', 'Les lunettes'), 1);
  assert.equal(score('lune', 'Un luxe'), 0);
  assert.equal(score('la lune et les dinosaures', 'Les dinosaures & la lune'), 2);
  assert.equal(score('éléphant', 'Elephant Song'), 1);
  assert.equal(score('la lune', 'NASA Moon Base update'), 1, 'known topics match their translation');
  assert.equal(score('dinosaurs', 'Les dinosaures géants'), 1);
  assert.equal(score('lune moon', 'Moon'), 2);
  assert.deepEqual(variants('lunes').sort(), ['lunes', 'moon']);
  const videos = parseFeed(sample).map(v => ({...v, lang: 'fr'}));
  videos.push({id: 'eeeeeeeeeee', title: 'Moon phases for kids', channel: 'SciShow Kids', published: Date.parse('2026-11-04T00:00:00Z'), lang: 'en'});
  videos.push({id: 'fffffffffff', title: 'La Lune', channel: 'Doublon', published: Date.parse('2026-10-20T10:00:00+00:00'), lang: 'en'});
  const ranked = rank('la lune et les dinosaures', videos, 'fr');
  assert.deepEqual(rank('lune', videos, 'en').map(v => v.id), ['eeeeeeeeeee', 'fffffffffff', 'shQJd3oGYn8', 'HPFXqqe971I', 'aaaaaaaaaaa'], 'English callers see English channels first at equal score');
  assert.deepEqual(ranked.map(v => v.id), ['aaaaaaaaaaa', 'shQJd3oGYn8', 'HPFXqqe971I', 'eeeeeeeeeee', 'fffffffffff'], 'score first, then the requested language, then recency');
  assert.deepEqual(Object.keys(ranked[0]), ['id', 'title', 'channel']);
  assert.deepEqual(rank('lune', [...videos, ...videos], 'fr').map(v => v.id), ['shQJd3oGYn8', 'HPFXqqe971I', 'aaaaaaaaaaa', 'eeeeeeeeeee', 'fffffffffff'], 'duplicates are dropped');
  const many = Array.from({length: 9}, (_, i) => ({id: 'v' + String(i).padStart(10, '0'), title: 'Lune ' + i, channel: 'c', published: i, lang: 'fr'}));
  assert.equal(rank('lune', many, 'fr').length, 5);
  assert.deepEqual(rank('les de', videos, 'fr'), [], 'only stop words: nothing to search');
  assert.deepEqual(rank('zèbre', videos, 'fr'), []);
});

test('each channel feed is fetched once per six hours, in memory and through KV when bound', async () => {
  const channel = {id: 'UCtest000000000000000000', name: 'Test', lang: 'fr'};
  let calls = 0;
  const fetcher = async (url, options) => { calls++; assert.equal(url, FEED_BASE + channel.id); assert.ok(options.signal); return new Response(sample, {status: 200}); };
  const first = await channelVideos(channel, {}, fetcher);
  assert.equal(first.length, 4); assert.equal(first[1].lang, 'fr');
  await channelVideos(channel, {}, fetcher);
  assert.equal(calls, 1);
  resetFeedCache();
  const kv = new Map();
  const env = {BEYBOO_KV: {get: async (k, type) => { const v = kv.get(k); return v && type === 'json' ? JSON.parse(v) : v ?? null; }, put: async (k, v, opts) => { assert.equal(opts.expirationTtl, 6 * 3600); kv.set(k, v); }}};
  await channelVideos(channel, env, fetcher);
  assert.equal(calls, 2); assert.ok(kv.has('videofeed:' + channel.id));
  resetFeedCache();
  const again = await channelVideos(channel, env, () => assert.fail('KV should have answered'));
  assert.equal(again.length, 4);
  assert.equal(await channelVideos({id: 'UCfail', name: 'x', lang: 'fr'}, {}, async () => new Response('nope', {status: 500})), null);
  assert.equal(await channelVideos({id: 'UCthrow', name: 'x', lang: 'fr'}, {}, async () => { throw Error('network'); }), null);
  assert.equal(await channelVideos({id: 'UChtml', name: 'x', lang: 'fr'}, {}, async () => new Response('<html></html>')), null);
});

test('a search spans every channel, tolerates failing feeds, and reports unavailable only when none answers', async () => {
  const channels = [{id: 'UCa', name: 'A', lang: 'fr'}, {id: 'UCb', name: 'B', lang: 'en'}, {id: 'UCc', name: 'C', lang: 'en'}];
  const fetcher = async url => {
    if (url.endsWith('UCa')) return new Response(sample);
    if (url.endsWith('UCb')) return new Response(feed('B', [entry('bbbbbbbbbbb', 'Moon landing for kids', '2026-11-01T00:00:00Z')]));
    return new Response(null, {status: 503});
  };
  const moon = await searchFeeds('moon', {lang: 'en', env: {}, fetcher, channels});
  assert.equal(moon.enabled, true); assert.equal(moon.source, 'feeds');
  assert.deepEqual(moon.items.map(v => v.id), ['bbbbbbbbbbb', 'shQJd3oGYn8', 'HPFXqqe971I', 'aaaaaaaaaaa'], 'English channel first for an English caller, then the French Lune titles by date');
  assert.deepEqual(moon.items[0], {id: 'bbbbbbbbbbb', title: 'Moon landing for kids', channel: 'B'});
  const none = await searchFeeds('girafe', {lang: 'fr', env: {}, fetcher, channels});
  assert.deepEqual(none, {enabled: true, items: [], source: 'feeds'});
  resetFeedCache();
  assert.equal(await searchFeeds('lune', {lang: 'fr', env: {}, fetcher: async () => new Response(null, {status: 503}), channels}), null);
});

test('the curated list has verified ids, both languages, and no duplicates', () => {
  assert.ok(CHANNELS.length >= 12);
  assert.equal(new Set(CHANNELS.map(c => c.id)).size, CHANNELS.length);
  for (const c of CHANNELS) { assert.match(c.id, /^UC[A-Za-z0-9_-]{22}$/); assert.ok(c.name); assert.ok(['fr', 'en'].includes(c.lang)); }
  assert.ok(CHANNELS.some(c => c.lang === 'fr') && CHANNELS.some(c => c.lang === 'en'));
});
