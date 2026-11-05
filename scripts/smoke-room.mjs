#!/usr/bin/env node
/* Test d'intégration de la salle de famille contre un Worker en marche (local ou déployé).
   Usage : node scripts/smoke-room.mjs [baseUrl] [codeFamille]
   Défauts : http://127.0.0.1:8787 et beyboo-test (le code de .dev.vars en local).
   Chaque étape affiche OK ou ÉCHEC ; le code de sortie vaut 1 dès qu'une étape échoue, 2 si le délai global (20 s) est dépassé.
   Node 22 ou plus récent (fetch et WebSocket intégrés), aucune dépendance. */
const base = (process.argv[2] || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const code = process.argv[3] || 'beyboo-test';
const wsBase = base.replace(/^http/, 'ws');
const TIMEOUT = 20000, STEP = 4000;
const A = 'a'.repeat(32), B = 'b'.repeat(32), C = 'c'.repeat(32);
const sockets = [];
let failed = 0;

const watchdog = setTimeout(() => { console.log('ÉCHEC  délai global de ' + TIMEOUT / 1000 + ' s dépassé'); finish(2); }, TIMEOUT);
function finish(exitCode) {
  clearTimeout(watchdog);
  for (const ws of sockets) { try { ws.close(1000); } catch { /* déjà fermé */ } }
  console.log(exitCode ? `\n${failed || 1} étape(s) en échec contre ${base}` : `\nTout est passé contre ${base}`);
  process.exit(exitCode);
}
const expect = (condition, message) => { if (!condition) throw Error(message); };
async function step(label, fn) {
  try { const detail = await fn(); console.log('OK     ' + label + (detail ? ' — ' + detail : '')); }
  catch (error) { failed++; console.log('ÉCHEC  ' + label + ' : ' + (error?.message || error)); finish(1); }
}

/* Une connexion par appareil : le journal garde tout ce que le serveur envoie. */
function open(member, name, cookie) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsBase}/api/room/socket?member=${member}&name=${encodeURIComponent(name)}`, cookie ? {headers: {cookie}} : undefined);
    ws.log = []; ws.waiters = [];
    ws.addEventListener('message', event => { const data = JSON.parse(event.data); ws.log.push(data); for (const w of ws.waiters.splice(0)) w(data); });
    ws.addEventListener('open', () => { sockets.push(ws); resolve(ws); });
    ws.addEventListener('error', () => reject(Error('connexion WebSocket refusée')));
  });
}
function waitFor(ws, predicate, label) {
  const found = ws.log.find(predicate);
  if (found) return Promise.resolve(found);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('rien reçu : ' + label)), STEP);
    const check = () => { const hit = ws.log.find(predicate); if (hit) { clearTimeout(timer); resolve(hit); } else ws.waiters.push(check); };
    ws.waiters.push(check);
  });
}
const settle = ms => new Promise(resolve => setTimeout(resolve, ms));
const types = ws => ws.log.map(m => m.type).join(', ');

let cookie = '';
const api = (path, options = {}, member = A, name = 'Papa') => fetch(base + path, {
  ...options,
  headers: {'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin', cookie, 'X-Beyboo-Member': member, 'X-Beyboo-Name': encodeURIComponent(name), ...(options.headers || {})}
});

console.log(`Salle de famille BEYBOO — ${base}\n`);

await step('santé /api/health', async () => {
  const response = await fetch(base + '/api/health', {signal: AbortSignal.timeout(STEP)});
  expect(response.ok, 'HTTP ' + response.status);
  const body = await response.json();
  expect(body.ok === true && body.room === true, 'salle absente : ' + JSON.stringify(body));
  expect(body.authMode === 'password', 'AUTH_MODE attendu password, reçu ' + body.authMode);
  return `version ${body.version}, voix ${body.voice ? 'configurée' : 'absente'}, recherche vidéo ${body.videoSearch ? 'configurée' : 'absente'}`;
});

await step('refus sans cookie (GET /api/messages → 401 et WebSocket refusé)', async () => {
  const response = await fetch(base + '/api/messages', {headers: {'X-Beyboo-Member': A}});
  expect(response.status === 401, 'HTTP ' + response.status);
  expect((await response.json()).error === 'sign_in_required', 'erreur inattendue');
  const refused = await open(A, 'Intrus').then(() => false, () => true);
  expect(refused, 'la WebSocket s’est ouverte sans code famille');
});

await step('connexion avec le code famille', async () => {
  const response = await fetch(base + '/api/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin'}, body: JSON.stringify({password: code})});
  const body = await response.text();
  expect(response.status !== 401, 'code famille refusé');
  expect(response.ok, 'HTTP ' + response.status + ' ' + body);
  const set = response.headers.get('set-cookie') || '';
  expect(set.startsWith('beyboo_session='), 'cookie beyboo_session absent');
  cookie = set.split(';')[0];
});

await step('appareil invalide refusé (400)', async () => {
  const response = await api('/api/messages', {}, 'pas-un-identifiant');
  expect(response.status === 400, 'HTTP ' + response.status);
});

let a, b, c;
await step('WebSocket A (Papa) : hello avec sa propre présence', async () => {
  a = await open(A, 'Papa', cookie);
  const hello = await waitFor(a, m => m.type === 'hello', 'hello');
  expect(hello.member === A && hello.name === 'Papa', 'identité renvoyée incorrecte');
  expect(hello.peers.some(p => p.member === A), 'A absent de ses propres pairs');
  expect(typeof hello.lastId === 'number', 'lastId manquant');
  return `lastId ${hello.lastId}`;
});

await step('WebSocket B (Beyboo) : A reçoit la présence de B', async () => {
  b = await open(B, 'Beyboo', cookie);
  const hello = await waitFor(b, m => m.type === 'hello', 'hello de B');
  expect(hello.peers.some(p => p.member === A) && hello.peers.some(p => p.member === B), 'B ne voit pas A et B');
  const presence = await waitFor(a, m => m.type === 'presence' && m.peers.some(p => p.member === B), 'presence avec B chez A');
  return presence.peers.map(p => p.name).join(' + ');
});

await step('WebSocket C (Mamie) : témoin qui ne doit pas recevoir les signaux privés', async () => {
  c = await open(C, 'Mamie', cookie);
  await waitFor(c, m => m.type === 'hello', 'hello de C');
  await waitFor(a, m => m.type === 'presence' && m.peers.some(p => p.member === C), 'presence avec C chez A');
});

const text = 'Coucou depuis smoke-room ' + new Date().toISOString();
let messageId = 0;
await step('POST /api/messages puis diffusion à tous', async () => {
  const response = await api('/api/messages', {method: 'POST', body: JSON.stringify({text})});
  const body = await response.text();
  expect(response.status === 201, 'HTTP ' + response.status + ' ' + body);
  const {message} = JSON.parse(body);
  expect(message.body === text && message.member === A && message.name === 'Papa', 'message renvoyé incorrect');
  messageId = message.id;
  for (const [ws, who] of [[a, 'A'], [b, 'B'], [c, 'C']]) {
    const got = await waitFor(ws, m => m.type === 'message' && m.message.id === messageId, 'message chez ' + who);
    expect(got.message.body === text, 'texte altéré chez ' + who);
  }
  return `id ${messageId}`;
});

await step('GET /api/messages contient le message (et ?since= le filtre)', async () => {
  const all = await (await api('/api/messages')).json();
  expect(all.messages.some(m => m.id === messageId && m.body === text), 'message absent de l’historique');
  const since = await (await api('/api/messages?since=' + messageId)).json();
  expect(!since.messages.some(m => m.id === messageId), '?since= renvoie encore le message');
  return `${all.messages.length} message(s) dans l’historique`;
});

await step('GET /api/room/peers liste les trois appareils', async () => {
  const {peers} = await (await api('/api/room/peers')).json();
  for (const member of [A, B, C]) expect(peers.some(p => p.member === member), 'appareil manquant');
  return peers.map(p => p.name).join(', ');
});

const callId = 'smoke_' + Date.now().toString(36);
await step('ring : B sonne, A et C reçoivent, pas B', async () => {
  b.send(JSON.stringify({type: 'ring', call: callId}));
  const ring = await waitFor(a, m => m.type === 'ring' && m.call === callId, 'ring chez A');
  expect(ring.from.member === B && ring.from.name === 'Beyboo', 'expéditeur incorrect');
  await waitFor(c, m => m.type === 'ring' && m.call === callId, 'ring chez C');
  await settle(150);
  expect(!b.log.some(m => m.type === 'ring'), 'B a reçu sa propre sonnerie');
});

await step('signal : relayé uniquement au destinataire (A), ni B ni C', async () => {
  const payload = {sdp: 'v=0 smoke', at: Date.now()};
  b.send(JSON.stringify({type: 'signal', call: callId, to: A, payload}));
  const signal = await waitFor(a, m => m.type === 'signal' && m.call === callId, 'signal chez A');
  expect(JSON.stringify(signal.payload) === JSON.stringify(payload), 'charge utile altérée');
  expect(signal.from.member === B, 'expéditeur incorrect');
  await settle(200);
  expect(!b.log.some(m => m.type === 'signal'), 'B a reçu le signal');
  expect(!c.log.some(m => m.type === 'signal'), 'C a reçu le signal destiné à A');
});

await step('join : A rejoint l’appel et reçoit call-peers avec B', async () => {
  a.send(JSON.stringify({type: 'join', call: callId}));
  const peers = await waitFor(a, m => m.type === 'call-peers' && m.call === callId, 'call-peers chez A');
  expect(peers.peers.some(p => p.member === B) && !peers.peers.some(p => p.member === A), 'liste des participants incorrecte');
  await waitFor(b, m => m.type === 'peer-joined' && m.from.member === A, 'peer-joined chez B');
});

await step('DELETE /api/messages/:id puis diffusion « deleted »', async () => {
  const response = await api('/api/messages/' + messageId, {method: 'DELETE'});
  expect(response.ok, 'HTTP ' + response.status);
  await waitFor(a, m => m.type === 'deleted' && m.id === messageId, 'deleted chez A');
  const after = await (await api('/api/messages')).json();
  expect(!after.messages.some(m => m.id === messageId), 'le message existe encore');
});

await step('fermeture de B : A reçoit peer-left puis une présence sans B', async () => {
  b.close(1000);
  const left = await waitFor(a, m => m.type === 'peer-left' && m.call === callId, 'peer-left chez A');
  expect(left.from.member === B, 'mauvais appareil parti');
  await waitFor(a, m => m.type === 'presence' && !m.peers.some(p => p.member === B) && m.peers.some(p => p.member === A), 'presence sans B chez A');
  return 'A a reçu : ' + types(a);
});

finish(0);
