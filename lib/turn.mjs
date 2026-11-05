/* Serveurs ICE pour les appels entre appareils de la famille.
   Sans identifiants Cloudflare Calls (TURN_KEY_ID + TURN_KEY_API_TOKEN), seuls les serveurs STUN publics sont renvoyés :
   l'appel reste pair-à-pair et échoue honnêtement quand deux réseaux ne se joignent pas. */
export const STUN_SERVERS = Object.freeze([{urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302']}]);
const TTL_SECONDS = 86400, CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

const json = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});

/* Cloudflare renvoie soit un tableau d'iceServers, soit un objet unique (ancien point d'accès) : les deux formes sont acceptées. */
function normalise(servers) {
  const list = Array.isArray(servers) ? servers : servers && typeof servers === 'object' ? [servers] : [];
  return list.filter(server => server && (typeof server.urls === 'string' || Array.isArray(server.urls)) && (Array.isArray(server.urls) ? server.urls.length : true))
    .map(server => ({urls: server.urls, ...(server.username ? {username: server.username} : {}), ...(server.credential ? {credential: server.credential} : {})}));
}

export async function fetchTurnServers(env, fetcher = fetch, now = Date.now()) {
  const keyId = String(env.TURN_KEY_ID || '').trim(), token = String(env.TURN_KEY_API_TOKEN || '').trim();
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(keyId) || !token) return null;
  const cached = cache.get(keyId);
  if (cached && cached.expires > now) return cached.servers;
  const response = await fetcher(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
    body: JSON.stringify({ttl: TTL_SECONDS}),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error('turn_upstream_' + response.status);
  const data = await response.json();
  const servers = normalise(data?.iceServers);
  if (!servers.some(server => [].concat(server.urls).some(url => /^turns?:/.test(url)))) throw new Error('turn_missing');
  cache.set(keyId, {servers, expires: now + CACHE_MS});
  return servers;
}

export function clearTurnCache() { cache.clear(); }

export async function handleTurnRequest(request, env = {}, identity, fetcher = fetch) {
  if (request.method !== 'GET') return json({error: 'method_not_allowed', message: 'Méthode non autorisée.'}, 405);
  if (!identity?.userId) return json({error: 'sign_in_required', message: 'Entre le code famille pour passer un appel.', signIn: identity?.signIn}, 401);
  let turn = null;
  try { turn = await fetchTurnServers(env, fetcher); } catch { turn = null; }
  if (turn) {
    const hasStun = turn.some(server => [].concat(server.urls).some(url => /^stun:/.test(url)));
    return json({iceServers: hasStun ? turn : [...STUN_SERVERS, ...turn], turn: true});
  }
  return json({iceServers: [...STUN_SERVERS], turn: false});
}
