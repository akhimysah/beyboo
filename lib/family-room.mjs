/* Salle de famille : un Durable Object par code famille (identité serveur), jamais choisi par le client.
   - messages texte persistants (SQLite du Durable Object) ;
   - une connexion WebSocket par appareil : présence, nouveaux messages, sonnerie et signalisation d'appel (SDP/ICE relayés, jamais stockés).
   Le Worker vérifie l'identité avant de transmettre ; le Durable Object ne fait confiance qu'aux en-têtes x-beyboo-* posés par lui. */
import { sameSite } from './auth.mjs';
const MAX_TEXT = 1000, MAX_FRAME = 64 * 1024, HISTORY = 100, KEEP = 500;
const MEMBER = /^[a-f0-9]{16,32}$/, CALL = /^[a-zA-Z0-9_-]{8,64}$/;
const json = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});
const error = (code, message, status) => json({error: code, message}, status);

export function cleanName(value, fallback = 'Un proche') {
  const name = String(value || '').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ');
  return name && name.length <= 40 ? name : fallback;
}
export function cleanText(value) {
  const text = String(value ?? '').normalize('NFC').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();
  return text && text.length <= MAX_TEXT ? text : '';
}

export class FamilyRoom {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env; this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, member TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'text', body TEXT NOT NULL, created INTEGER NOT NULL)`);
  }
  member(request) { return {member: request.headers.get('x-beyboo-member') || '', name: cleanName(request.headers.get('x-beyboo-name') ? decodeURIComponent(request.headers.get('x-beyboo-name')) : '')}; }
  peers() {
    const seen = new Map();
    for (const ws of this.ctx.getWebSockets()) { const a = ws.deserializeAttachment() || {}; if (a.member && !seen.has(a.member)) seen.set(a.member, {member: a.member, name: a.name, call: a.call || null}); }
    return [...seen.values()];
  }
  broadcast(payload, except = null) {
    const text = JSON.stringify(payload);
    for (const ws of this.ctx.getWebSockets()) { if (ws === except) continue; try { ws.send(text); } catch { /* fermé entre-temps */ } }
  }
  sendTo(member, payload, except = null) {
    const text = JSON.stringify(payload); let sent = 0;
    for (const ws of this.ctx.getWebSockets('member:' + member)) { if (ws === except) continue; try { ws.send(text); sent++; } catch { /* ignoré */ } }
    return sent;
  }
  list(since = 0) {
    const rows = since > 0
      ? this.sql.exec('SELECT id, member, name, kind, body, created FROM messages WHERE id > ? ORDER BY id ASC LIMIT ?', since, HISTORY).toArray()
      : this.sql.exec('SELECT id, member, name, kind, body, created FROM messages ORDER BY id DESC LIMIT ?', HISTORY).toArray().reverse();
    return rows;
  }
  async fetch(request) {
    const url = new URL(request.url), {member, name} = this.member(request);
    if (!MEMBER.test(member)) return error('invalid_member', 'Appareil non identifié.', 400);
    if (url.pathname === '/api/room/socket') {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return error('upgrade_required', 'Connexion WebSocket attendue.', 426);
      const pair = new WebSocketPair(), [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server, ['member:' + member]);
      server.serializeAttachment({member, name, call: null, since: Date.now()});
      server.send(JSON.stringify({type: 'hello', member, name, peers: this.peers(), lastId: this.sql.exec('SELECT COALESCE(MAX(id),0) AS id FROM messages').one().id}));
      this.broadcast({type: 'presence', peers: this.peers()}, server);
      return new Response(null, {status: 101, webSocket: client});
    }
    if (url.pathname === '/api/room/peers' && request.method === 'GET') return json({peers: this.peers()});
    if (url.pathname === '/api/messages') {
      if (request.method === 'GET') return json({messages: this.list(Number(url.searchParams.get('since')) || 0)});
      if (request.method === 'POST') {
        let body; try { body = await request.json(); } catch { return error('invalid_json', 'Demande illisible.', 400); }
        const text = cleanText(body?.text);
        if (!text) return error('invalid_text', 'Écris un message de 1 à 1000 caractères.', 400);
        const kind = body?.kind === 'emoji' ? 'emoji' : 'text', created = Date.now();
        const id = this.sql.exec('INSERT INTO messages (member, name, kind, body, created) VALUES (?, ?, ?, ?, ?) RETURNING id', member, name, kind, text, created).one().id;
        this.sql.exec('DELETE FROM messages WHERE id <= (SELECT MAX(id) FROM messages) - ?', KEEP);
        const message = {id, member, name, kind, body: text, created};
        this.broadcast({type: 'message', message});
        return json({message}, 201);
      }
      return error('method_not_allowed', 'Méthode non autorisée.', 405);
    }
    const single = url.pathname.match(/^\/api\/messages\/(\d{1,12})$/);
    if (single && request.method === 'DELETE') {
      const id = Number(single[1]);
      const row = this.sql.exec('SELECT member FROM messages WHERE id = ?', id).toArray()[0];
      if (!row) return error('not_found', 'Message introuvable.', 404);
      this.sql.exec('DELETE FROM messages WHERE id = ?', id);
      this.broadcast({type: 'deleted', id, by: member});
      return json({deleted: id});
    }
    return error('not_found', 'Page introuvable.', 404);
  }
  webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_FRAME) return;
    let data; try { data = JSON.parse(raw); } catch { return; }
    if (!data || typeof data !== 'object') return;
    const a = ws.deserializeAttachment() || {};
    const from = {member: a.member, name: a.name};
    switch (data.type) {
      case 'ping': ws.send(JSON.stringify({type: 'pong', at: Date.now()})); return;
      case 'rename': { const name = cleanName(data.name, a.name); ws.serializeAttachment({...a, name}); this.broadcast({type: 'presence', peers: this.peers()}); return; }
      case 'typing': this.broadcast({type: 'typing', from, active: data.active !== false}, ws); return;
      /* Appels : la salle relaie, elle ne voit ni audio ni vidéo. */
      case 'ring': { if (!CALL.test(data.call || '')) return; ws.serializeAttachment({...a, call: data.call}); this.broadcast({type: 'ring', call: data.call, from}, ws); return; }
      case 'join': { if (!CALL.test(data.call || '')) return; ws.serializeAttachment({...a, call: data.call}); this.broadcast({type: 'peer-joined', call: data.call, from}, ws); ws.send(JSON.stringify({type: 'call-peers', call: data.call, peers: this.peers().filter(p => p.call === data.call && p.member !== a.member)})); return; }
      case 'leave': { const call = a.call; ws.serializeAttachment({...a, call: null}); if (call) this.broadcast({type: 'peer-left', call, from}, ws); return; }
      case 'signal': { if (!CALL.test(data.call || '') || !MEMBER.test(data.to || '') || data.payload === undefined) return; this.sendTo(data.to, {type: 'signal', call: data.call, from, payload: data.payload}); return; }
      default: return;
    }
  }
  webSocketClose(ws) { this.farewell(ws); }
  webSocketError(ws) { this.farewell(ws); }
  farewell(ws) {
    const a = ws.deserializeAttachment() || {};
    try { ws.close(); } catch { /* déjà fermé */ }
    if (a.call) this.broadcast({type: 'peer-left', call: a.call, from: {member: a.member, name: a.name}}, ws);
    this.broadcast({type: 'presence', peers: this.peers().filter(p => p.member !== a.member || this.ctx.getWebSockets('member:' + a.member).length > 1)}, ws);
  }
}

/* Côté Worker : identité vérifiée, appareil et nom validés, puis transmission à la salle de la famille. */
export async function handleRoomRequest(request, env, identity) {
  if (!env.FAMILY_ROOM) return error('not_configured', 'La salle de famille n’est pas configurée sur ce serveur.', 503);
  if (!identity?.userId) return json({error: 'sign_in_required', message: 'Entre le code famille pour accéder aux messages et aux appels.', signIn: identity?.signIn}, 401);
  const url = new URL(request.url);
  const member = (url.searchParams.get('member') || request.headers.get('x-beyboo-member') || '').toLowerCase();
  if (!MEMBER.test(member)) return error('invalid_member', 'Appareil non identifié.', 400);
  const name = cleanName(url.searchParams.get('name') ?? (request.headers.get('x-beyboo-name') ? decodeURIComponent(request.headers.get('x-beyboo-name')) : ''));
  if (request.method !== 'GET' && !sameSite(request, env)) return error('invalid_origin', 'Cette demande doit venir du site BEYBOO.', 403);
  const headers = new Headers(request.headers);
  headers.set('x-beyboo-member', member); headers.set('x-beyboo-name', encodeURIComponent(name));
  const stub = env.FAMILY_ROOM.get(env.FAMILY_ROOM.idFromName(identity.userId));
  return stub.fetch(new Request(request, {headers}));
}
