import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = await readFile(new URL('../public/call.js', import.meta.url), 'utf8');
class Element {
  hidden = false; dataset = {}; value = ''; textContent = ''; attrs = {}; children = []; listeners = {};
  classList = {
    values: new Set(),
    add(...names) { names.forEach(n => this.values.add(n)); },
    remove(...names) { names.forEach(n => this.values.delete(n)); },
    contains(name) { return this.values.has(name); },
    toggle(name, value) { value ? this.add(name) : this.remove(name); }
  };
  addEventListener(name, fn) { this.listeners[name] = fn; }
  click() { return this.listeners.click?.(); }
  setAttribute(k, v) { this.attrs[k] = v; }
  append(node) { this.children.push(node); }
  replaceChildren() { this.children = []; }
  focus() { this.focused = true; }
  select() { this.selected = true; }
  remove() { this.removed = true; }
}
function harness({ secure = true, loader = false, embedded = true } = {}) {
  const elements = new Map();
  const el = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const instances = [], scripts = [], scheduled = new Map();
  let nextTimer = 0;
  class Provider {
    listeners = {}; commands = []; disposed = false; frame = new Element();
    constructor(domain, options) { this.domain = domain; this.options = options; options.parentNode.append(this.frame); instances.push(this); }
    getIFrame() { return this.frame; }
    addListener(name, callback) { this.listeners[name] = callback; }
    emit(name, value) { this.listeners[name]?.(value); }
    executeCommand(...args) { this.commands.push(args); }
    dispose() { this.disposed = true; }
    isAudioMuted() { return Promise.resolve(false); }
    isVideoMuted() { return Promise.resolve(false); }
    getRoomsInfo() { return Promise.resolve({ rooms: [{ isMainRoom: true, participants: [{ id: 'local' }] }] }); }
    pinParticipant(id) { this.pinned = id; }
    setLargeVideoParticipant(id) { this.large = id; }
  }
  const window = { isSecureContext: secure, RTCPeerConnection: class {}, events: {}, addEventListener(name, callback) { this.events[name] = callback; } };
  if (!loader) window.JitsiMeetExternalAPI = Provider;
  const navigator = { mediaDevices: {}, clipboard: { writeText: async text => { navigator.copied = text; } } };
  const document = { getElementById: el, querySelector: () => el('card'), querySelectorAll: () => [], createElement: () => new Element(), head: { append(script) { scripts.push(script); } } };
  const setTimer = callback => { const id = ++nextTimer; scheduled.set(id, callback); return id; };
  if(embedded)el('call-panel').dataset.jitsiHost='family.example.org';
  vm.runInNewContext(source, { window, document, navigator, crypto: webcrypto, Uint8Array, Map, Promise, Date, setTimeout: setTimer, setInterval: setTimer, clearTimeout: id => scheduled.delete(id), clearInterval: id => scheduled.delete(id) });
  window.BeybooCall.enter();
  return { window, navigator, el, instances, scripts, scheduled, Provider };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('media is opt-in, and only a provider join event means connected', async () => {
  const h = harness();
  assert.equal(h.instances.length, 0);
  await h.el('call-start').click();
  assert.equal(h.el('call-panel').dataset.state, 'connecting');
  assert.equal(h.el('call-media').hidden, true);
  assert.match(h.el('call-link').value, /^https:\/\/family\.example\.org\/Beyboo[0-9a-f]{32}$/);
  const p = h.instances[0];
  p.emit('videoConferenceJoined', { id: 'local' });
  await flush();
  assert.equal(h.el('call-panel').dataset.state, 'waiting');
  p.emit('participantJoined', { id: 'mamie' });
  assert.equal(h.el('call-panel').dataset.state, 'connected');
  assert.equal(p.pinned, 'mamie');
  assert.equal(p.large, 'mamie');
  assert.equal(h.el('call-audio').attrs['aria-pressed'], 'true');
  h.el('call-audio').click();
  assert.equal(p.commands.at(-1)[0], 'toggleAudio');
  assert.equal(h.el('call-audio').attrs['aria-pressed'], 'true', 'wait for actual mute state');
  p.emit('audioMuteStatusChanged', { muted: true });
  assert.equal(h.el('call-audio').attrs['aria-pressed'], 'false');
  p.emit('participantLeft', { id: 'mamie' });
  assert.equal(h.el('call-panel').dataset.state, 'waiting');
  h.el('call-end').click();
  assert.equal(p.disposed, true);
  assert.equal(h.el('call-host').children.length, 0);
  assert.equal(h.scheduled.size, 0);
});

test('cancellation while the external script loads cannot reopen the camera', async () => {
  const h = harness({ loader: true });
  const pending = h.el('call-start').click();
  assert.equal(h.scripts.length, 1);
  h.window.BeybooCall.leave();
  h.window.JitsiMeetExternalAPI = h.Provider;
  h.scripts[0].onload();
  await pending;
  assert.equal(h.instances.length, 0);
  assert.equal(h.el('call-stage').hidden, true);
});

test('leaving, external fallback and pagehide dispose media; late events do nothing', async () => {
  for (const action of ['leave', 'external', 'pagehide']) {
    const h = harness();
    await h.el('call-start').click();
    const p = h.instances[0];
    if (action === 'leave') h.window.BeybooCall.leave();
    if (action === 'external') h.el('call-external').click();
    if (action === 'pagehide') h.window.events.pagehide();
    assert.equal(p.disposed, true);
    assert.equal(h.el('call-host').children.length, 0);
    p.emit('videoConferenceJoined', { id: 'late' });
    assert.notEqual(h.el('call-panel').dataset.state, 'waiting');
    assert.equal(h.el('call-media').hidden, true);
    assert.equal(h.scheduled.size, 0);
  }
});

test('insecure previews give a usable HTTPS fallback without starting capture', async () => {
  const h = harness({ secure: false });
  await h.el('call-start').click();
  assert.equal(h.instances.length, 0);
  assert.equal(h.el('call-panel').dataset.state, 'error');
  assert.equal(h.el('call-external').href, h.el('call-link').value);
  await h.el('call-copy').click();
  assert.equal(h.navigator.copied, h.el('call-link').value);
  const previous = h.el('call-link').value;
  h.el('call-new').click();
  assert.notEqual(h.el('call-link').value, previous);
});

test('loader errors are retryable and fatal connection errors stop media', async () => {
  const h = harness({ loader: true });
  const pending = h.el('call-start').click();
  h.scripts[0].onerror(); await pending;
  assert.equal(h.el('call-panel').dataset.state, 'error');
  assert.equal(h.el('call-start').hidden, false);
  const retry = h.el('call-start').click();
  h.window.JitsiMeetExternalAPI = h.Provider;
  h.scripts[1].onload(); await retry;
  const p = h.instances[0];
  p.emit('errorOccurred', { isFatal: true });
  assert.equal(p.disposed, true);
  assert.equal(h.el('call-panel').dataset.state, 'error');
  assert.equal(h.el('call-host').children.length, 0);
});

test('a cancelled share does not claim an invitation was sent; copy failure selects the link', async () => {
  const h = harness({ secure: false });
  await h.el('call-start').click();
  h.navigator.share = async () => { const e = new Error(); e.name = 'AbortError'; throw e; };
  await h.el('call-share').click();
  assert.equal(h.el('call-share-status').textContent, '');
  h.navigator.clipboard.writeText = async () => { throw new Error('denied'); };
  await h.el('call-copy').click();
  assert.equal(h.el('call-link').selected, true);
  assert.match(h.el('call-share-status').textContent, /Sélectionnez et copiez/);
});

test('public calls offer the same direct room to both people without loading an iframe', async () => {
  const h = harness({embedded:false, loader:true});
  await h.el('call-start').click();
  assert.match(h.el('call-link').value, /^https:\/\/meet\.jit\.si\/Beyboo[a-f0-9]{32}$/);
  assert.equal(h.el('call-link').value, h.el('call-external').href);
  assert.equal(h.el('call-start').hidden, true);
  assert.equal(h.el('call-invite').hidden, false);
  assert.equal(h.scripts.length, 0);
  assert.equal(h.instances.length, 0);
});
