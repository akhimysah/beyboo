import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = await readFile(new URL('../public/call.js', import.meta.url), 'utf8');
const A = 'a'.repeat(32), B = 'b'.repeat(32), C = 'c'.repeat(32);

class Element {
  hidden = false; dataset = {}; value = ''; textContent = ''; attrs = {}; children = []; listeners = {}; disabled = false; parent = null;
  classList = {
    values: new Set(),
    add(...names) { names.forEach(n => this.values.add(n)); },
    remove(...names) { names.forEach(n => this.values.delete(n)); },
    contains(name) { return this.values.has(name); },
    toggle(name, value) { value ? this.add(name) : this.remove(name); }
  };
  constructor(tag = 'div') { this.tag = tag; }
  get className() { return [...this.classList.values].join(' '); }
  set className(value) { this.classList.values = new Set(String(value).split(/\s+/).filter(Boolean)); }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  click() { return this.listeners.click?.({}); }
  setAttribute(k, v) { this.attrs[k] = v; }
  append(...nodes) { for (const n of nodes) { this.children.push(n); n.parent = this; } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.removed = true; this.parent = null; }
  focus() { this.focused = true; }
  select() { this.selected = true; }
  play() { return this.playResult || Promise.resolve(); }
  find(predicate) { for (const c of this.children) { if (predicate(c)) return c; const deep = c.find(predicate); if (deep) return deep; } return null; }
  all(predicate, out = []) { for (const c of this.children) { if (predicate(c)) out.push(c); c.all(predicate, out); } return out; }
}
class Track { constructor(kind) { this.kind = kind; this.enabled = true; this.readyState = 'live'; } stop() { this.readyState = 'ended'; this.stopped = true; } }
class MediaStream {
  constructor(tracks = []) { this.tracks = [...tracks]; }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
  addTrack(track) { this.tracks.push(track); }
}
class Channel {
  readyState = 'connecting'; sent = [];
  constructor(label) { this.label = label; }
  send(text) { this.sent.push(text); }
  close() { this.readyState = 'closed'; this.onclose?.(); }
  open() { this.readyState = 'open'; this.onopen?.(); }
}
class PeerConnection {
  tracks = []; candidates = []; channels = []; signalingState = 'stable'; iceConnectionState = 'new'; connectionState = 'new'; localDescription = null; remoteDescription = null; closed = false; restarts = 0;
  constructor(config) { this.config = config; }
  addTrack(track, stream) { this.tracks.push({track, stream}); }
  createDataChannel(label) { const channel = new Channel(label); this.channels.push(channel); return channel; }
  async setLocalDescription(description) {
    if (!description) description = this.signalingState === 'have-remote-offer' ? {type: 'answer', sdp: 'answer-from-' + this.id} : {type: 'offer', sdp: 'offer-from-' + this.id};
    this.localDescription = description;
    this.signalingState = description.type === 'offer' ? 'have-local-offer' : 'stable';
  }
  async setRemoteDescription(description) {
    this.remoteDescription = description;
    this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable';
  }
  async addIceCandidate(candidate) { if (!this.remoteDescription) throw new Error('no remote description'); this.candidates.push(candidate); }
  restartIce() { this.restarts++; }
  close() { this.closed = true; this.iceConnectionState = 'closed'; }
  ice(state) { this.iceConnectionState = state; this.oniceconnectionstatechange?.(); }
}

function harness({ member = A, media = 'av', secure = true, app = true, search = '?app=1', authenticated = true, signIn = {kind: 'password', url: '/api/auth/login'}, family = null, showMode = null, turn = {iceServers: [{urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302']}], turn: false} } = {}) {
  const pcs = [];
  class PC extends PeerConnection { constructor(config) { super(config); pcs.push(this); } }
  const elements = new Map();
  const el = id => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
  const scheduled = new Map(); let nextTimer = 0;
  const setTimer = (callback, delay) => { const id = ++nextTimer; scheduled.set(id, {callback, delay}); return id; };
  const fire = predicate => { for (const [id, {callback, delay}] of [...scheduled]) if (predicate(delay)) { scheduled.delete(id); callback(); } };
  const handlers = new Map();
  const room = {
    sent: [], connected: 0, logins: [], state: 'closed',
    member: () => member, name: () => 'Moi', status: () => room.state, hello: () => null,
    connect() { room.connected++; room.state = 'open'; },
    disconnect() {},
    send(obj) { room.sent.push(obj); return room.state === 'open'; },
    on(type, fn) { if (!handlers.has(type)) handlers.set(type, new Set()); handlers.get(type).add(fn); return () => handlers.get(type).delete(fn); },
    off() {},
    api: async path => path === '/api/calls/turn' ? {ok: true, data: turn} : {ok: false, data: null},
    signedIn: async () => ({authenticated, mode: 'password', signIn}),
    login: async password => { room.logins.push(password); return password === 'beyboo-test' ? {ok: true, message: ''} : {ok: false, message: 'Code d’accès incorrect.'}; }
  };
  const emit = (type, data) => { for (const fn of handlers.get(type) || []) fn(data); };
  const window = {
    isSecureContext: secure, RTCPeerConnection: PC, MediaStream, events: {},
    addEventListener(name, callback) { this.events[name] = callback; },
    BeybooRoom: room, BeybooFamily: family, showMode
  };
  const calls = [];
  const navigator = {
    clipboard: { writeText: async text => { navigator.copied = text; } },
    mediaDevices: media === 'missing' ? undefined : {
      async getUserMedia(constraints) {
        calls.push(constraints);
        if (media === 'none') throw new Error('NotAllowedError');
        if (constraints.video && media === 'audio') throw new Error('NotFoundError');
        return new MediaStream(constraints.video ? [new Track('audio'), new Track('video')] : [new Track('audio')]);
      }
    }
  };
  const documentElement = { lang: 'fr', classList: { contains: name => name === 'beyboo-app' && app } };
  const docListeners = {};
  const document = {
    documentElement, readyState: 'complete', body: new Element('body'),
    getElementById: el,
    querySelector: selector => selector === '.experience-card' ? el('card') : null,
    createElement: tag => new Element(tag),
    addEventListener: (name, fn) => { docListeners[name] = fn; }
  };
  const location = { href: 'http://127.0.0.1:8787/index.html' + search, search, pathname: '/index.html', hash: '', hostname: '127.0.0.1' };
  const history = { state: null, replaced: [], replaceState(state, title, url) { this.replaced.push(url); } };
  el('call-panel').hidden = el('call-stage').hidden = el('call-signin').hidden = true;   // as in index.html
  const errors = [];
  const consoleStub = { error: (...args) => errors.push(args), log() {}, warn() {} };
  vm.runInNewContext(source, {
    window, document, navigator, location, history, crypto: webcrypto, console: consoleStub,
    URL, URLSearchParams, Uint8Array, Map, Set, Promise, Date, JSON, String, Array, Object, Error, AbortSignal,
    RTCPeerConnection: PC, MediaStream,
    matchMedia: () => ({matches: false}),
    setTimeout: setTimer, setInterval: setTimer, clearTimeout: id => scheduled.delete(id), clearInterval: id => scheduled.delete(id)
  });
  return { window, document, navigator, room, emit, el, scheduled, fire, calls, errors, history, pcs, docListeners };
}
const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(resolve => setImmediate(resolve)); };
const hello = (h, peers) => h.emit('hello', {member: h.room.member(), name: 'Moi', peers, lastId: 0});
const peerRows = h => h.el('call-peers').children.filter(c => c.tag === 'div');
const callButton = row => row.children.find(c => c.tag === 'button');

test('app mode joins the family room at load, lists online relatives and hides the sign-in form', async () => {
  const h = harness();
  await flush();
  assert.equal(h.room.connected, 1, 'connects once signed in');
  h.window.BeybooCall.enter();
  assert.equal(h.el('call-signin').hidden, true);
  hello(h, [{member: A, name: 'Moi', call: null}, {member: B, name: 'Mamie', call: null}, {member: C, name: 'Papi', call: 'x'.repeat(12)}]);
  const rows = peerRows(h);
  assert.deepEqual(rows.map(r => r.dataset.member), [B, C], 'the local device is not listed');
  assert.equal(callButton(rows[0]).disabled, false);
  assert.equal(callButton(rows[1]).disabled, true, 'a relative already on a call cannot be called');
  assert.match(rows[1].children[1].textContent, /En appel/);
  h.emit('presence', {peers: [{member: A, name: 'Moi', call: null}]});
  assert.equal(peerRows(h).length, 0);
  assert.match(h.el('call-peers').children[0].textContent, /Aucun proche connecté/);
  assert.equal(h.errors.length, 0);
});

test('without a session the panel asks for the family code, then connects', async () => {
  const h = harness({ authenticated: false, app: false });
  h.window.BeybooCall.enter();
  await flush();
  assert.equal(h.el('call-signin').hidden, false);
  assert.equal(h.el('call-panel').dataset.state, 'signin');
  assert.equal(h.el('call-start').hidden, true);
  h.el('call-code').value = 'wrong';
  await h.el('call-signin').listeners.submit({preventDefault() {}});
  assert.match(h.el('call-signin-status').textContent, /incorrect/);
  assert.equal(h.room.connected, 0);
  h.el('call-code').value = 'beyboo-test';
  await h.el('call-signin').listeners.submit({preventDefault() {}});
  assert.equal(h.el('call-signin').hidden, true);
  assert.equal(h.room.connected, 1);
  assert.equal(h.el('call-code').value, '', 'the code is not kept in the field');
});

test('outgoing call: ring, decline from the callee, cancel, and the 45 s timeout', async () => {
  const h = harness();
  await flush();
  h.window.BeybooCall.enter();
  hello(h, [{member: B, name: 'Mamie', call: null}]);
  callButton(peerRows(h)[0]).click();
  await flush();
  const ring = h.room.sent.find(m => m.type === 'ring');
  assert.ok(ring, 'ring sent after media and ICE are ready');
  assert.match(ring.call, /^[a-f0-9]{32}$/);
  assert.equal(h.el('call-panel').dataset.state, 'ringing');
  assert.match(h.el('call-status').textContent, /Sonnerie chez Mamie/);
  assert.equal(h.el('call-end').textContent, 'Annuler');
  assert.equal(h.calls.length, 1, 'camera and microphone are requested once');
  assert.equal(callButton(peerRows(h)[0]).disabled, true);
  h.emit('signal', {call: ring.call, from: {member: C, name: 'Papi'}, payload: {type: 'decline'}});
  assert.equal(h.el('call-panel').dataset.state, 'ringing', 'a decline from someone else does not end the call');
  h.emit('signal', {call: ring.call, from: {member: B, name: 'Mamie'}, payload: {type: 'decline'}});
  assert.equal(h.el('call-panel').dataset.state, 'ready');
  assert.match(h.el('call-status').textContent, /Mamie ne peut pas répondre/);
  assert.equal(h.room.sent.at(-1).type, 'leave');
  // Cancel
  callButton(peerRows(h)[0]).click(); await flush();
  h.el('call-end').click();
  assert.match(h.el('call-status').textContent, /annulé/);
  assert.equal(h.room.sent.at(-1).type, 'leave');
  // Timeout
  callButton(peerRows(h)[0]).click(); await flush();
  h.fire(delay => delay === 45000);
  assert.match(h.el('call-status').textContent, /Mamie n’a pas répondu/);
  assert.equal(h.window.BeybooCall.active(), false);
  assert.equal(h.errors.length, 0);
});

test('incoming call rings on any screen, accept joins and the peer connection reaches connected', async () => {
  const modes = [];
  const h = harness({ member: B, showMode: mode => { modes.push(mode); h.window.BeybooCall.enter(); } });
  await flush();
  hello(h, [{member: A, name: 'Léa', call: null}]);
  const id = 'f'.repeat(32);
  h.emit('ring', {call: id, from: {member: A, name: 'Léa'}});
  const banner = h.el('device-screen').children.find(c => c.classList.contains('call-ring'));
  assert.ok(banner, 'the banner lives inside the eye even outside call mode');
  assert.equal(banner.find(c => c.classList.contains('call-ring-name')).textContent, 'Léa');
  assert.equal(h.el('call-panel').hidden, true, 'call mode not yet open');
  banner.find(c => c.classList.contains('call-ring-accept')).click();
  await flush();
  assert.deepEqual(modes, ['call']);
  assert.equal(banner.removed, true);
  const join = h.room.sent.find(m => m.type === 'join');
  assert.equal(join?.call, id);
  h.emit('call-peers', {call: id, peers: [{member: A, name: 'Léa', call: id}]});
  assert.equal(h.pcs.length, 1);
  const pc = h.pcs[0];
  assert.deepEqual(pc.config.iceServers[0].urls, ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302']);
  assert.equal(pc.tracks.length, 2, 'local audio and video are sent');
  assert.equal(pc.channels.length, 0, 'B > A: the polite side waits for the data channel');
  assert.equal(h.el('call-host').hidden, false);
  assert.equal(h.el('call-placeholder').hidden, true);
  // The smaller member id (A) offers; B answers.
  await h.emit('signal', {call: id, from: {member: A, name: 'Léa'}, payload: {type: 'sdp', description: {type: 'offer', sdp: 'o'}}});
  await flush();
  const answer = h.room.sent.find(m => m.type === 'signal' && m.payload.type === 'sdp');
  assert.equal(answer.to, A);
  assert.equal(answer.payload.description.type, 'answer');
  await h.emit('signal', {call: id, from: {member: A, name: 'Léa'}, payload: {type: 'ice', candidate: {candidate: 'c1'}}});
  await flush();
  assert.equal(pc.candidates.length, 1);
  pc.onicecandidate({candidate: {candidate: 'mine'}});
  assert.ok(h.room.sent.some(m => m.type === 'signal' && m.payload.type === 'ice' && m.to === A));
  pc.ice('checking');
  assert.equal(h.el('call-panel').dataset.state, 'connecting');
  pc.ice('connected');
  assert.equal(h.el('call-panel').dataset.state, 'connected');
  assert.match(h.el('call-status').textContent, /Connecté avec Léa/);
  assert.equal(h.window.BeybooCall.state().phase, 'live');
  assert.equal(h.el('call-media').hidden, false);
  assert.equal(h.el('call-audio').attrs['aria-pressed'], 'true');
  h.el('call-audio').click();
  assert.equal(h.el('call-audio').attrs['aria-pressed'], 'false');
  assert.equal(pc.tracks[0].track.enabled, false, 'mute disables the local track');
  pc.ice('disconnected');
  assert.equal(h.el('call-panel').dataset.state, 'reconnecting');
  pc.ice('connected');
  h.el('call-end').click();
  assert.equal(pc.closed, true);
  assert.equal(h.room.sent.at(-1).type, 'leave');
  assert.ok(pc.tracks.every(({track}) => track.stopped), 'hanging up stops camera and microphone');
  assert.equal(h.el('call-host').hidden, true);
  assert.equal(h.el('call-clock').textContent, '');
  assert.equal(h.errors.length, 0);
});

test('declining replies to the caller; a ring answered elsewhere or cancelled dismisses the banner; family settings silence calls', async () => {
  const h = harness({ member: B });
  await flush();
  hello(h, []);
  const id = 'e'.repeat(32);
  h.emit('ring', {call: id, from: {member: A, name: 'Léa'}});
  const banner = () => h.el('device-screen').children.find(c => c.classList.contains('call-ring') && !c.removed);
  banner().find(c => c.classList.contains('call-ring-decline')).click();
  const decline = JSON.parse(JSON.stringify(h.room.sent.at(-1)));
  assert.deepEqual(decline, {type: 'signal', call: id, to: A, payload: {type: 'decline'}});
  assert.equal(banner(), undefined);
  h.emit('ring', {call: id, from: {member: A, name: 'Léa'}});
  h.emit('peer-joined', {call: id, from: {member: C, name: 'Papi'}});
  assert.equal(banner(), undefined, 'answered on another device');
  h.emit('ring', {call: id, from: {member: A, name: 'Léa'}});
  h.emit('peer-left', {call: id, from: {member: A, name: 'Léa'}});
  assert.equal(banner(), undefined, 'caller cancelled');
  h.emit('ring', {call: id, from: {member: A, name: 'Léa'}});
  h.fire(delay => delay === 45000);
  assert.equal(banner(), undefined, 'missed after 45 s');
  h.window.BeybooFamily = {allowed: () => false, guard: () => false};
  h.emit('ring', {call: id, from: {member: A, name: 'Léa'}});
  assert.equal(banner(), undefined, 'calls disabled in the family settings');
  assert.equal(h.errors.length, 0);
});

test('invitation link: the creator waits in the call, the link joins directly after sign-in, hangup from the peer ends it', async () => {
  const h = harness();
  await flush();
  h.window.BeybooCall.enter();
  hello(h, []);
  h.el('call-start').click();
  await flush();
  const join = h.room.sent.find(m => m.type === 'join');
  const link = h.el('call-link').value;
  assert.match(link, /^http:\/\/127\.0\.0\.1:8787\/index\.html\?screen=1&call=[a-f0-9]{32}$/);
  assert.equal(new URL(link).searchParams.get('call'), join.call);
  assert.equal(h.el('call-invite').hidden, false);
  h.emit('call-peers', {call: join.call, peers: []});
  assert.equal(h.el('call-panel').dataset.state, 'waiting');
  await h.el('call-copy').click();
  assert.equal(h.navigator.copied, link);
  h.navigator.share = async () => { const e = new Error(); e.name = 'AbortError'; throw e; };
  h.el('call-share-status').textContent = '';
  await h.el('call-share').click();
  assert.equal(h.el('call-share-status').textContent, '', 'a cancelled share claims nothing');
  // The guest opens the link.
  const modes = [];
  const g = harness({ member: B, search: '?app=1&call=' + join.call, showMode: mode => { modes.push(mode); g.window.BeybooCall.enter(); } });
  assert.deepEqual(g.history.replaced, ['/index.html?app=1'], 'the call id leaves the URL at once');
  await flush();
  hello(g, [{member: A, name: 'Moi', call: join.call}]);
  await flush();
  assert.deepEqual(modes, ['call']);
  assert.equal(g.room.sent.find(m => m.type === 'join')?.call, join.call);
  g.emit('call-peers', {call: join.call, peers: [{member: A, name: 'Moi', call: join.call}]});
  assert.equal(g.pcs.length, 1);
  // Host side: the guest's arrival creates the offerer connection (A < B creates the data channel).
  h.emit('peer-joined', {call: join.call, from: {member: B, name: 'Invité'}});
  const pc = h.pcs[0];
  assert.equal(pc.channels.length, 1);
  await pc.onnegotiationneeded();
  const offer = h.room.sent.find(m => m.type === 'signal' && m.payload.type === 'sdp');
  assert.equal(offer.to, B);
  assert.equal(offer.payload.description.type, 'offer');
  pc.ice('connected');
  assert.match(h.el('call-status').textContent, /Connecté avec Invité/);
  h.emit('peer-left', {call: join.call, from: {member: B, name: 'Invité'}});
  assert.equal(h.window.BeybooCall.active(), false);
  assert.match(h.el('call-status').textContent, /Invité a raccroché/);
  assert.equal(h.errors.length + g.errors.length, 0);
});

test('media fallbacks: audio only without a camera, data channel only without any media, and a plain HTTP preview', async () => {
  for (const media of ['audio', 'none', 'missing']) {
    const h = harness({ media, secure: media !== 'missing' });
    await flush();
    h.window.BeybooCall.enter();
    hello(h, [{member: B, name: 'Mamie', call: null}]);
    callButton(peerRows(h)[0]).click();
    await flush();
    const ring = h.room.sent.find(m => m.type === 'ring');
    assert.ok(ring, media + ': the call still rings');
    h.emit('peer-joined', {call: ring.call, from: {member: B, name: 'Mamie'}});
    const pc = h.pcs[0];
    if (media === 'audio') {
      assert.equal(h.calls.length, 2, 'video refused, then audio alone');
      assert.deepEqual(pc.tracks.map(({track}) => track.kind), ['audio']);
      assert.match(h.el('call-notice').textContent, /audio seul/);
      assert.equal(h.el('call-video').disabled, true);
    } else {
      assert.equal(pc.tracks.length, 0);
      assert.equal(pc.channels.length, 1, 'the data channel alone carries the negotiation');
      assert.match(h.el('call-notice').textContent, /sans média/);
      assert.equal(h.window.BeybooCall.state().media, 'none');
    }
    pc.ice('connected');
    assert.equal(h.el('call-panel').dataset.state, 'connected');
    assert.equal(h.errors.length, 0, media);
  }
});

test('ICE failure restarts once then reports clearly; losing the room during a live call keeps it; leaving the mode hangs up', async () => {
  const h = harness();
  await flush();
  h.window.BeybooCall.enter();
  hello(h, [{member: B, name: 'Mamie', call: null}]);
  callButton(peerRows(h)[0]).click();
  await flush();
  const ring = h.room.sent.find(m => m.type === 'ring');
  h.emit('peer-joined', {call: ring.call, from: {member: B, name: 'Mamie'}});
  const pc = h.pcs[0];
  pc.ice('failed');
  assert.equal(pc.restarts, 1);
  assert.equal(h.el('call-panel').dataset.state, 'reconnecting');
  pc.ice('failed');
  assert.equal(h.el('call-panel').dataset.state, 'error');
  assert.match(h.el('call-notice').textContent, /TURN/);
  pc.ice('connected');
  pc.channels[0].open();
  assert.ok(pc.channels[0].sent.some(text => JSON.parse(text).type === 'media'), 'mute state is shared on the data channel');
  h.emit('status', 'closed');
  assert.equal(h.window.BeybooCall.active(), true, 'the direct call survives a signalling drop');
  assert.match(h.el('call-notice').textContent, /continue/);
  h.emit('peer-left', {call: ring.call, from: {member: B, name: 'Mamie'}});
  assert.equal(h.window.BeybooCall.active(), true, 'peer-left from a socket drop starts a grace period while P2P is alive');
  h.emit('status', 'open'); hello(h, [{member: B, name: 'Mamie', call: null}]);
  assert.equal(h.room.sent.at(-1).type, 'join', 'the device re-announces itself in the call');
  pc.channels[0].onmessage({data: JSON.stringify({type: 'bye'})});
  assert.equal(h.window.BeybooCall.active(), false, 'an explicit bye ends the call');
  callButton(peerRows(h)[0]).click(); await flush();
  h.window.BeybooCall.leave();
  assert.equal(h.window.BeybooCall.active(), false);
  assert.equal(h.el('call-panel').hidden, true);
  assert.equal(h.room.sent.at(-1).type, 'leave');
  h.window.events.pagehide();
  assert.equal(h.errors.length, 0);
});
