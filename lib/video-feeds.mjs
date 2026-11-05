/* Keyless video search: the public Atom feeds of a hand-picked set of children's and educational channels.
   Each feed lists the channel's latest videos (about 15). No Google quota is consumed on this path.
   Channel ids were verified on 2026-11-05 by fetching every feed; the name is the one the feed reported. */
import { consume } from './quota.mjs';

export const CHANNELS = [
  // French
  {id: 'UCENv8pH4LkzvuSV_qHIcslg', name: "C'est pas sorcier", lang: 'fr'},
  {id: 'UCMsbW8TRs5i3R8K7Z9fUIXw', name: 'Il était une fois... (Hello Maestro)', lang: 'fr'},
  {id: 'UCR9raBqPQisip_qnuCaUL1w', name: 'Lumni', lang: 'fr'},
  {id: 'UC8I-UIlXPNS4luC4iV7dRdQ', name: 'Titounis - Comptine bébé - Chanson enfant', lang: 'fr'},
  {id: 'UCG9G2dyRv04FDSH1FSYuLBg', name: 'Jamy - Epicurieux', lang: 'fr'},
  {id: 'UCaNlbnghtwlsGF-KzAFThqA', name: 'ScienceEtonnante', lang: 'fr'},
  // English
  {id: 'UCIBaDdAbGlFDeS33shmlD0A', name: 'European Space Agency, ESA', lang: 'en'},
  {id: 'UCoookXUzPciGrEZEXmh4Jjg', name: 'Sesame Street', lang: 'en'},
  {id: 'UCRFIPG2u1DxKLNuE3y2SjHA', name: 'SciShow Kids', lang: 'en'},
  {id: 'UCXVCgDuD_QCkI7gTKU7-tpg', name: 'Nat Geo Kids', lang: 'en'},
  {id: 'UCB7u3w8o8Tu8ve1LBfIvtkA', name: 'Peekaboo Kidz', lang: 'en'},
  {id: 'UCsXVk37bltHxD1rDPwtNM8Q', name: 'Kurzgesagt – In a Nutshell', lang: 'en'},
  {id: 'UCsooa4yRKGN_zEE8iknghZA', name: 'TED-Ed', lang: 'en'},
  {id: 'UCLA_DiR1FfKNvjuUpBHmylQ', name: 'NASA', lang: 'en'},
  {id: 'UCeiYXex_fwgYDonaTcSIk6w', name: 'MinuteEarth', lang: 'en'}
];

export const FEED_BASE = 'https://www.youtube.com/feeds/videos.xml?channel_id=';
export const CACHE_SECONDS = 6 * 3600;
const MAX_RESULTS = 5;
const memory = new Map();
const STOP = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'en', 'au', 'aux', 'sur', 'pour', 'avec', 'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'for', 'about', 'video', 'videos', 'youtube']);

const decode = text => String(text).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, code) => {
    if (code[0] === '#') return String.fromCodePoint(parseInt(code[1] === 'x' || code[1] === 'X' ? code.slice(2) : code.slice(1), code[1] === 'x' || code[1] === 'X' ? 16 : 10));
    return {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'"}[code.toLowerCase()];
  }).trim();
const tag = (xml, name) => { const m = xml.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>')); return m ? decode(m[1]) : ''; };

/* Accent- and case-insensitive words of a text. */
export function normalize(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ');
}
export const words = text => normalize(text).split(/[^a-z0-9]+/).filter(Boolean);
export const tokens = query => [...new Set(words(query).filter(w => w.length > 1 && !STOP.has(w)))];

/* Atom feed → [{id,title,channel,published}]; entries without a valid video id or title are dropped. */
export function parseFeed(xml) {
  const text = String(xml || '');
  if (!/<feed[\s>]/.test(text)) return null;
  const feedAuthor = tag(tag(text.split('<entry')[0], 'author'), 'name');
  const items = [];
  for (const entry of text.split(/<entry(?:\s[^>]*)?>/).slice(1)) {
    const body = entry.split('</entry>')[0];
    const id = tag(body, 'yt:videoId');
    const title = tag(body, 'title');
    if (!/^[A-Za-z0-9_-]{11}$/.test(id) || !title) continue;
    const published = Date.parse(tag(body, 'published')) || 0;
    items.push({id, title, channel: tag(tag(body, 'author'), 'name') || feedAuthor, published});
  }
  return items;
}

/* Children's topics in both languages, so « lune » also finds the English Moon videos and vice versa (accent-free). */
const PAIRS = [['lune', 'moon'], ['dinosaure', 'dinosaur'], ['soleil', 'sun'], ['espace', 'space'], ['planete', 'planet'], ['terre', 'earth'], ['etoile', 'star'],
  ['fusee', 'rocket'], ['astronaute', 'astronaut'], ['galaxie', 'galaxy'], ['comete', 'comet'], ['saturne', 'saturn'], ['gravite', 'gravity'], ['lumiere', 'light'],
  ['volcan', 'volcano'], ['ocean', 'ocean'], ['mer', 'sea'], ['eau', 'water'], ['pluie', 'rain'], ['neige', 'snow'], ['nuage', 'cloud'], ['vent', 'wind'], ['orage', 'storm'],
  ['glace', 'ice'], ['feu', 'fire'], ['foret', 'forest'], ['arbre', 'tree'], ['fleur', 'flower'], ['animal', 'animal'], ['animaux', 'animals'], ['requin', 'shark'],
  ['baleine', 'whale'], ['chat', 'cat'], ['chien', 'dog'], ['oiseau', 'bird'], ['insecte', 'insect'], ['abeille', 'bee'], ['fourmi', 'ant'], ['papillon', 'butterfly'],
  ['corps', 'body'], ['cerveau', 'brain'], ['coeur', 'heart'], ['dent', 'tooth'], ['dents', 'teeth'], ['couleur', 'color'], ['musique', 'music'], ['chanson', 'song'],
  ['comptine', 'nursery'], ['nombre', 'number'], ['histoire', 'history'], ['chateau', 'castle'], ['chevalier', 'knight'], ['train', 'train'], ['voiture', 'car'],
  ['avion', 'plane'], ['bateau', 'boat'], ['robot', 'robot'], ['dragon', 'dragon'], ['pirate', 'pirate'], ['tremblement', 'earthquake'], ['escargot', 'snail']];
const similar = (a, b) => a === b || (a.length > 3 && b.length > 3 && (a.startsWith(b) || b.startsWith(a)));
/* The spellings a query token may take in a title: itself, plus its translation when it is a known topic. */
export function variants(token) {
  const out = new Set([token]);
  for (const [fr, en] of PAIRS) { if (similar(token, fr)) out.add(en); if (similar(token, en)) out.add(fr); }
  return [...out];
}
/* A token matches a title word exactly, or by prefix once both are at least four letters (lune/lunes, dinosaure/dinosaures). */
function matches(token, titleWords) {
  return variants(token).some(v => titleWords.some(w => similar(w, v)));
}
export function score(query, title) {
  const list = tokens(query), titleWords = words(title);
  return list.reduce((n, token) => n + (matches(token, titleWords) ? 1 : 0), 0);
}

/* Rank every known video for the query: score, then language preference, then recency. */
export function rank(query, videos, lang = 'fr', limit = MAX_RESULTS) {
  if (!tokens(query).length) return [];
  const seen = new Set(), scored = [];
  for (const video of videos) {
    if (seen.has(video.id)) continue;
    const s = score(query, video.title);
    if (s > 0) { seen.add(video.id); scored.push({video, s}); }
  }
  scored.sort((a, b) => b.s - a.s || Number(b.video.lang === lang) - Number(a.video.lang === lang) || b.video.published - a.video.published);
  return scored.slice(0, limit).map(({video}) => ({id: video.id, title: video.title, channel: video.channel}));
}

async function readKv(env, key) { try { return await env.BEYBOO_KV.get(key, 'json'); } catch { return null; } }
async function writeKv(env, key, value) { try { await env.BEYBOO_KV.put(key, JSON.stringify(value), {expirationTtl: CACHE_SECONDS}); } catch { /* caching must never break the search */ } }
const hasKv = env => env?.BEYBOO_KV && typeof env.BEYBOO_KV.get === 'function' && typeof env.BEYBOO_KV.put === 'function';

/* Latest videos of one channel, cached 6 h in memory and in KV when bound. Returns null when the feed cannot be read. */
export async function channelVideos(channel, env = {}, fetcher = fetch) {
  const key = 'videofeed:' + channel.id;
  const hit = memory.get(key);
  if (hit && hit.expires > Date.now()) return hit.items;
  memory.delete(key);
  if (hasKv(env)) {
    const stored = await readKv(env, key);
    if (stored && Array.isArray(stored.items) && stored.expires > Date.now()) { memory.set(key, stored); return stored.items; }
  }
  try {
    const response = await fetcher(FEED_BASE + channel.id, {headers: {accept: 'application/atom+xml, application/xml'}, signal: AbortSignal.timeout(6000)});
    if (!response.ok) return null;
    const parsed = parseFeed(await response.text());
    if (!parsed) return null;
    const items = parsed.map(item => ({...item, channel: item.channel || channel.name, lang: channel.lang}));
    const entry = {items, expires: Date.now() + CACHE_SECONDS * 1000};
    memory.set(key, entry);
    if (hasKv(env)) await writeKv(env, key, entry);
    return items;
  } catch { return null; }
}

/* {enabled:true, items, source:'feeds'} — or null when not a single feed could be read. */
export async function searchFeeds(query, {lang = 'fr', env = {}, fetcher = fetch, channels = CHANNELS} = {}) {
  const feeds = await Promise.all(channels.map(channel => channelVideos(channel, env, fetcher)));
  const available = feeds.filter(Array.isArray);
  if (!available.length) return null;
  return {enabled: true, items: rank(query, available.flat(), lang), source: 'feeds'};
}

/* A light per-visitor limit; feeds are free, so it only keeps a runaway client in check. */
export async function reserveFeedSearch(env, userId) {
  return consume(env, 'videofeeds:user:' + userId, 120, 86400);
}

/* Tests only. */
export function resetFeedCache() { memory.clear(); }
