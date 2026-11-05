/* Real video-call trial. Jitsi owns media and signalling; no simulated replies. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const panel = el('call-panel');
  if (!panel) return;
  const card = document.querySelector('.experience-card');
  // Only a separately configured Jitsi host may serve the embedded call.
  const hostName = panel.dataset.jitsiHost || '';
  const embedded = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hostName) && hostName !== 'meet.jit.si';
  const stage = el('call-stage');
  const host = el('call-host');
  const placeholder = el('call-placeholder');
  const peers = new Map();
  let api = null, scriptPromise = null, generation = 0;
  let room = '', joined = false, active = false, localId = '', visible = false;
  let audioMuted = true, videoMuted = true, startedAt = 0, timer = null, watchdog = null;

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
    el('call-size').textContent = value ? 'Afficher dans l’œil' : 'Agrandir l’appel';
    el('call-size').setAttribute('aria-pressed', String(value));
  }
  function controls() {
    el('call-start').hidden = active || (!embedded && !!room);
    el('call-start').textContent = room ? 'Rejoindre cet appel' : 'Créer l’appel vidéo';
    if(!embedded)el('call-start').textContent='Préparer le lien d’appel';
    el('call-end').hidden = !active;
    el('call-end').textContent = joined ? 'Raccrocher' : 'Annuler';
    el('call-media').hidden = !joined;
    el('call-size').hidden = !joined;
    el('call-audio').textContent = audioMuted ? 'Activer le micro' : 'Couper le micro';
    el('call-video').textContent = videoMuted ? 'Activer la caméra' : 'Couper la caméra';
    el('call-audio').setAttribute('aria-pressed', String(!audioMuted));
    el('call-video').setAttribute('aria-pressed', String(!videoMuted));
    el('call-new').hidden = !room || active;
    el('call-invite').hidden = !room;
  }
  function setRoom() {
    // 128 random bits: room names contain no contact, child or account information.
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    room = 'Beyboo' + Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
    const url = 'https://' + (embedded ? hostName : 'meet.jit.si') + '/' + room;
    el('call-link').value = url;
    el('call-external').href = url;
    el('call-external').hidden = window.BeybooFamily ? !window.BeybooFamily.allowed('calls') : false;
    el('call-share-status').textContent = '';
    controls();
  }
  function loadProvider() {
    if (window.JitsiMeetExternalAPI) return Promise.resolve();
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      let settled = false;
      const done = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        script.onload = script.onerror = null;
        if (error) { script.remove(); reject(error); } else resolve();
      };
      const timeout = setTimeout(() => done(new Error('provider_unavailable')), 15000);
      script.src = 'https://' + hostName + '/external_api.js';
      script.async = true;
      script.onload = () => done(window.JitsiMeetExternalAPI ? null : new Error('provider_unavailable'));
      script.onerror = () => done(new Error('provider_unavailable'));
      document.head.append(script);
    }).catch(error => { scriptPromise = null; throw error; });
    return scriptPromise;
  }
  function command(name, ...args) {
    if (!api) return;
    try { api.executeCommand(name, ...args); } catch {
      notice('Cette commande est indisponible. Vous pouvez ouvrir le même appel dans Jitsi.');
    }
  }
  function updatePeers() {
    if (!joined) return;
    const count = peers.size;
    status(count ? (count === 1 ? 'Votre proche a rejoint l’appel.' : `${count} proches ont rejoint l’appel.`) : 'Vous êtes connecté. En attente de votre proche…', count ? 'connected' : 'waiting');
    const first = peers.keys().next().value;
    if (first) {
      try { api.pinParticipant(first); api.setLargeVideoParticipant(first); } catch { /* The default speaker layout remains usable. */ }
    }
  }
  function cleanup() {
    // Invalidate every pending loader, provider event and promise before removing media.
    generation++;
    clearInterval(timer); clearTimeout(watchdog);
    timer = watchdog = null;
    const previous = api;
    api = null; active = false; joined = false; localId = '';
    peers.clear(); audioMuted = videoMuted = true;
    if (previous) {
      try { previous.executeCommand('hangup'); } catch { /* Removing the iframe also ends its media. */ }
      try { previous.dispose(); } catch { /* Always remove the media document below. */ }
    }
    host.replaceChildren();
    host.hidden = true; placeholder.hidden = false;
    el('call-clock').textContent = '';
    wide(false); controls();
  }
  function finish(message = 'Vous avez quitté l’appel. Caméra et micro arrêtés.') {
    cleanup(); notice(); status(message);
  }
  function deviceIssue(kind) {
    notice(`${kind} indisponible. Vérifiez les autorisations du navigateur et vos appareils. Vous pouvez aussi ouvrir cet appel dans Jitsi.`);
    wide(true);
  }
  async function start() {
    if(window.BeybooFamily && !window.BeybooFamily.guard('calls'))return false;
    if (active) return;
    if (!room) setRoom();
    notice();
    if(!embedded){status('Lien prêt. Ouvrez la salle dans Jitsi et partagez le même lien avec votre proche.');el('call-external').focus();return;}
    // An HTTPS ancestor is required for camera/microphone capture inside an iframe.
    if (!window.isSecureContext || !navigator.mediaDevices || !window.RTCPeerConnection) {
      status('Ouvrez l’appel dans Jitsi pour utiliser la caméra et le micro.', 'error');
      notice('L’appel intégré nécessite un navigateur compatible et une page HTTPS. Le lien ci-dessous reste utilisable.');
      return;
    }
    window.BeybooVoice?.leave();
    document.querySelectorAll('video[data-brand-film]').forEach(video => video.pause());
    active = true;
    const run = ++generation;
    controls(); wide(true);
    status('Ouverture de Jitsi. Préparez votre caméra et votre micro…', 'connecting');
    try {
      await loadProvider();
      if (run !== generation || !visible) return;
      host.hidden = false; placeholder.hidden = true;
      api = new window.JitsiMeetExternalAPI(hostName, {
        roomName: room, parentNode: host, width: '100%', height: '100%', lang: 'fr',
        configOverwrite: {
          prejoinConfig: { enabled: true },
          disableDeepLinking: true,
          startWithAudioMuted: false, startWithVideoMuted: false,
          toolbarButtons: [],
          hideConferenceSubject: true, hideConferenceTimer: true,
          filmstrip: { disableResizable: true, disableStageFilmstrip: true },
          disablePolls: true, disableReactions: true,
          enableWelcomePage: false
        },
        interfaceConfigOverwrite: { FILM_STRIP_MAX_HEIGHT: 0, TILE_VIEW_MAX_COLUMNS: 1 }
      });
      const instance = api;
      const frame = instance.getIFrame();
      frame.title = 'Appel vidéo BEYBOO via Jitsi Meet';
      frame.setAttribute('allow', 'camera; microphone; autoplay; fullscreen');
      const on = (event, callback) => instance.addListener(event, data => {
        if (run === generation && api === instance) callback(data);
      });
      status('Connectez-vous à Jitsi, puis rejoignez l’appel.', 'connecting');
      on('videoConferenceJoined', event => {
        if (joined) return;
        clearTimeout(watchdog);
        joined = true; localId = event.id; peers.delete(localId);
        startedAt = Date.now();
        timer = setInterval(() => {
          const seconds = Math.floor((Date.now() - startedAt) / 1000);
          el('call-clock').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        }, 1000);
        notice(); controls(); wide(false); updatePeers();
        Promise.allSettled([
          Promise.resolve().then(() => instance.isAudioMuted()),
          Promise.resolve().then(() => instance.isVideoMuted()),
          Promise.resolve().then(() => instance.getRoomsInfo())
        ]).then(results => {
          if (run !== generation || api !== instance) return;
          if (results[0].status === 'fulfilled') audioMuted = results[0].value;
          if (results[1].status === 'fulfilled') videoMuted = results[1].value;
          if (results[2].status === 'fulfilled') {
            for (const meeting of results[2].value.rooms || []) {
              if (!meeting.isMainRoom) continue;
              for (const participant of meeting.participants || []) {
                if (participant.id !== localId && !participant.isHidden) peers.set(participant.id, true);
              }
            }
          }
          controls(); updatePeers();
        });
      });
      on('participantJoined', event => { if (event.id !== localId) peers.set(event.id, true); updatePeers(); });
      on('participantLeft', event => { peers.delete(event.id); updatePeers(); });
      on('audioMuteStatusChanged', event => { audioMuted = event.muted; controls(); });
      on('videoMuteStatusChanged', event => { videoMuted = event.muted; controls(); });
      on('filmstripDisplayChanged', event => { if (event.visible) command('toggleFilmStrip'); });
      on('tileViewChanged', event => { if (event.enabled) command('toggleTileView'); });
      on('videoConferenceLeft', () => finish());
      on('readyToClose', () => finish());
      on('cameraError', () => deviceIssue('Caméra'));
      on('micError', () => deviceIssue('Micro'));
      on('errorOccurred', event => {
        if (event.isFatal) {
          cleanup(); status('La connexion à l’appel a été interrompue.', 'error');
          notice('Réessayez ou ouvrez le même appel dans Jitsi avec le lien ci-dessous.');
        } else notice('Jitsi signale une difficulté. Si l’appel ne fonctionne pas, ouvrez-le dans Jitsi.');
      });
      watchdog = setTimeout(() => {
        if (run === generation && !joined) notice('Si la connexion ne s’affiche pas, ouvrez le même appel dans Jitsi. L’organisateur doit se connecter pour créer la salle.');
      }, 25000);
    } catch {
      if (run !== generation) return;
      cleanup(); status('Jitsi ne s’est pas chargé.', 'error');
      notice('Vérifiez votre connexion, puis réessayez. Vous pouvez aussi ouvrir votre lien directement dans Jitsi.');
    }
  }
  async function copyLink() {
    const input = el('call-link');
    try {
      await navigator.clipboard.writeText(input.value);
      el('call-share-status').textContent = 'Lien copié. Collez-le dans votre message à votre proche.';
    } catch {
      input.focus(); input.select();
      el('call-share-status').textContent = 'Sélectionnez et copiez ce lien, puis envoyez-le à votre proche.';
    }
  }
  el('call-start').addEventListener('click', start);
  el('call-end').addEventListener('click', () => { finish(); el('call-start').focus(); });
  el('call-new').addEventListener('click', () => {
    if (active) return;
    setRoom(); notice(); status('Nouveau lien prêt. Rejoignez cet appel, puis invitez votre proche.');
  });
  el('call-audio').addEventListener('click', () => { if (joined) command('toggleAudio'); });
  el('call-video').addEventListener('click', () => { if (joined) command('toggleVideo'); });
  el('call-size').addEventListener('click', () => wide(!card.classList.contains('is-call-wide')));
  el('call-copy').addEventListener('click', copyLink);
  el('call-share').addEventListener('click', async () => {
    if (!navigator.share) { await copyLink(); return; }
    try {
      await navigator.share({ title: 'Un coucou avec BEYBOO', text: 'Rejoins-moi pour notre appel vidéo :', url: el('call-link').value });
      el('call-share-status').textContent = 'Lien transmis au menu de partage.';
    } catch (error) { if (error.name !== 'AbortError') await copyLink(); }
  });
  el('call-external').addEventListener('click', () => embedded ? finish('Poursuivez l’appel dans l’onglet Jitsi. L’appel intégré est arrêté.') : status('La salle s’ouvre dans Jitsi.'));
  window.addEventListener('pagehide', () => { if (active) finish(); else cleanup(); });
  // Do not end on visibilitychange: sharing a link or completing Jitsi login changes tabs.
  window.BeybooCall = {
    enter() {
      if(window.BeybooFamily && !window.BeybooFamily.guard('calls'))return;
      visible = true; panel.hidden = stage.hidden = false;
      card.classList.add('is-call');
      window.BeybooCompanion?.refresh();
      controls();
    },
    leave() {
      if (!visible && !active) return;
      if (active) finish();
      visible = false; panel.hidden = stage.hidden = true;
      card.classList.remove('is-call', 'is-call-wide');
    }
  };
})();
