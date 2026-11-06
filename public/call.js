/* Appels entre appareils de la famille : WebRTC pair-à-pair dans l'œil (1:1, jusqu'à 3 en maillage).
   La salle de famille (BeybooRoom) ne relaie que la mise en relation : sonnerie, SDP et candidats ICE.
   Audio et vidéo passent directement entre les appareils (STUN, et TURN Cloudflare si le serveur le fournit).
   Sans caméra : audio seul. Sans micro ni caméra : appel « sans média », la connexion de données prouve la liaison. */
(() => {
  'use strict';
  const en = document.documentElement.lang === 'en';
  const t = (fr, english) => en ? english : fr;
  const el = id => document.getElementById(id);
  const panel = el('call-panel');
  if (!panel) return;
  const card = document.querySelector('.experience-card');
  const screen = el('device-screen');
  const stage = el('call-stage'), host = el('call-host'), placeholder = el('call-placeholder');
  const STUN = ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'];
  const RING_TIMEOUT = 45000, MAX_PEERS = 2, CALL_ID = /^[a-zA-Z0-9_-]{8,64}$/;
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const room = () => window.BeybooRoom || null;
  const family = () => window.BeybooFamily || null;
  const me = () => room()?.member() || '';

  const online = new Map();        // member -> {member, name, call}
  let visible = false, connected = false, signInShown = false;
  let call = null;                 // {id, phase: ringing|waiting|connecting|live, target, peers: Map, link, startedAt, timeout, clock}
  let incoming = null;             // {call, from, timer, node, who}
  let local = null, localVideo = null, audioOn = false, videoOn = false, mediaMode = 'none', mediaAsked = false;
  let iceConfig = null, iceFetched = 0, booted = false, soundButton = null;
  let audioCtx = null, ringer = null;
  let pendingJoin = '';

  /* Un lien d'invitation ouvert après connexion rejoint directement l'appel ; l'identifiant quitte l'URL aussitôt. */
  try {
    const params = new URLSearchParams(location.search);
    const wanted = params.get('call') || '';
    if (CALL_ID.test(wanted)) {
      pendingJoin = wanted;
      params.delete('call');
      history.replaceState(history.state, '', location.pathname + (params.toString() ? '?' + params.toString() : '') + location.hash);
    }
  } catch { /* URL non lisible : pas de participation automatique */ }

  /* ---------- Interface ---------- */
  function status(text, state = 'ready') {
    panel.dataset.state = state;
    el('call-status').textContent = text;
  }
  function notice(text = '') {
    el('call-notice').textContent = text;
    el('call-notice').hidden = !text;
  }
  function wide(value) {
    card.classList.toggle('is-call-wide', value);
    el('call-size').textContent = value ? t('Afficher dans l’œil', 'Show in the eye') : t('Agrandir l’appel', 'Enlarge call');
    el('call-size').setAttribute('aria-pressed', String(value));
  }
  function clock() {
    if (!call?.startedAt) return;
    const seconds = Math.floor((Date.now() - call.startedAt) / 1000);
    el('call-clock').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  function controls() {
    const live = !!call && call.phase !== 'ringing';
    el('call-start').hidden = !!call || signInShown;
    el('call-end').hidden = !call;
    el('call-end').textContent = call?.phase === 'ringing' || call?.phase === 'waiting' ? t('Annuler', 'Cancel') : t('Raccrocher', 'Hang up');
    el('call-media').hidden = !live;
    el('call-size').hidden = !live;
    el('call-audio').textContent = audioOn ? t('Couper le micro', 'Mute microphone') : t('Activer le micro', 'Turn on microphone');
    el('call-video').textContent = videoOn ? t('Couper la caméra', 'Turn off camera') : t('Activer la caméra', 'Turn on camera');
    el('call-audio').setAttribute('aria-pressed', String(audioOn));
    el('call-video').setAttribute('aria-pressed', String(videoOn));
    el('call-audio').disabled = !local?.getAudioTracks().length;
    el('call-video').disabled = !local?.getVideoTracks().length;
    el('call-invite').hidden = !call?.link;
    if (localVideo) localVideo.hidden = !videoOn;
  }
  function node(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function button(label, onClick, className) {
    const b = node('button', className, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }
  function renderPeers() {
    const list = el('call-peers');
    if (!list) return;
    list.replaceChildren();
    if (signInShown) return;
    if (!connected) { list.append(node('p', 'call-peers-empty', t('Connexion à la famille…', 'Connecting to the family…'))); return; }
    const mine = me();
    const others = [...online.values()].filter(p => p.member !== mine);
    if (!others.length) {
      list.append(node('p', 'call-peers-empty', t('Aucun proche connecté pour l’instant. Ouvrez BOOZZO sur un autre appareil de la famille, ou envoyez un lien d’invitation.', 'Nobody from the family is online yet. Open BOOZZO on another family device, or send an invitation link.')));
      return;
    }
    for (const peer of others) {
      const row = node('div', 'call-peer');
      row.dataset.member = peer.member;
      const inThisCall = call && peer.call === call.id;
      const busy = !!peer.call && !inThisCall;
      row.append(node('b', 'call-peer-name', peer.name), node('span', 'call-peer-state', inThisCall ? t('Dans l’appel', 'In the call') : busy ? t('En appel', 'On a call') : t('En ligne', 'Online')));
      const action = button(t('Appeler', 'Call'), () => callPeer(peer), 'call-peer-call');
      action.setAttribute('aria-label', t('Appeler', 'Call') + ' ' + peer.name);
      action.disabled = !!call || busy;
      row.append(action);
      list.append(row);
    }
  }
  function peerLabel(peer) {
    const live = peer.state === 'connected';
    const media = peer.media;
    if (!live) return peer.name;
    if (media && !media.audio && !media.video) return `${peer.name} · ${t('sans média', 'no media')}`;
    if (media && !media.video) return `${peer.name} · ${t('audio', 'audio')}`;
    return peer.name;
  }
  function refreshStatus() {
    if (!call) return;
    const peers = [...call.peers.values()];
    if (call.phase === 'ringing') { status(`${t('Sonnerie chez', 'Ringing')} ${call.target?.name || t('votre proche', 'your contact')}…`, 'ringing'); return; }
    if (!peers.length) {
      status(call.link ? t('Lien prêt. L’appel démarrera dès que votre proche l’ouvrira.', 'Link ready. The call starts as soon as your contact opens it.') : t('En attente de votre proche…', 'Waiting for your contact…'), 'waiting');
      return;
    }
    const names = peers.filter(p => p.state === 'connected').map(peerLabel).join(', ');
    if (peers.some(p => p.state === 'failed') && !peers.some(p => p.state === 'connected' || p.state === 'connecting' || p.state === 'reconnecting')) {
      status(t('La connexion directe a échoué.', 'The direct connection failed.'), 'error');
      notice(t('Vos deux réseaux ne se joignent pas. Un serveur TURN (identifiants Cloudflare Calls sur le serveur) permet de relayer l’appel dans ce cas. Raccrochez, puis réessayez.', 'Your two networks cannot reach each other. A TURN server (Cloudflare Calls credentials on the server) relays the call in that case. Hang up, then try again.'));
      return;
    }
    if (peers.some(p => p.state === 'reconnecting')) { status(t('Reconnexion…', 'Reconnecting…'), 'reconnecting'); return; }
    if (names) { status(`${t('Connecté avec', 'Connected with')} ${names}`, 'connected'); return; }
    status(`${t('Connexion avec', 'Connecting with')} ${peers.map(p => p.name).join(', ')}…`, 'connecting');
  }
  function mediaNotice() {
    if (!call || call.phase === 'ringing') return;
    if (mediaMode === 'audio') notice(t('Caméra indisponible : appel en audio seul.', 'Camera unavailable: audio-only call.'));
    else if (mediaMode === 'none') notice(t('Micro et caméra indisponibles sur cet appareil : appel sans média. La connexion directe entre les appareils est tout de même établie (canal de données).', 'Microphone and camera unavailable on this device: a call without media. The direct connection between the devices is still established (data channel).'));
    else notice();
  }

  /* ---------- Sonneries WebAudio (brèves, répétées ; silencieuses tant que le navigateur bloque le son) ---------- */
  function audio() {
    if (audioCtx) return audioCtx;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    try { audioCtx = new Context(); } catch { return null; }
    return audioCtx;
  }
  function beep(ctx, frequency, at, duration, gain) {
    const osc = ctx.createOscillator(), vol = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = frequency;
    vol.gain.setValueAtTime(0, at);
    vol.gain.linearRampToValueAtTime(gain, at + 0.02);
    vol.gain.linearRampToValueAtTime(0, at + duration);
    osc.connect(vol).connect(ctx.destination);
    osc.start(at); osc.stop(at + duration + 0.05);
  }
  function startTone(kind) {
    stopTone();
    const ctx = audio();
    if (!ctx) return;
    const play = () => {
      if (ctx.state !== 'running') return;
      const now = ctx.currentTime;
      if (kind === 'ring') { beep(ctx, 659, now, 0.18, 0.08); beep(ctx, 880, now + 0.22, 0.3, 0.08); }
      else beep(ctx, 440, now, 1, 0.045);
    };
    Promise.resolve(ctx.resume?.()).then(play, play);
    ringer = setInterval(play, kind === 'ring' ? 2500 : 3500);
  }
  function stopTone() { clearInterval(ringer); ringer = null; }
  const unlock = () => { const ctx = audio(); if (ctx?.state === 'suspended') ctx.resume?.().catch?.(() => {}); };
  document.addEventListener('pointerdown', unlock, {passive: true});
  document.addEventListener('keydown', unlock, {passive: true});

  /* ---------- Médias locaux ---------- */
  async function prepareMedia() {
    if (local || mediaAsked) return;
    mediaAsked = true;
    const devices = navigator.mediaDevices;
    if (!window.isSecureContext || !devices?.getUserMedia) { mediaMode = 'none'; return; }
    try {
      local = await devices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true}, video: {facingMode: 'user', width: {ideal: 640}, height: {ideal: 640}}});
      mediaMode = 'av';
    } catch {
      try { local = await devices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true}}); mediaMode = 'audio'; }
      catch { local = null; mediaMode = 'none'; }
    }
    audioOn = !!local?.getAudioTracks().length;
    videoOn = !!local?.getVideoTracks().length;
    if (local && videoOn) {
      if (!localVideo) {
        localVideo = node('video', 'call-local');
        localVideo.autoplay = true; localVideo.muted = true;
        localVideo.setAttribute('playsinline', ''); localVideo.setAttribute('muted', ''); localVideo.setAttribute('aria-label', t('Votre caméra', 'Your camera'));
        stage.append(localVideo);
      }
      localVideo.srcObject = local;
      Promise.resolve(localVideo.play?.()).catch(() => {});
    }
    if (call) for (const peer of call.peers.values()) if (local) for (const track of local.getTracks()) peer.pc.addTrack(track, local);
    controls();
  }
  function releaseMedia() {
    if (local) for (const track of local.getTracks()) track.stop();
    local = null; mediaAsked = false; audioOn = videoOn = false; mediaMode = 'none';
    if (localVideo) { localVideo.srcObject = null; localVideo.hidden = true; }
  }
  function toggleTrack(kind) {
    if (!local) return;
    const tracks = kind === 'audio' ? local.getAudioTracks() : local.getVideoTracks();
    if (!tracks.length) return;
    const next = !tracks[0].enabled;
    for (const track of tracks) track.enabled = next;
    if (kind === 'audio') audioOn = next; else videoOn = next;
    controls(); broadcastMedia();
  }
  function broadcastMedia() {
    if (!call) return;
    const payload = JSON.stringify({type: 'media', audio: audioOn, video: videoOn});
    for (const peer of call.peers.values()) if (peer.channel?.readyState === 'open') { try { peer.channel.send(payload); } catch { /* canal fermé */ } }
  }

  /* ---------- Serveurs ICE ---------- */
  async function loadIce() {
    if (iceConfig && Date.now() - iceFetched < 10 * 60 * 1000) return;
    try {
      const {data, ok} = await room().api('/api/calls/turn', {signal: AbortSignal.timeout(6000)});
      if (ok && Array.isArray(data?.iceServers) && data.iceServers.length) { iceConfig = {iceServers: data.iceServers, turn: !!data.turn}; iceFetched = Date.now(); return; }
    } catch { /* hors ligne ou serveur indisponible : STUN public */ }
    if (!iceConfig) iceConfig = {iceServers: [{urls: STUN}], turn: false};
  }

  /* ---------- Connexions pair-à-pair (négociation « parfaite » : le plus petit identifiant est l'impoli) ---------- */
  function signal(to, payload) { return room()?.send({type: 'signal', call: call?.id, to, payload}) ?? false; }
  function attachChannel(peer, channel) {
    peer.channel = channel;
    const opened = () => { peer.channelOpen = true; broadcastMedia(); markRemote(peer); };
    channel.onopen = opened;
    // Un canal annoncé par le pair est déjà ouvert quand l'événement datachannel arrive : onopen ne viendra pas.
    if (channel.readyState === 'open') opened();
    channel.onclose = () => { peer.channelOpen = false; };
    channel.onmessage = event => {
      let data; try { data = JSON.parse(event.data); } catch { return; }
      if (data?.type === 'media') { peer.media = {audio: !!data.audio, video: !!data.video}; markRemote(peer); refreshStatus(); }
      else if (data?.type === 'bye') dropPeer(peer.member);
    };
  }
  function mountRemote(peer) {
    const figure = node('figure', 'call-remote');
    figure.dataset.member = peer.member;
    figure.dataset.state = peer.state;
    const video = node('video');
    video.autoplay = true; video.setAttribute('playsinline', ''); video.setAttribute('aria-label', peer.name);
    video.srcObject = peer.stream;
    const initial = node('span', 'call-remote-initial', (peer.name || '?').trim().charAt(0).toUpperCase() || '?');
    const caption = node('figcaption', '', peer.name);
    figure.append(video, initial, caption);
    peer.node = figure; peer.video = video; peer.caption = caption;
    host.append(figure);
    host.dataset.count = String(call.peers.size);
    host.hidden = false; placeholder.hidden = true;
  }
  function markRemote(peer) {
    if (!peer.node) return;
    const hasVideo = peer.stream.getVideoTracks().some(track => track.readyState === 'live') && (peer.media ? peer.media.video : true);
    peer.node.dataset.video = String(hasVideo);
    peer.node.dataset.state = peer.state;
    peer.caption.textContent = peerLabel(peer);
  }
  function playRemote(peer) {
    if (!peer.video?.play) return;
    Promise.resolve(peer.video.play()).catch(() => {
      // Lecture automatique bloquée (ouverture par lien, sans geste) : un bouton rétablit le son.
      if (soundButton || !call) return;
      soundButton = button(t('Activer le son', 'Turn sound on'), () => {
        for (const p of call?.peers.values() || []) Promise.resolve(p.video?.play?.()).catch(() => {});
        soundButton?.remove(); soundButton = null;
      }, 'call-sound');
      el('call-media').append(soundButton);
    });
  }
  function ensurePeer(member, name) {
    if (!call || !member || member === me()) return null;
    let peer = call.peers.get(member);
    if (peer) {
      if (name && peer.name !== name) { peer.name = name; markRemote(peer); }
      if (peer.grace) { clearTimeout(peer.grace); peer.grace = null; refreshStatus(); }
      return peer;
    }
    if (call.peers.size >= MAX_PEERS) return null;
    const mine = me();
    const pc = new RTCPeerConnection({iceServers: iceConfig?.iceServers || [{urls: STUN}]});
    peer = {member, name: name || t('Un proche', 'Someone'), pc, polite: mine > member, makingOffer: false, ignoreOffer: false, channel: null, channelOpen: false, stream: new MediaStream(), state: 'new', restarted: false, media: null, node: null, video: null, caption: null, grace: null};
    call.peers.set(member, peer);
    if (local) for (const track of local.getTracks()) pc.addTrack(track, local);
    // Le canal de données est créé par l'impoli : sans micro ni caméra, c'est lui qui déclenche la négociation.
    if (!peer.polite) attachChannel(peer, pc.createDataChannel('beyboo'));
    pc.ondatachannel = event => attachChannel(peer, event.channel);
    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        signal(member, {type: 'sdp', description: pc.localDescription?.toJSON ? pc.localDescription.toJSON() : pc.localDescription});
      } catch (error) { console.error('[call] offer', error); }
      finally { peer.makingOffer = false; }
    };
    pc.onicecandidate = event => { if (event.candidate) signal(member, {type: 'ice', candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate}); };
    pc.ontrack = event => {
      peer.stream.addTrack(event.track);
      event.track.onended = () => markRemote(peer);
      event.track.onmute = () => markRemote(peer);
      event.track.onunmute = () => markRemote(peer);
      markRemote(peer); playRemote(peer);
    };
    pc.oniceconnectionstatechange = () => peerState(peer);
    pc.onconnectionstatechange = () => peerState(peer);
    mountRemote(peer);
    if (online.has(member)) online.get(member).call = call.id;
    if (call.phase === 'waiting' || call.phase === 'ringing') call.phase = 'connecting';
    clearTimeout(call.timeout); stopTone();
    controls(); renderPeers(); mediaNotice(); refreshStatus();
    return peer;
  }
  function peerState(peer) {
    if (!call || !call.peers.has(peer.member)) return;
    const ice = peer.pc.iceConnectionState, connection = peer.pc.connectionState;
    if (ice === 'connected' || ice === 'completed' || connection === 'connected') {
      peer.state = 'connected'; peer.restarted = false;
      if (!call.startedAt) { call.startedAt = Date.now(); call.phase = 'live'; call.clock = setInterval(clock, 1000); clock(); controls(); }
      playRemote(peer);
    } else if (ice === 'failed' || connection === 'failed') {
      if (!peer.restarted && typeof peer.pc.restartIce === 'function') { peer.restarted = true; peer.state = 'reconnecting'; try { peer.pc.restartIce(); } catch { peer.state = 'failed'; } }
      else peer.state = 'failed';
    } else if (ice === 'disconnected') peer.state = 'reconnecting';
    else if (ice === 'checking') peer.state = 'connecting';
    else if (ice === 'closed' || connection === 'closed') peer.state = 'closed';
    if (peer.grace && (peer.state === 'failed' || peer.state === 'closed')) { dropPeer(peer.member); return; }
    markRemote(peer); refreshStatus();
  }
  async function onSignal({call: id, from, payload}) {
    if (!payload || typeof payload !== 'object' || !from?.member) return;
    if (payload.type === 'decline') {
      if (call && call.id === id && call.phase === 'ringing' && (!call.target || call.target.member === from.member)) {
        endCall(payload.reason === 'busy' ? `${from.name} ${t('est déjà en appel.', 'is already on a call.')}` : `${from.name} ${t('ne peut pas répondre pour le moment.', 'cannot answer right now.')}`);
      }
      return;
    }
    if (!call || call.id !== id) return;
    const peer = ensurePeer(from.member, from.name);
    if (!peer) return;
    const pc = peer.pc;
    try {
      if (payload.type === 'sdp' && payload.description?.type) {
        const description = payload.description;
        const collision = description.type === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable');
        peer.ignoreOffer = !peer.polite && collision;
        if (peer.ignoreOffer) return;
        await pc.setRemoteDescription(description);
        if (description.type === 'offer') {
          await pc.setLocalDescription();
          signal(from.member, {type: 'sdp', description: pc.localDescription?.toJSON ? pc.localDescription.toJSON() : pc.localDescription});
        }
      } else if (payload.type === 'ice' && payload.candidate) {
        try { await pc.addIceCandidate(payload.candidate); }
        catch (error) { if (!peer.ignoreOffer) throw error; }
      }
    } catch (error) { console.error('[call] signal', error); }
  }
  function closePeer(peer) {
    try { peer.channel?.close(); } catch { /* déjà fermé */ }
    peer.pc.onnegotiationneeded = peer.pc.onicecandidate = peer.pc.ontrack = peer.pc.oniceconnectionstatechange = peer.pc.onconnectionstatechange = peer.pc.ondatachannel = null;
    try { peer.pc.close(); } catch { /* déjà fermé */ }
    if (peer.video) peer.video.srcObject = null;
    peer.node?.remove();
  }
  function removePeer(member) {
    const peer = call?.peers.get(member);
    if (!peer) return null;
    clearTimeout(peer.grace);
    closePeer(peer);
    call.peers.delete(member);
    if (online.get(member)?.call === call.id) online.get(member).call = null;
    host.dataset.count = String(call.peers.size);
    return peer;
  }
  function dropPeer(member) {
    const peer = removePeer(member);
    if (!peer) return;
    if (!call.peers.size) endCall(`${peer.name} ${t('a raccroché.', 'hung up.')}`);
    else { renderPeers(); refreshStatus(); }
  }

  /* ---------- Cycle de vie d'un appel ---------- */
  function newId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
  function inviteUrl(id) {
    const url = new URL(en ? '/index-en.html' : '/index.html', location.href);
    url.search = ''; url.hash = '';
    url.searchParams.set('app', '1'); url.searchParams.set('call', id);
    return url.toString();
  }
  function guard() { const f = family(); return !f || f.guard('calls'); }
  function beginCall(id, phase, target, link) {
    call = {id, phase, target: target || null, peers: new Map(), link: link || '', startedAt: 0, timeout: null, clock: null};
    el('call-link').value = link || '';
    el('call-share-status').textContent = '';
    window.BeybooVoice?.leave?.();
    notice(); controls(); renderPeers(); refreshStatus();
  }
  async function setup(id) {
    await Promise.all([prepareMedia(), loadIce()]);
    return !!call && call.id === id;
  }
  async function callPeer(target) {
    if (call || !guard() || !online.has(target.member)) return;
    const id = newId();
    beginCall(id, 'ringing', {member: target.member, name: target.name});
    startTone('ringback');
    if (!await setup(id)) return;
    if (!room().send({type: 'ring', call: id})) { endCall(t('Connexion à la famille perdue. Réessayez dans un instant.', 'Family connection lost. Try again in a moment.'), 'error'); return; }
    call.timeout = setTimeout(() => { if (call?.id === id && call.phase === 'ringing') endCall(`${target.name} ${t('n’a pas répondu.', 'did not answer.')}`); }, RING_TIMEOUT);
    refreshStatus();
  }
  async function joinCall(id, from) {
    if (call || !CALL_ID.test(id)) return;
    beginCall(id, 'connecting', from || null);
    status(t('Connexion…', 'Connecting…'), 'connecting');
    if (!await setup(id)) return;
    if (!room().send({type: 'join', call: id})) { endCall(t('Connexion à la famille perdue. Réessayez dans un instant.', 'Family connection lost. Try again in a moment.'), 'error'); return; }
    mediaNotice();
  }
  async function createLink() {
    if (call || !guard()) return;
    const id = newId();
    beginCall(id, 'waiting', null, inviteUrl(id));
    if (!await setup(id)) return;
    if (!room().send({type: 'join', call: id})) { endCall(t('Connexion à la famille perdue. Réessayez dans un instant.', 'Family connection lost. Try again in a moment.'), 'error'); return; }
    mediaNotice(); refreshStatus();
  }
  function endCall(message, state = 'ready') {
    if (!call) return;
    const ended = call;
    clearTimeout(ended.timeout); clearInterval(ended.clock);
    for (const peer of ended.peers.values()) {
      clearTimeout(peer.grace);
      if (peer.channel?.readyState === 'open') { try { peer.channel.send(JSON.stringify({type: 'bye'})); } catch { /* canal fermé */ } }
      closePeer(peer);
      if (online.get(peer.member)?.call === ended.id) online.get(peer.member).call = null;
    }
    call = null;
    room()?.send({type: 'leave'});
    stopTone(); releaseMedia();
    host.replaceChildren(); host.hidden = true; placeholder.hidden = false; delete host.dataset.count;
    el('call-clock').textContent = '';
    soundButton?.remove(); soundButton = null;
    wide(false); notice(); controls(); renderPeers();
    status(message || t('Appel terminé. Caméra et micro arrêtés.', 'Call ended. Camera and microphone stopped.'), state);
  }

  /* ---------- Appel entrant : bannière dans l'œil, quel que soit l'écran ---------- */
  function showBanner(from) {
    if (!incoming) return;
    if (!incoming.node) {
      const banner = node('div', 'call-ring');
      banner.setAttribute('role', 'alertdialog');
      banner.setAttribute('aria-live', 'assertive');
      banner.setAttribute('aria-label', t('Appel entrant', 'Incoming call'));
      if (reduceMotion) banner.dataset.motion = 'reduce';
      const who = node('b', 'call-ring-name');
      const actions = node('div', 'call-ring-actions');
      actions.append(button(t('Accepter', 'Accept'), accept, 'call-ring-accept'), button(t('Refuser', 'Decline'), decline, 'call-ring-decline'));
      banner.append(node('span', 'call-ring-icon', '▣'), who, node('span', 'call-ring-text', t('t’appelle', 'is calling you')), actions);
      (screen || document.body).append(banner);
      incoming.node = banner; incoming.who = who;
    }
    incoming.who.textContent = from.name;
    incoming.node.hidden = false;
  }
  function dismissIncoming(message) {
    if (!incoming) return;
    clearTimeout(incoming.timer);
    incoming.node?.remove();
    incoming = null;
    stopTone();
    if (message && !call) status(message);
  }
  function onRing({call: id, from}) {
    if (!CALL_ID.test(id || '') || !from?.member || from.member === me()) return;
    if (call && call.id === id) return;
    if (call) { room()?.send({type: 'signal', call: id, to: from.member, payload: {type: 'decline', reason: 'busy'}}); return; }
    const f = family();
    if (f && !f.allowed('calls')) return;
    if (incoming?.call === id) { showBanner(from); return; }
    dismissIncoming();
    incoming = {call: id, from, node: null, who: null, timer: setTimeout(() => dismissIncoming(`${t('Appel manqué de', 'Missed call from')} ${from.name}.`), RING_TIMEOUT)};
    showBanner(from);
    startTone('ring');
  }
  async function accept() {
    const ringing = incoming;
    if (!ringing) return;
    dismissIncoming();
    if (!guard()) { room()?.send({type: 'signal', call: ringing.call, to: ringing.from.member, payload: {type: 'decline'}}); return; }
    if (typeof window.showMode === 'function') window.showMode('call'); else window.BeybooCall.enter();
    if (!visible) return;
    await joinCall(ringing.call, ringing.from);
  }
  function decline() {
    const ringing = incoming;
    if (!ringing) return;
    dismissIncoming(t('Appel refusé.', 'Call declined.'));
    room()?.send({type: 'signal', call: ringing.call, to: ringing.from.member, payload: {type: 'decline'}});
  }

  /* ---------- Connexion à la famille ---------- */
  function showSignIn(signIn) {
    const form = el('call-signin');
    signInShown = true;
    form.hidden = false;
    const link = el('call-signin-link');
    const code = el('call-code');
    code.hidden = signIn?.kind !== 'password';
    el('call-signin-submit').hidden = signIn?.kind !== 'password';
    if (signIn?.kind === 'password') { link.hidden = true; status(t('Entrez le code famille pour voir vos proches et les appeler.', 'Enter the family code to see and call your family.'), 'signin'); }
    else if (signIn?.kind === 'reload') { link.href = location.pathname + location.search + '#experience'; link.textContent = t('Recharger la page pour se connecter ↗', 'Reload the page to sign in ↗'); link.hidden = false; status(t('Connectez-vous pour appeler vos proches.', 'Sign in to call your family.'), 'signin'); }
    else if (signIn?.url) { link.href = signIn.url; link.textContent = t('Se connecter ↗', 'Sign in ↗'); link.hidden = false; status(t('Connectez-vous pour appeler vos proches.', 'Sign in to call your family.'), 'signin'); }
    else { link.hidden = true; status(t('Connexion indisponible pour l’instant.', 'Sign-in is unavailable right now.'), 'error'); }
    controls(); renderPeers();
  }
  function hideSignIn() {
    signInShown = false;
    el('call-signin').hidden = true;
    controls(); renderPeers();
  }
  let sessionCheck = null;
  async function ensureSession() {
    const r = room();
    if (!r) { status(t('La salle de famille n’est pas disponible sur cette page.', 'The family room is not available on this page.'), 'error'); return false; }
    if (r.status() === 'open') return true;
    if (sessionCheck) return sessionCheck;
    sessionCheck = (async () => {
      const info = await r.signedIn();
      if (info.authenticated) { hideSignIn(); r.connect(); return true; }
      showSignIn(info.signIn);
      return false;
    })().finally(() => { sessionCheck = null; });
    return sessionCheck;
  }
  async function submitCode(event) {
    event.preventDefault();
    const r = room();
    const code = el('call-code');
    const value = String(code.value || '').trim();
    if (!r || !value) return;
    const submit = el('call-signin-submit');
    submit.disabled = true;
    el('call-signin-status').textContent = '';
    try {
      const {ok, message} = await r.login(value);
      if (!ok) { el('call-signin-status').textContent = message || t('Code incorrect.', 'Incorrect code.'); return; }
      code.value = '';
      hideSignIn(); status(t('Connexion à la famille…', 'Connecting to the family…'), 'ready');
      r.connect();
    } catch { el('call-signin-status').textContent = t('Connexion impossible. Vérifiez le réseau.', 'Could not connect. Check the network.'); }
    finally { submit.disabled = false; }
  }
  function setPeers(list) {
    online.clear();
    for (const peer of list || []) if (peer?.member) online.set(peer.member, {member: peer.member, name: peer.name || t('Un proche', 'Someone'), call: peer.call || null});
    renderPeers();
  }
  function onHello(data) {
    connected = true; hideSignIn(); setPeers(data.peers);
    if (call) { room()?.send({type: 'join', call: call.id}); mediaNotice(); }
    else if (visible) status(t('Prêts pour un vrai coucou ?', 'Ready to say hello?'));
    if (pendingJoin) {
      const id = pendingJoin; pendingJoin = '';
      if (typeof window.showMode === 'function') window.showMode('call'); else window.BeybooCall.enter();
      if (visible && !call) joinCall(id);
    }
  }
  function onStatus(state) {
    if (state === 'open') return;
    connected = false; renderPeers();
    if (state === 'unauthorized') { endCall(t('Session expirée. Entrez de nouveau le code famille.', 'Session expired. Enter the family code again.'), 'error'); showSignIn({kind: 'password'}); return; }
    if (call && call.phase === 'ringing') endCall(t('Connexion à la famille perdue pendant la sonnerie.', 'Family connection lost while ringing.'), 'error');
    else if (call) notice(t('Connexion à la famille interrompue : l’appel en cours continue, la mise en relation se rétablit en arrière-plan.', 'Family connection interrupted: the current call continues while signalling reconnects in the background.'));
    else if (visible && !signInShown) status(t('Connexion à la famille…', 'Connecting to the family…'), 'ready');
  }
  function onPeerJoined({call: id, from}) {
    if (!from?.member) return;
    if (incoming && incoming.call === id && from.member !== incoming.from.member) { dismissIncoming(t('Répondu sur un autre appareil.', 'Answered on another device.')); return; }
    if (!call || call.id !== id) return;
    ensurePeer(from.member, from.name);
  }
  function onCallPeers({call: id, peers}) {
    if (!call || call.id !== id) return;
    for (const peer of peers || []) ensurePeer(peer.member, peer.name);
    if (!call.peers.size) { call.phase = 'waiting'; refreshStatus(); }
  }
  function onPeerLeft({call: id, from}) {
    if (incoming && incoming.call === id && from?.member === incoming.from.member) { dismissIncoming(`${t('Appel annulé par', 'Call cancelled by')} ${from.name}.`); return; }
    if (!call || call.id !== id) return;
    const peer = call.peers.get(from?.member);
    if (!peer) return;
    // Liaison directe encore vivante : le pair a seulement perdu la salle (il enverra « bye » s'il raccroche vraiment).
    if (peer.state === 'connected' && peer.channelOpen && !peer.grace) {
      peer.grace = setTimeout(() => { peer.grace = null; if (call?.peers.get(peer.member) === peer && peer.state !== 'connected') dropPeer(peer.member); }, 15000);
      return;
    }
    dropPeer(from.member);
  }
  function boot() {
    if (booted) return;
    const r = room();
    if (!r) return;
    booted = true;
    r.on('hello', onHello); r.on('presence', data => setPeers(data.peers)); r.on('status', onStatus);
    r.on('ring', onRing); r.on('peer-joined', onPeerJoined); r.on('call-peers', onCallPeers); r.on('peer-left', onPeerLeft); r.on('signal', onSignal);
    if (r.status() === 'open' && r.hello()) onHello(r.hello());
    // En mode application, la salle est jointe dès l'ouverture : un appel entrant sonne sur n'importe quel écran.
    if (pendingJoin || document.documentElement.classList.contains('beyboo-app')) ensureSession();
  }

  /* ---------- Boutons ---------- */
  el('call-start').addEventListener('click', createLink);
  el('call-end').addEventListener('click', () => { endCall(call?.phase === 'ringing' ? t('Appel annulé.', 'Call cancelled.') : undefined); el('call-start').focus(); });
  el('call-audio').addEventListener('click', () => toggleTrack('audio'));
  el('call-video').addEventListener('click', () => toggleTrack('video'));
  el('call-size').addEventListener('click', () => wide(!card.classList.contains('is-call-wide')));
  el('call-signin').addEventListener('submit', submitCode);
  async function copyLink() {
    const input = el('call-link');
    try {
      await navigator.clipboard.writeText(input.value);
      el('call-share-status').textContent = t('Lien copié. Collez-le dans votre message à votre proche.', 'Link copied. Paste it into your message.');
    } catch {
      input.focus(); input.select();
      el('call-share-status').textContent = t('Sélectionnez et copiez ce lien, puis envoyez-le à votre proche.', 'Select and copy this link, then send it to your contact.');
    }
  }
  el('call-copy').addEventListener('click', copyLink);
  el('call-share').addEventListener('click', async () => {
    if (!navigator.share) { await copyLink(); return; }
    try {
      await navigator.share({title: t('Un coucou avec BOOZZO', 'Say hello with BOOZZO'), text: t('Rejoins-moi pour notre appel vidéo :', 'Join me for our video call:'), url: el('call-link').value});
      el('call-share-status').textContent = t('Lien transmis au menu de partage.', 'Link handed to the share menu.');
    } catch (error) { if (error.name !== 'AbortError') await copyLink(); }
  });
  window.addEventListener('pagehide', () => { endCall(); dismissIncoming(); });
  // Changer d'onglet n'interrompt pas un appel : partager le lien ou répondre à un message reste possible.

  window.BeybooCall = {
    enter() {
      if (!guard()) return;
      visible = true; panel.hidden = stage.hidden = false;
      card.classList.add('is-call');
      window.BeybooCompanion?.refresh();
      controls(); renderPeers();
      if (!call && connected && !signInShown) status(t('Prêts pour un vrai coucou ?', 'Ready to say hello?'));
      boot(); ensureSession();
    },
    leave() {
      if (!visible && !call) return;
      endCall();
      visible = false; panel.hidden = stage.hidden = true;
      card.classList.remove('is-call', 'is-call-wide');
    },
    active: () => !!call,
    state: () => call ? {id: call.id, phase: call.phase, media: mediaMode, peers: [...call.peers.values()].map(p => ({member: p.member, name: p.name, state: p.state, ice: p.pc.iceConnectionState, channel: p.channelOpen, channelState: p.channel?.readyState || null, remoteMedia: p.media}))} : null
  };
  if (document.readyState === 'complete') boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
