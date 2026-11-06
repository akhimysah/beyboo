/* Messages de famille, affichés dans l'œil : historique, envoi, réactions, présence et « X écrit… ».
   Transport : window.BeybooRoom (family-room.js). Rien n'est envoyé sans code famille ; l'IA vocale
   ne reçoit que le nombre de non-lus et le dernier expéditeur (get_state), jamais le texte. */
(() => {
  'use strict';
  const en = document.documentElement.lang === 'en';
  const t = (fr, english) => en ? english : fr;
  const locale = en ? 'en-GB' : 'fr-FR';
  const SEEN_KEY = 'beyboo.messages.seen.v1', USED_KEY = 'beyboo.messages.used.v1';
  const MAX = 1000, EMOJI = ['👍', '❤️', '😂', '👋'];
  const clock = new Intl.DateTimeFormat(locale, {hour: '2-digit', minute: '2-digit', hourCycle: 'h23'});
  const day = new Intl.DateTimeFormat(locale, {weekday: 'short', day: 'numeric', month: 'short'});
  const messages = new Map();           // id → message
  const typers = new Map();             // member → {name, timer}
  let peers = [], stage = null, say = null, unread = 0, lastSender = '', lastSeen = 0, lastId = 0;
  let subscriptions = [], listening = false, loading = false, lastDing = 0, audio = null, armed = false;
  let typingSent = 0, typingTimer = null, selected = null, phase = 'idle';

  /* ---------- aides pures ---------- */
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  function validText(value) {
    const text = String(value ?? '').normalize('NFC').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();
    return text && text.length <= MAX ? text : '';
  }
  function timeLabel(created, now = Date.now()) {
    const date = new Date(created);
    if (!Number.isFinite(date.getTime())) return '';
    const sameDay = new Date(now).toDateString() === date.toDateString();
    return sameDay ? clock.format(date) : day.format(date) + ' · ' + clock.format(date);
  }
  function presenceLabel(list, me) {
    const others = [...new Map(list.filter(p => p && p.member !== me).map(p => [p.member, p.name])).values()];
    if (!others.length) return t('Personne d’autre en ligne', 'No one else online');
    const shown = others.slice(0, 3).join(', ') + (others.length > 3 ? ' +' + (others.length - 3) : '');
    return t('En ligne : ', 'Online: ') + shown;
  }
  function typingLabel(names) {
    if (!names.length) return '';
    if (names.length === 1) return names[0] + t(' écrit…', ' is typing…');
    return names.slice(0, 2).join(t(' et ', ' and ')) + (names.length > 2 ? '…' : '') + t(' écrivent…', ' are typing…');
  }
  function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }
  const me = () => window.BeybooRoom?.member?.() || '';
  const isOpen = () => !!stage && stage.isConnected !== false;
  const visible = () => isOpen() && !document.hidden;
  const maxId = () => Math.max(0, lastId, ...messages.keys());

  /* ---------- stockage local du dernier message lu ---------- */
  function readSeen() { try { lastSeen = Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { lastSeen = 0; } }
  function storeSeen(id) { if (!(id > lastSeen)) return; lastSeen = id; try { localStorage.setItem(SEEN_KEY, String(lastSeen)); } catch { /* lecture seule */ } }
  function remember() { try { localStorage.setItem(USED_KEY, '1'); } catch { /* ignoré */ } }
  function used() { try { return localStorage.getItem(USED_KEY) === '1'; } catch { return false; } }

  /* ---------- notification : pastille et son bref ---------- */
  function announce() {
    try { document.dispatchEvent(new CustomEvent('beyboo-messages', {detail: {unread, lastSender}})); } catch { /* environnement minimal */ }
  }
  function arm() { armed = true; }
  document.addEventListener?.('pointerdown', arm, {once: true, passive: true});
  document.addEventListener?.('keydown', arm, {once: true});
  function ding() {
    if (!armed || reduced() || Date.now() - lastDing < 2000) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      audio = audio || new Ctx();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const now = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(880, now); osc.frequency.setValueAtTime(1175, now + .07);
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.07, now + .012); gain.gain.exponentialRampToValueAtTime(.0001, now + .2);
      osc.connect(gain).connect(audio.destination); osc.start(now); osc.stop(now + .22);
      lastDing = Date.now();
    } catch { /* son facultatif */ }
  }
  function markSeen() {
    if (!messages.size && !lastId) return;
    storeSeen(maxId());
    if (unread) { unread = 0; announce(); }
  }
  function markRead(id) { storeSeen(id); }

  /* ---------- réception ---------- */
  function ingest(message, {live = false} = {}) {
    if (!message || !Number.isInteger(message.id) || messages.has(message.id)) return false;
    messages.set(message.id, message);
    lastId = Math.max(lastId, message.id);
    const mine = message.member === me();
    if (mine) { markRead(message.id); return true; }
    if (visible()) { markRead(message.id); return true; }
    if (message.id > lastSeen) {
      unread++; lastSender = message.name || t('Un proche', 'A relative');
      if (live) ding();
      announce();
    }
    return true;
  }
  async function sync(since) {
    const room = window.BeybooRoom; if (!room) return null;
    try {
      const {data, ok, offline, response} = await room.api('/api/messages' + (since ? '?since=' + since : ''));
      if (offline) return {offline: true};
      if (!ok) return {status: response.status, data};
      const list = Array.isArray(data?.messages) ? data.messages : [];
      for (const message of list) ingest(message);
      lastId = Math.max(lastId, since || 0);
      return {messages: list};
    } catch { return {error: true}; }
  }
  function listen() {
    const room = window.BeybooRoom; if (!room || listening) return; listening = true;
    subscriptions = [
      room.on('hello', data => { peers = data.peers || []; const known = maxId(); lastId = Math.max(lastId, data.lastId || 0); if ((data.lastId || 0) > known) sync(known).then(() => paintList()); paintStatus(); paintPresence(); }),
      room.on('presence', data => { peers = data.peers || []; paintPresence(); }),
      room.on('message', data => { if (ingest(data.message, {live: true})) paintList(); }),
      room.on('deleted', data => { if (messages.delete(data.id)) paintList(); }),
      room.on('typing', data => { typing(data); }),
      room.on('status', paintStatus)
    ];
    room.connect();
  }
  function typing({from, active}) {
    if (!from || from.member === me()) return;
    const current = typers.get(from.member);
    if (current) clearTimeout(current.timer);
    if (active === false) typers.delete(from.member);
    else typers.set(from.member, {name: from.name, timer: setTimeout(() => { typers.delete(from.member); paintTyping(); }, 6000)});
    paintTyping();
  }
  document.addEventListener?.('visibilitychange', () => { if (visible()) markSeen(); });

  /* ---------- écran ---------- */
  function markup() {
    return '<div class="msg-screen" role="group" aria-label="' + t('Messages de la famille', 'Family messages') + '"><div class="msg-head"><h4>' + t('Messages', 'Messages') + '</h4><p class="msg-presence" aria-live="polite"></p></div><div class="msg-body"></div></div>';
  }
  const el = selector => stage?.querySelector(selector);
  function body(html) { const node = el('.msg-body'); if (node) node.innerHTML = html; }
  function message() {
    if (phase === 'offline') return t('Les messages demandent le serveur BOOZZO.', 'Messages need the BOOZZO server.');
    if (phase === 'login') return t('Entre le code famille dans l’œil pour lire les messages.', 'Enter the family code in the eye to read messages.');
    if (phase === 'error') return t('Les messages ne se chargent pas. Réessaie.', 'Messages did not load. Try again.');
    if (phase === 'list') return t('Messages de la famille affichés dans l’œil. Écris, ou touche un emoji.', 'Family messages are showing in the eye. Type, or tap an emoji.');
    return t('Chargement des messages…', 'Loading messages…');
  }
  function note(text) { say?.(text); }
  function renderOffline() {
    phase = 'offline';
    body('<div class="msg-note"><p>' + t('Les messages demandent le serveur BOOZZO.', 'Messages need the BOOZZO server.') + '</p><small>' + t('Cet hébergement est statique : les messages et les appels restent indisponibles ici.', 'This hosting is static: messages and calls are not available here.') + '</small></div>');
    note(message());
  }
  function renderError() {
    phase = 'error';
    body('<div class="msg-note"><p>' + t('Connexion impossible.', 'Could not connect.') + '</p><small>' + t('Vérifie le réseau, puis réessaie.', 'Check the network, then try again.') + '</small><button type="button" class="msg-retry">' + t('Réessayer', 'Try again') + '</button></div>');
    el('.msg-retry')?.addEventListener('click', () => load());
    note(message());
  }
  function renderLogin() {
    phase = 'login';
    body('<form class="msg-login" novalidate><p>' + t('Entre le code famille pour lire et envoyer des messages.', 'Enter the family code to read and send messages.') + '</p><label>' + t('Code famille', 'Family code') + '<input type="password" name="password" autocomplete="current-password" maxlength="200" required></label><button type="submit">' + t('Entrer', 'Enter') + '</button><p role="status"></p></form>');
    const form = el('.msg-login');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const status = form.querySelector('[role=status]'), input = form.elements.namedItem('password'), button = form.querySelector('button');
      const password = input.value;
      if (!password) { status.textContent = t('Écris le code famille.', 'Type the family code.'); return; }
      button.disabled = true; status.textContent = t('Vérification…', 'Checking…');
      try {
        const result = await window.BeybooRoom.login(password);
        if (!isOpen() || phase !== 'login') return;
        if (!result.ok) { status.textContent = result.message || t('Code incorrect.', 'Incorrect code.'); input.value = ''; input.focus(); return; }
        load();
      } catch { if (isOpen()) status.textContent = t('Le serveur ne répond pas.', 'The server is not responding.'); }
      finally { button.disabled = false; }
    });
    note(message());
  }
  function renderList() {
    phase = 'list';
    body('<ol class="msg-list" aria-label="' + t('Historique des messages', 'Message history') + '"></ol><p class="msg-typing" aria-live="polite"></p><div class="msg-emoji" role="group" aria-label="' + t('Réactions rapides', 'Quick reactions') + '">' +
      EMOJI.map(e => '<button type="button" data-emoji="' + e + '" aria-label="' + t('Envoyer ', 'Send ') + e + '">' + e + '</button>').join('') +
      '</div><form class="msg-form"><input type="text" name="text" maxlength="' + MAX + '" autocomplete="off" enterkeyhint="send" aria-label="' + t('Ton message', 'Your message') + '" placeholder="' + t('Écris un message…', 'Write a message…') + '"><button type="submit" aria-label="' + t('Envoyer', 'Send') + '">➤</button></form><p class="msg-status" role="status"></p>');
    const form = el('.msg-form'), input = form.elements.namedItem('text');
    form.addEventListener('submit', event => { event.preventDefault(); post(input.value, 'text').then(ok => { if (ok) { input.value = ''; input.focus({preventScroll: true}); } }); });
    input.addEventListener('input', () => { if (input.value) typed(); });
    el('.msg-emoji').addEventListener('click', event => { const button = event.target.closest('[data-emoji]'); if (button) post(button.dataset.emoji, 'emoji'); });
    el('.msg-list').addEventListener('click', event => {
      const remove = event.target.closest('.msg-delete');
      if (remove) { erase(Number(remove.dataset.id)); return; }
      const bubble = event.target.closest('.msg-item.is-mine');
      if (!bubble) return;
      selected = selected === Number(bubble.dataset.id) ? null : Number(bubble.dataset.id);
      paintList();
    });
    paintList(true); paintPresence(); paintStatus(); paintTyping();
    note(message());
  }
  function paintList(initial = false) {
    const list = el('.msg-list'); if (!list) return;
    const mine = me(), now = Date.now();
    const stick = initial || list.scrollHeight - list.scrollTop - list.clientHeight < 48;
    const rows = [...messages.values()].sort((a, b) => a.id - b.id);
    list.innerHTML = rows.length ? rows.map(m => {
      const own = m.member === mine, emoji = m.kind === 'emoji';
      return '<li class="msg-item' + (own ? ' is-mine' : '') + (emoji ? ' is-emoji' : '') + (selected === m.id ? ' is-selected' : '') + '" data-id="' + m.id + '">' +
        (own ? '' : '<small class="msg-name">' + escape(m.name) + '</small>') +
        '<span class="msg-bubble">' + escape(m.body) + '<time>' + timeLabel(m.created, now) + '</time></span>' +
        (own ? '<button type="button" class="msg-delete" data-id="' + m.id + '"' + (selected === m.id ? '' : ' hidden') + '>' + t('Supprimer', 'Delete') + '</button>' : '') + '</li>';
    }).join('') : '<li class="msg-empty">' + t('Aucun message pour l’instant. Dis bonjour !', 'No messages yet. Say hello!') + '</li>';
    if (stick) list.scrollTop = list.scrollHeight;
    if (visible()) markSeen();
  }
  function paintPresence() {
    const node = el('.msg-presence'); if (!node) return;
    node.textContent = phase === 'list' ? presenceLabel(peers, me()) : '';
  }
  function paintTyping() {
    const node = el('.msg-typing'); if (!node) return;
    node.textContent = typingLabel([...typers.values()].map(v => v.name));
  }
  function statusLabel(status) {
    if (status === 'open') return t('En direct', 'Live');
    if (status === 'connecting') return t('Connexion…', 'Connecting…');
    if (status === 'unauthorized') return t('Code famille requis.', 'Family code required.');
    if (status === 'error' || status === 'closed') return t('Reconnexion…', 'Reconnecting…');
    return '';
  }
  function paintStatus() {
    const node = el('.msg-status'); if (!node) return;
    const status = window.BeybooRoom?.status?.() || 'closed';
    node.textContent = statusLabel(status); node.dataset.status = status;
  }
  function status(text, error = false) { const node = el('.msg-status'); if (node) { node.textContent = text; node.dataset.status = error ? 'error' : 'note'; } }

  /* ---------- envoi, suppression, frappe ---------- */
  function typed() {
    const room = window.BeybooRoom; if (!room) return;
    const now = Date.now();
    if (now - typingSent > 2500) { typingSent = now; room.send({type: 'typing', active: true}); }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { typingSent = 0; room.send({type: 'typing', active: false}); }, 4000);
  }
  function stopTyping() { if (typingSent) window.BeybooRoom?.send({type: 'typing', active: false}); clearTimeout(typingTimer); typingSent = 0; }
  async function post(raw, kind) {
    const text = validText(raw);
    if (!text) { status(t('Écris entre 1 et 1000 caractères.', 'Write 1 to 1000 characters.'), true); return false; }
    stopTyping();
    const form = el('.msg-form'), button = form?.querySelector('button');
    if (button) button.disabled = true;
    try {
      const {data, ok, offline, response} = await window.BeybooRoom.api('/api/messages', {method: 'POST', body: JSON.stringify({text, kind})});
      if (!isOpen()) return false;
      if (offline) { renderOffline(); return false; }
      if (response.status === 401) { renderLogin(); return false; }
      if (!ok) { status(data?.message || t('Envoi impossible.', 'Could not send.'), true); return false; }
      if (data?.message) { ingest(data.message); paintList(); }
      paintStatus();
      return true;
    } catch { if (isOpen()) status(t('Envoi impossible. Vérifie le réseau.', 'Could not send. Check the network.'), true); return false; }
    finally { if (button) button.disabled = false; }
  }
  async function erase(id) {
    const own = messages.get(id);
    if (!own || own.member !== me()) return;
    try {
      const {ok, data, response} = await window.BeybooRoom.api('/api/messages/' + id, {method: 'DELETE'});
      if (!isOpen()) return;
      if (!ok && response.status !== 404) { status(data?.message || t('Suppression impossible.', 'Could not delete.'), true); return; }
      messages.delete(id); selected = null; paintList();
    } catch { if (isOpen()) status(t('Suppression impossible.', 'Could not delete.'), true); }
  }

  /* ---------- cycle de vie ---------- */
  async function load() {
    if (!window.BeybooRoom) { renderOffline(); return; }
    if (loading) return; loading = true;
    phase = 'loading';
    body('<div class="msg-note"><p>' + t('Chargement…', 'Loading…') + '</p></div>');
    const result = await sync();
    loading = false;
    if (!isOpen()) return;
    if (!result || result.error) { renderError(); return; }
    if (result.offline) { renderOffline(); return; }
    if (result.status === 401) { renderLogin(); return; }
    if (result.status) { renderError(); return; }
    remember(); listen(); renderList();
  }
  function open(root, notify) {
    stage = root; say = notify; selected = null;
    readSeen(); load();
  }
  function leave() {
    if (!stage) return;
    stopTyping(); stage = null; say = null; selected = null; phase = 'idle';
  }
  function state() {
    return {screen: 'messages', phase, unreadMessages: unread, lastSender: lastSender || null, online: peers.filter(p => p.member !== me()).length, room: window.BeybooRoom?.status?.() || 'absent'};
  }
  /* Au chargement, si les messages ont déjà servi ici et que le code famille est posé : écoute en arrière-plan
     pour la pastille des non-lus et le son, sans écran ouvert. */
  readSeen();
  if (used() && window.BeybooRoom && typeof setTimeout === 'function') setTimeout(async () => {
    const info = await window.BeybooRoom.signedIn();
    if (!info.authenticated || listening) return;
    const result = await sync(lastSeen);
    if (result?.messages) listen();
  }, 1500);
  window.BeybooMessages = {markup, open, leave, state, message, unread: () => unread, lastSender: () => lastSender, isOpen, helpers: {validText, timeLabel, presenceLabel, typingLabel, statusLabel, ingest, markSeen, reset() { messages.clear(); typers.clear(); peers = []; unread = 0; lastSender = ''; lastSeen = 0; lastId = 0; }}};
})();
