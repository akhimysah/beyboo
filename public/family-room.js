/* Transport commun de la salle de famille : une connexion WebSocket par appareil, et les appels REST associés.
   Les modules messages.js et call.js s'appuient dessus. Aucune donnée n'est envoyée sans code famille. */
(() => {
  'use strict';
  const en = document.documentElement.lang === 'en';
  const t = (fr, english) => en ? english : fr;
  const KEY = 'beyboo.room.member.v1';
  const listeners = new Map();
  let socket = null, wanted = false, retry = 0, timer = null, keepalive = null, status = 'closed', hello = null;

  function memberId() {
    try {
      let id = localStorage.getItem(KEY);
      if (!/^[a-f0-9]{32}$/.test(id || '')) { id = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem(KEY, id); }
      return id;
    } catch { return memberId.fallback || (memberId.fallback = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')); }
  }
  function memberName() {
    try {
      const raw = localStorage.getItem(window.BeybooProfileModel?.key || 'beyboo-profile-v1');
      const name = raw ? JSON.parse(raw)?.name : '';
      if (typeof name === 'string' && name.trim()) return name.trim().slice(0, 40);
    } catch { /* profil indisponible */ }
    return t('Cet appareil', 'This device');
  }
  function emit(type, data) { for (const fn of listeners.get(type) || []) { try { fn(data); } catch (e) { console.error(e); } } for (const fn of listeners.get('*') || []) { try { fn(type, data); } catch { /* ignoré */ } } }
  function setStatus(next) { if (status === next) return; status = next; emit('status', next); }
  function url() {
    const u = new URL('/api/room/socket', location.href);
    u.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    u.searchParams.set('member', memberId()); u.searchParams.set('name', memberName());
    return u.toString();
  }
  function connect() {
    wanted = true;
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
    clearTimeout(timer);
    setStatus('connecting');
    let ws;
    try { ws = new WebSocket(url()); } catch { setStatus('error'); schedule(); return; }
    socket = ws;
    ws.addEventListener('open', () => { retry = 0; setStatus('open'); clearInterval(keepalive); keepalive = setInterval(() => send({type: 'ping'}), 25000); });
    ws.addEventListener('message', event => {
      let data; try { data = JSON.parse(event.data); } catch { return; }
      if (!data || typeof data.type !== 'string') return;
      if (data.type === 'hello') hello = data;
      emit(data.type, data);
    });
    ws.addEventListener('close', event => { clearInterval(keepalive); if (socket === ws) socket = null; setStatus(event.code === 1008 || event.code === 4401 ? 'unauthorized' : 'closed'); if (wanted) schedule(); });
    ws.addEventListener('error', () => { /* close suit toujours */ });
  }
  function schedule() { clearTimeout(timer); const delay = Math.min(30000, 1000 * 2 ** Math.min(retry++, 5)); timer = setTimeout(connect, delay); }
  function disconnect() { wanted = false; clearTimeout(timer); clearInterval(keepalive); if (socket) { try { socket.close(1000); } catch { /* ignoré */ } socket = null; } setStatus('closed'); }
  function send(payload) { if (!socket || socket.readyState !== WebSocket.OPEN) return false; try { socket.send(JSON.stringify(payload)); return true; } catch { return false; } }
  function on(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); return () => off(type, fn); }
  function off(type, fn) { listeners.get(type)?.delete(fn); }
  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('X-Beyboo-Member', memberId()); headers.set('X-Beyboo-Name', encodeURIComponent(memberName()));
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(path, {cache: 'no-store', credentials: 'same-origin', ...options, headers});
    let data = null;
    const type = response.headers.get('content-type') || '';
    if (type.includes('application/json')) { try { data = await response.json(); } catch { data = null; } }
    return {response, data, ok: response.ok, offline: !type.includes('application/json')};
  }
  async function signedIn() {
    try { const {data} = await api('/api/voice/status', {signal: AbortSignal.timeout(8000)}); return {authenticated: !!data?.authenticated, mode: data?.authMode, signIn: data?.signIn}; }
    catch { return {authenticated: false, mode: null, signIn: null}; }
  }
  async function login(password) {
    const {response, data} = await api('/api/auth/login', {method: 'POST', body: JSON.stringify({password})});
    if (response.ok && wanted) { disconnect(); connect(); }
    return {ok: response.ok, message: data?.message || ''};
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && wanted && !socket) { retry = 0; connect(); } });
  window.addEventListener('online', () => { if (wanted && !socket) { retry = 0; connect(); } });
  window.BeybooRoom = {connect, disconnect, send, on, off, api, login, signedIn, member: memberId, name: memberName, status: () => status, hello: () => hello, rename: () => send({type: 'rename', name: memberName()})};
})();
