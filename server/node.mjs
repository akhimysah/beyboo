/* Serveur Node.js de BOOZZO pour un VPS (Ubuntu + systemd + Caddy).
   Mêmes routes que worker/standalone.mjs : fichiers de public/, /api/*, salle de famille (messages + signalisation).
   La salle réutilise lib/family-room.mjs avec SQLite (node:sqlite) et le paquet ws à la place du Durable Object. */
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { WebSocketServer } from 'ws';
import { FamilyRoom, cleanName, handleRoomRequest } from '../lib/family-room.mjs';
import { searchVideos, videoSearchMode } from '../lib/video-search.mjs';
import { weatherRequest } from '../lib/weather.mjs';
import { handleVoiceRequest } from '../lib/voice-api.mjs';
import { handleAuthRequest, identify, sanitizeRequest } from '../lib/auth.mjs';
import { securityHeaders } from '../lib/security-headers.mjs';
import { handleTurnRequest } from '../lib/turn.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const APP_VERSION = '38';

/* ---------- configuration : .env à la racine (ou ENV_FILE), sans écraser l'environnement du service ---------- */
const envFile = process.env.ENV_FILE || path.join(ROOT, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
/* Copie : process.env transforme toute valeur en chaîne, or la salle est un objet. */
const env = {...process.env};
const PORT = Number(env.PORT) || 8080, HOST = env.HOST || '127.0.0.1';
const DATA_DIR = env.DATA_DIR || path.join(ROOT, 'data');
mkdirSync(path.join(DATA_DIR, 'rooms'), {recursive: true});

/* ---------- salle de famille : FamilyRoom + contexte Node (SQLite, sockets ws) ---------- */
class NodeContext {
  constructor(file) {
    const db = new DatabaseSync(file);
    this.sockets = new Map(); // ws -> tags
    this.storage = {sql: {exec: (query, ...params) => { const rows = db.prepare(query).all(...params); return {toArray: () => rows, one: () => rows[0]}; }}};
  }
  acceptWebSocket(ws, tags = []) {
    ws.serializeAttachment = value => { ws._attachment = value; };
    ws.deserializeAttachment = () => ws._attachment;
    this.sockets.set(ws, tags);
  }
  getWebSockets(tag) { return [...this.sockets].filter(([, tags]) => !tag || tags.includes(tag)).map(([ws]) => ws); }
  forget(ws) { this.sockets.delete(ws); }
}
class NodeRoom extends FamilyRoom {
  constructor(file) { super(new NodeContext(file), env); }
  accept(ws, member, name) {
    this.ctx.acceptWebSocket(ws, ['member:' + member]);
    ws.serializeAttachment({member, name, call: null, since: Date.now()});
    ws.send(JSON.stringify({type: 'hello', member, name, peers: this.peers(), lastId: this.sql.exec('SELECT COALESCE(MAX(id),0) AS id FROM messages').one().id}));
    this.broadcast({type: 'presence', peers: this.peers()}, ws);
    ws.on('message', data => { try { this.webSocketMessage(ws, data.toString()); } catch (error) { console.error('room message', error); } });
    const bye = () => { if (!this.ctx.sockets.has(ws)) return; this.ctx.forget(ws); try { this.webSocketClose(ws); } catch (error) { console.error('room close', error); } };
    ws.on('close', bye); ws.on('error', bye);
  }
}
const rooms = new Map();
function roomFor(userId) {
  if (!rooms.has(userId)) rooms.set(userId, new NodeRoom(path.join(DATA_DIR, 'rooms', createHash('sha256').update(userId).digest('hex').slice(0, 32) + '.sqlite')));
  return rooms.get(userId);
}
env.FAMILY_ROOM = {idFromName: name => name, get: id => roomFor(id)};

/* ---------- /api ---------- */
const json = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});
async function apiRoute(request) {
  const pathname = new URL(request.url).pathname;
  if (pathname === '/api/health') return json({ok: true, version: APP_VERSION, runtime: 'node', voice: !!env.OPENAI_API_KEY, videoSearch: videoSearchMode(env), authMode: env.AUTH_MODE || 'chatgpt', room: true});
  if (pathname === '/api/videos/search') return searchVideos(request, env);
  if (pathname === '/api/weather') return weatherRequest(request, fetch, env);
  if (pathname.startsWith('/api/voice/')) return handleVoiceRequest(request, env);
  if (pathname.startsWith('/api/auth/')) return handleAuthRequest(request, env);
  if (pathname === '/api/calls/turn') return handleTurnRequest(request, env, await identify(request, env));
  if (pathname === '/api/messages' || pathname.startsWith('/api/messages/') || pathname.startsWith('/api/room/') || pathname.startsWith('/api/calls/')) {
    return handleRoomRequest(request, env, await identify(request, env));
  }
  return json({error: 'not_found', message: 'Page introuvable.'}, 404);
}

/* ---------- conversion requête Node ⇄ Request/Response ---------- */
const proto = req => String(req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http')).split(',')[0].trim();
function readBody(req, limit = 250_000) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', chunk => { size += chunk.length; if (size > limit) { reject(Error('too_large')); req.destroy(); } else chunks.push(chunk); });
    req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject);
  });
}
async function toRequest(req) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : String(value));
  const url = proto(req) + '://' + (req.headers.host || 'localhost') + req.url;
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
  return new Request(url, {method: req.method, headers, body});
}
async function sendResponse(res, response, extra = {}) {
  const headers = {};
  response.headers.forEach((value, name) => { headers[name] = value; });
  for (const [name, value] of Object.entries(extra)) if (!(name.toLowerCase() in Object.fromEntries(Object.keys(headers).map(k => [k.toLowerCase(), 1])))) headers[name] = value;
  const body = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, headers); res.end(body);
}

/* ---------- fichiers statiques de public/ ---------- */
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.wasm': 'application/wasm', '.pdf': 'application/pdf', '.bin': 'application/octet-stream'};
function serveStatic(req, res, pathname) {
  let decoded; try { decoded = decodeURIComponent(pathname); } catch { return notFound(res); }
  if (decoded === '/') decoded = '/index.html';
  const file = path.normalize(path.join(PUBLIC, decoded));
  if (!file.startsWith(PUBLIC + path.sep) || path.basename(file).startsWith('_')) return notFound(res);
  let stat; try { stat = statSync(file); } catch { return notFound(res); }
  if (!stat.isFile()) return notFound(res);
  const etag = '"' + createHash('sha1').update(stat.mtimeMs + ':' + stat.size).digest('hex').slice(0, 20) + '"';
  const headers = {...securityHeaders(env, {api: false}), 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', ETag: etag, 'Accept-Ranges': 'bytes',
    'Cache-Control': decoded.startsWith('/vendor/') ? 'public, max-age=2592000, immutable' : decoded.startsWith('/assets/') ? 'public, max-age=604800, stale-while-revalidate=86400' : 'no-cache'};
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  let start = 0, end = stat.size - 1, status = 200;
  if (range && stat.size > 0) {
    start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2]));
    end = range[1] && range[2] ? Math.min(Number(range[2]), stat.size - 1) : end;
    if (start > end || start >= stat.size) { res.writeHead(416, {...headers, 'Content-Range': 'bytes */' + stat.size}); return res.end(); }
    status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
  }
  headers['Content-Length'] = end - start + 1;
  res.writeHead(status, headers);
  if (req.method === 'HEAD') return res.end();
  createReadStream(file, {start, end}).on('error', () => res.destroy()).pipe(res);
}
function notFound(res) { res.writeHead(404, {...securityHeaders(env, {api: false}), 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'}); res.end('Page introuvable.'); }

/* ---------- serveur ---------- */
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/')) {
      const request = sanitizeRequest(await toRequest(req), env);
      const response = await apiRoute(request);
      return await sendResponse(res, response, securityHeaders(env, {api: true}));
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, {Allow: 'GET, HEAD'}); return res.end(); }
    return serveStatic(req, res, pathname);
  } catch (error) {
    console.error(req.method, req.url, error);
    if (!res.headersSent) res.writeHead(error.message === 'too_large' ? 413 : 500, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({error: error.message === 'too_large' ? 'too_large' : 'server_error', message: 'Le serveur BOOZZO a rencontré une erreur.'}));
  }
});
const wss = new WebSocketServer({noServer: true, maxPayload: 64 * 1024});
server.on('upgrade', async (req, socket, head) => {
  const refuse = (code, text) => { socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\n\r\n`); socket.destroy(); };
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/room/socket') return refuse(404, 'Not Found');
    const request = sanitizeRequest(await toRequest(req), env);
    const identity = await identify(request, env);
    if (!identity.userId) return refuse(401, 'Unauthorized');
    const member = (url.searchParams.get('member') || '').toLowerCase();
    if (!/^[a-f0-9]{16,32}$/.test(member)) return refuse(400, 'Bad Request');
    const name = cleanName(url.searchParams.get('name') || '');
    wss.handleUpgrade(req, socket, head, ws => roomFor(identity.userId).accept(ws, member, name));
  } catch (error) { console.error('upgrade', error); refuse(500, 'Internal Server Error'); }
});
server.listen(PORT, HOST, () => console.log(`BOOZZO v${APP_VERSION} (Node ${process.version}) sur http://${HOST}:${PORT} · identité ${env.AUTH_MODE || 'chatgpt'} · voix ${env.OPENAI_API_KEY ? 'oui' : 'non'} · vidéos ${videoSearchMode(env)}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); });
