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
    el('call-size').textContent = value ? 'Show in the eye' : 'Enlarge call';
    el('call-size').setAttribute('aria-pressed', String(value));
  }
  function controls() {
    el('call-start').hidden = active || (!embedded && !!room);
    el('call-start').textContent = room ? 'Join this call' : 'Start a video call';
    if(!embedded)el('call-start').textContent='Prepare a call link';
    el('call-end').hidden = !active;
    el('call-end').textContent = joined ? 'Hang up' : 'Cancel';
    el('call-media').hidden = !joined;
    el('call-size').hidden = !joined;
    el('call-audio').textContent = audioMuted ? 'Unmute mic' : 'Mute mic';
    el('call-video').textContent = videoMuted ? 'Turn on camera' : 'Turn off camera';
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
      notice('This control is unavailable. You can open this call in Jitsi.');
    }
  }
  function updatePeers() {
    if (!joined) return;
    const count = peers.size;
    status(count ? (count === 1 ? 'Your guest has joined the call.' : `${count} guests have joined the call.`) : 'You’re connected. Waiting for your guest…', count ? 'connected' : 'waiting');
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
  function finish(message = 'You’ve left the call. Your camera and mic are off.') {
    cleanup(); notice(); status(message);
  }
  function deviceIssue(kind) {
    notice(`${kind} unavailable. Check your browser permissions and devices. You can also open this call in Jitsi.`);
    wide(true);
  }
  async function start() {
    if(window.BeybooFamily && !window.BeybooFamily.guard('calls'))return false;
    if (active) return;
    if (!room) setRoom();
    notice();
    if(!embedded){status('Your link is ready. Open the room in Jitsi and share the same link with your guest.');el('call-external').focus();return;}
    // An HTTPS ancestor is required for camera/microphone capture inside an iframe.
    if (!window.isSecureContext || !navigator.mediaDevices || !window.RTCPeerConnection) {
      status('Open the call in Jitsi to use your camera and mic.', 'error');
      notice('Calling inside the eye needs a compatible browser and a secure connection. You can still use the link below.');
      return;
    }
    window.BeybooVoice?.leave();
    document.querySelectorAll('video[data-brand-film]').forEach(video => video.pause());
    active = true;
    const run = ++generation;
    controls(); wide(true);
    status('Opening Jitsi. Get your camera and mic ready…', 'connecting');
    try {
      await loadProvider();
      if (run !== generation || !visible) return;
      host.hidden = false; placeholder.hidden = true;
      api = new window.JitsiMeetExternalAPI(hostName, {
        roomName: room, parentNode: host, width: '100%', height: '100%', lang: 'en',
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
      frame.title = 'BEYBOO video call via Jitsi Meet';
      frame.setAttribute('allow', 'camera; microphone; autoplay; fullscreen');
      const on = (event, callback) => instance.addListener(event, data => {
        if (run === generation && api === instance) callback(data);
      });
      status('Sign in to Jitsi, then join the call.', 'connecting');
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
      on('cameraError', () => deviceIssue('Camera'));
      on('micError', () => deviceIssue('Microphone'));
      on('errorOccurred', event => {
        if (event.isFatal) {
          cleanup(); status('The call was disconnected.', 'error');
          notice('Try again or open this call in Jitsi using the link below.');
        } else notice('Jitsi reported a problem. If the call isn’t working, open it in Jitsi.');
      });
      watchdog = setTimeout(() => {
        if (run === generation && !joined) notice('If you can’t see the sign-in screen, open this call in Jitsi. The host needs to sign in to create the room.');
      }, 25000);
    } catch {
      if (run !== generation) return;
      cleanup(); status('Couldn’t load Jitsi.', 'error');
      notice('Check your connection and try again. You can also open your link directly in Jitsi.');
    }
  }
  async function copyLink() {
    const input = el('call-link');
    try {
      await navigator.clipboard.writeText(input.value);
      el('call-share-status').textContent = 'Link copied. Paste it into a message to invite your guest.';
    } catch {
      input.focus(); input.select();
      el('call-share-status').textContent = 'Select and copy this link, then send it to your guest.';
    }
  }
  el('call-start').addEventListener('click', start);
  el('call-end').addEventListener('click', () => { finish(); el('call-start').focus(); });
  el('call-new').addEventListener('click', () => {
    if (active) return;
    setRoom(); notice(); status('Your new link is ready. Join the call, then invite your guest.');
  });
  el('call-audio').addEventListener('click', () => { if (joined) command('toggleAudio'); });
  el('call-video').addEventListener('click', () => { if (joined) command('toggleVideo'); });
  el('call-size').addEventListener('click', () => wide(!card.classList.contains('is-call-wide')));
  el('call-copy').addEventListener('click', copyLink);
  el('call-share').addEventListener('click', async () => {
    if (!navigator.share) { await copyLink(); return; }
    try {
      await navigator.share({ title: 'Say hello with BEYBOO', text: 'Join my video call:', url: el('call-link').value });
      el('call-share-status').textContent = 'Link opened in the share menu.';
    } catch (error) { if (error.name !== 'AbortError') await copyLink(); }
  });
  el('call-external').addEventListener('click', () => embedded ? finish('Continue your call in the Jitsi tab. The call inside BEYBOO has ended.') : status('Your room opens in Jitsi.'));
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
