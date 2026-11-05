/* Real voice conversation. The plush stays still; only the screen reacts. */
(() => {
  'use strict';
  const panel = document.querySelector('#voice-panel');
  if (!panel) return;
  const q = id => document.getElementById(id);
  const eye = q('living-eye');
  const start = q('voice-start'), stopButton = q('voice-stop'), muteButton = q('voice-mute');
  const form = q('voice-form'), input = q('voice-question'), send = q('voice-send');
  const transcript = q('voice-transcript'), status = q('voice-status');
  const character = q('voice-character'), voice = q('voice-choice');
  let pc = null, dc = null, stream = null, audio = null, timer = null, timeout = null;
  let token = null, serial = 0, active = false, busy = false, muted = false, responding = false;
  let cancelReady = null, toolBridge = null, previewing = false, previewText = '', soundReady = false;
  let startedAt = 0, duration = 180, currentReply = '', mounted = false;
  const rows = new Map();
  const OFFLINE_MESSAGE = 'Le serveur vocal n’est pas disponible sur cet hébergement. Les jeux, la musique et la veilleuse fonctionnent sans lui.';
  /* Every /api answer must be JSON; HTML means the voice server is absent (static hosting, edge error). */
  async function api(url, options = {}, fallback = OFFLINE_MESSAGE) {
    const response = await fetch(url, {cache:'no-store', ...options});
    if (!(response.headers.get('content-type') || '').includes('json')) throw new Error(fallback);
    return {response, data: await response.json()};
  }
  let passwordForm = null;
  function buildPasswordForm() {
    if (passwordForm) return passwordForm;
    passwordForm = document.createElement('form'); passwordForm.className = 'voice-password'; passwordForm.hidden = true;
    passwordForm.innerHTML = '<label>Code d’accès du site<input type="password" name="password" autocomplete="current-password" maxlength="200" required></label><button type="submit">Entrer</button><p role="status"></p>';
    q('voice-sign-in').after(passwordForm);
    passwordForm.addEventListener('submit', async event => {
      event.preventDefault(); const note = passwordForm.querySelector('p'); note.textContent = 'Vérification…';
      try {
        const {response, data} = await api('/api/auth/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({password: passwordForm.elements.namedItem('password').value})});
        if (!response.ok) { note.textContent = data.message || 'Code d’accès incorrect.'; return; }
        passwordForm.hidden = true; passwordForm.reset(); note.textContent = ''; state('idle', 'Accès ouvert. Tu peux lancer la conversation.');
      } catch (error) { note.textContent = error.message; }
    });
    return passwordForm;
  }
  /* The server says how to sign in: a link (ChatGPT), a shared code (password mode) or a reload (Cloudflare Access). */
  function signInPrompt(signIn) {
    const link = q('voice-sign-in');
    if (signIn?.kind === 'password') { buildPasswordForm().hidden = false; return; }
    if (signIn?.kind === 'reload') { link.href = location.pathname + location.search + '#experience'; link.textContent = 'Recharger la page pour se connecter ↗'; link.hidden = false; return; }
    if (signIn?.url) link.href = signIn.url;
    link.hidden = false;
  }
  let editionId = null;
  function editionState(id, kind, message) {
    document.dispatchEvent(new CustomEvent('beyboo-edition-voice', {detail:{id,kind,message}}));
  }

  function state(kind, message) {
    if (editionId) {
      editionState(editionId, kind, message);
      return;
    }
    eye.dataset.voiceState = kind;
    panel.dataset.state = kind;
    status.textContent = message;
    window.BeybooEye?.phase(kind);
    q('voice-live-label').textContent = ({idle:'Prêt à t’écouter',connecting:'Connexion…',listening:'Je t’écoute',thinking:'Je réfléchis',speaking:'Je te réponds',muted:'Micro coupé',error:'À réessayer'})[kind] || message;
    q('voice-live-meter').dataset.phase = kind;
    q('device-hint').textContent = message;
    document.dispatchEvent(new CustomEvent('beyboo-voice-state',{detail:{kind,message,active,busy,preview:previewing}}));
  }
  function controls() {
    start.hidden = active || busy;
    stopButton.hidden = !active && !busy;
    muteButton.hidden = !active || !stream;
    muteButton.textContent = muted ? 'Réactiver le micro' : 'Couper le micro';
    muteButton.setAttribute('aria-pressed', String(muted));
    character.disabled = voice.disabled = active || busy;
    send.disabled = busy || previewing;
  }
  function row(id, who, text, append = false) {
    if (editionId) return;
    let entry = rows.get(id);
    if (!entry) {
      const li = document.createElement('li');
      li.className = who === 'Vous' ? 'voice-message voice-user' : 'voice-message';
      const label = document.createElement('b'); label.textContent = who;
      const content = document.createElement('p'); li.append(label, content); transcript.append(li);
      entry = { li, content }; rows.set(id, entry);
      if (rows.size > 20) { const first = rows.keys().next().value; rows.get(first).li.remove(); rows.delete(first); }
    }
    entry.content.textContent = append ? entry.content.textContent + text : text;
    q('voice-transcript-empty').hidden = true;
    transcript.scrollTop = transcript.scrollHeight;
  }
  function endRemote(endToken) {
    if (!endToken) return;
    fetch('/api/voice/end', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token:endToken}), keepalive:true }).catch(() => {});
  }
  function stop(message = 'Conversation terminée. Le micro est coupé.', kind = 'idle') {
    window.BeybooMood?.reset();
    const stoppedEdition = editionId;
    editionId = null;
    ++serial; active = busy = responding = previewing = soundReady = false; previewText = '';
    toolBridge?.dispose(); toolBridge = null; window.BeybooEye?.release(); window.BeybooScreen?.duck(false);
    clearInterval(timer); clearTimeout(timeout); timer = timeout = null;
    if (cancelReady) { cancelReady(new Error("Session arrêtée.")); cancelReady = null; }
    if (stream) stream.getTracks().forEach(track => track.stop()); stream = null;
    if (dc) { dc.onmessage = null; dc.onclose = null; dc.close(); } dc = null;
    if (pc) { pc.onconnectionstatechange = null; pc.close(); } pc = null;
    if (audio) { audio.pause(); audio.srcObject = null; audio.remove(); } audio = null;
    endRemote(token); token = null;
    q('voice-enable-sound').hidden = true; q('voice-clock').textContent = '';
    controls();
    if (stoppedEdition) {
      editionState(stoppedEdition, kind, message);
      return;
    }
    if (mounted) state(kind, message); else { delete eye.dataset.voiceState; document.dispatchEvent(new CustomEvent('beyboo-voice-state',{detail:{kind:'idle',message,active:false,busy:false}})); }
  }
  function listenState() {
    if(previewing){state('listening','Extrait vocal · ton microphone reste coupé.');return;}
    state('listening', stream && !muted ? 'À toi de parler. Je t’écoute.' : 'Écris ta question. Je te répondrai à voix haute.');
  }
  function playPreview(){
    if(!previewing||!active||!soundReady||!previewText||dc?.readyState!=='open')return;
    const text=previewText;previewText='';
    dc.send(JSON.stringify({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text:'Lis la phrase de comparaison : '+text}]}}));
    dc.send(JSON.stringify({type:'response.create'}));
    responding=true;state('thinking','Je prépare ton extrait…');
  }
  const isCreditError = code => ['credits_required','credit_balance_exhausted','insufficient_quota','billing_hard_limit_reached'].includes(code);
  function providerError(code) {
    const credits = isCreditError(code);
    q('voice-billing').hidden = !credits;
    stop(credits ? 'Le compte OpenAI n’a plus de crédits API disponibles pour cet essai.' : 'La conversation a rencontré une erreur. Tu peux la relancer.','error');
  }
  function handleEvent(event) {
    let e; try { e = JSON.parse(event.data); } catch { return; }
    if (e.type === 'input_audio_buffer.speech_started') { window.BeybooMood?.beginTurn(); toolBridge?.interrupt(); responding = false; window.BeybooScreen?.duck(true); state('listening','Je t’écoute…'); }
    if (e.type === 'input_audio_buffer.speech_stopped') state('thinking','Je prépare ma réponse…');
    if (e.type === 'conversation.item.input_audio_transcription.completed') row(e.item_id,'Vous',e.transcript || '(Paroles non reconnues)');
    if (e.type === 'conversation.item.input_audio_transcription.failed') row(e.item_id,'Vous','La transcription est indisponible pour cette phrase.');
    if (e.type === 'response.created') { responding = true; currentReply = e.response?.id || String(Date.now()); state('thinking','Je prépare ma réponse…'); }
    if (e.type === 'response.output_audio_transcript.delta') row(e.item_id || currentReply,previewing?(voice.selectedOptions[0]?.textContent||'BEYBOO'):(character.selectedOptions[0]?.textContent||'BEYBOO'),e.delta || '',true);
    if (e.type === 'response.output_audio_transcript.done') row(e.item_id || currentReply,previewing?(voice.selectedOptions[0]?.textContent||'BEYBOO'):(character.selectedOptions[0]?.textContent||'BEYBOO'),e.transcript || '');
    if (e.type === 'output_audio_buffer.started') { if(!editionId)window.BeybooMood?.speaking('voice'); window.BeybooScreen?.duck(true); state('speaking','Je te réponds…'); }
    if (e.type === 'output_audio_buffer.stopped' || e.type === 'output_audio_buffer.cleared') { window.BeybooMood?.stop('voice'); window.BeybooScreen?.duck(false); if(previewing){stop('Extrait terminé. Choisis une autre voix ou commence à parler.');return;} listenState(); }
    if (e.type === 'response.done') {
      responding = false;
      if (e.response?.status === 'failed') {
        const code = e.response.status_details?.error?.code;
        providerError(code);
      }
    }
    toolBridge?.handle(e);
    if (e.type === 'error' && !['response_cancel_not_active','response_already_in_progress'].includes(e.error?.code)) providerError(e.error?.code);
  }
  async function connect(withMic, preview = false, edition = null) {
    if(window.BeybooFamily && !window.BeybooFamily.guard('voice'))return false;
    if (active) return true;
    if (busy) return false;
    window.BeybooDevice?.reset();
    window.BeybooMood?.reset();
    editionId = edition;
    if (!edition) { window.BeybooEye?.prepare(); }
    busy = true; previewing=preview; soundReady=false; const attempt = ++serial; q('voice-billing').hidden = true; q('voice-sign-in').hidden = true; if (passwordForm) passwordForm.hidden = true; controls(); state('connecting',preview?'Préparation de l’extrait…':'Connexion à BEYBOO…');
    try {
      const {data: info} = await api('/api/voice/status', {signal: AbortSignal.timeout(12000)});
      if (attempt !== serial) return false;
      if (!info.configured) throw new Error(info.message || 'La voix n’est pas encore disponible.');
      if (!info.authenticated) { signInPrompt(info.signIn); throw new Error('Connecte-toi à ton site pour démarrer cet essai privé.'); }
      if (!window.RTCPeerConnection) throw new Error('Ce navigateur ne permet pas la conversation vocale. Ouvre le site dans Safari ou Chrome.');
      if (withMic) {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Le micro n’est pas accessible ici. Ouvre le site dans Safari ou utilise « Écrire une question ».');
        state('connecting','Autorise le microphone pour parler à BEYBOO.');
        const local = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
        if (attempt !== serial) { local.getTracks().forEach(t=>t.stop()); return false; }
        stream = local; window.BeybooEye?.attach(local,'mic');
      }
      const peer = new RTCPeerConnection(); pc = peer;
      audio = document.createElement('audio'); audio.autoplay = true; audio.setAttribute('playsinline',''); audio.hidden = true; panel.append(audio);
      peer.ontrack = e => {
        if (attempt !== serial || !audio) return;
        audio.srcObject = e.streams[0] || new MediaStream([e.track]);
        window.BeybooEye?.attach(audio.srcObject,'output');
        soundReady=true;playPreview();
        audio.play().catch(() => { if (attempt === serial){if(previewing){stop('Ton navigateur a bloqué le son. Relance l’extrait après avoir autorisé la lecture audio.','error');return;}q('voice-enable-sound').hidden = false;state('listening','Touche « Activer le son » pour écouter.');} });
      };
      if (stream) stream.getAudioTracks().forEach(t=>peer.addTrack(t,stream)); else peer.addTransceiver('audio',{direction:'recvonly'});
      dc = peer.createDataChannel('oai-events'); dc.onmessage = handleEvent;
      const channel = dc;
      toolBridge = preview ? null : window.createBeybooToolBridge({
        send:event=>{if(channel.readyState==='open')channel.send(JSON.stringify(event));},
        execute:args=>window.BeybooScreen.run(args),
        isCurrent:()=>attempt===serial && channel===dc && channel.readyState==='open',
        onFollowup:()=>{responding=true;state('thinking','L’écran est prêt. Je te réponds…');}
      });
      const ready = new Promise((resolve,reject) => {
        cancelReady = reject;
        channel.onopen = () => { cancelReady = null; resolve(true); };
        channel.onerror = () => reject(new Error('La liaison vocale n’a pas pu être établie.'));
        timeout = setTimeout(()=>reject(new Error('La connexion prend trop de temps. Réessaie sur une connexion stable.')),35000);
      });
      // Attach rejection handling immediately while negotiating the network connection.
      ready.catch(()=>{});
      channel.onclose = () => { if (attempt === serial) stop('La connexion a été interrompue. Tu peux recommencer.','error'); };
      peer.onconnectionstatechange = () => { if (attempt === serial && peer.connectionState === 'failed') stop('La connexion audio a été interrompue.','error'); };
      const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
      const response = await fetch('/api/voice/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sdp:offer.sdp,character:character.value,voiceProfile:voice.value,...(edition ? {edition} : {}),preview}),signal:AbortSignal.timeout(30000)});
      let answer; try { answer = await response.json(); } catch { throw new Error(OFFLINE_MESSAGE); }
      if (response.status === 401 && answer.signIn) signInPrompt(answer.signIn);
      if (attempt !== serial) { endRemote(answer.endToken); return false; }
      if (!response.ok) { q('voice-billing').hidden = !isCreditError(answer.error); throw new Error(answer.message || 'La conversation n’a pas pu démarrer.'); }
      token = answer.endToken; duration = answer.sessionSeconds || (preview?20:180);previewText=preview?answer.previewText||'': '';
      await peer.setRemoteDescription({type:'answer',sdp:answer.sdp}); await ready;
      if (attempt !== serial) return false;
      clearTimeout(timeout); active = true; busy = false; muted = false; startedAt = Date.now(); controls(); listenState();
      if(preview){if(!soundReady)state('listening','Le son se prépare. Si demandé, touche « Activer le son ».');playPreview();}
      const tick = () => { const left = Math.max(0,duration-Math.floor((Date.now()-startedAt)/1000)); q('voice-clock').textContent = `${preview?'Extrait · ':''}${Math.floor(left/60)}:${String(left%60).padStart(2,'0')} restantes`; if (!left) stop(preview?'L’extrait est fermé. Tu peux le relancer.':'Essai terminé après 3 minutes. Tu peux démarrer une nouvelle conversation.'); };
      tick(); timer = setInterval(tick,1000);
      return true;
    } catch(error) {
      if (attempt !== serial) return false;
      const denied = ['NotAllowedError','SecurityError'].includes(error.name);
      const absent = ['NotFoundError','NotReadableError'].includes(error.name);
      stop(denied ? 'Le micro est bloqué. Autorise-le dans ton navigateur, ouvre le site dans Safari, ou écris ta question.' : absent ? 'Aucun microphone utilisable. Tu peux écrire ta question et écouter la réponse.' : error.message || 'Connexion indisponible. Réessaie.','error');
      return false;
    }
  }
  start.addEventListener('click',()=>connect(true));
  stopButton.addEventListener('click',()=>stop());
  muteButton.addEventListener('click',()=>{ muted = !muted; window.BeybooEye?.mute(muted); stream?.getAudioTracks().forEach(t=>t.enabled=!muted); controls(); state(muted?'muted':'listening',muted?'Micro coupé. Tu peux toujours écouter BEYBOO.':'Micro réactivé. Je t’écoute.'); });
  q('voice-enable-sound').addEventListener('click',async()=>{const attempt=serial;try{await audio?.play();if(attempt!==serial)return;soundReady=true;q('voice-enable-sound').hidden=true;playPreview();}catch{state('error','Le son est bloqué par ton navigateur. Vérifie ses réglages.');}});
  form.addEventListener('submit',async event=>{
    event.preventDefault(); if(previewing)return; const text=input.value.trim().slice(0,1000); if (!text) return;
    if (!await connect(false) || !dc || dc.readyState!=='open') return;
    window.BeybooMood?.beginTurn();toolBridge?.interrupt();
    if (responding) dc.send(JSON.stringify({type:'response.cancel'}));
    dc.send(JSON.stringify({type:'output_audio_buffer.clear'}));
    dc.send(JSON.stringify({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text}]}}));
    row('typed-'+Date.now(),'Vous',text); input.value='';
    dc.send(JSON.stringify({type:'response.create'})); responding=true; state('thinking','Je prépare ma réponse…');
  });
  q('voice-clear').addEventListener('click',()=>{if(active||busy)stop();rows.clear();transcript.replaceChildren();q('voice-transcript-empty').hidden=false;});
  window.BeybooVoice = {
    isMounted() { return mounted; },
    isPreview:()=>previewing,
    previewEdition(id) {
      if (active || busy) return Promise.resolve(false);
      return connect(false, true, id);
    },
    preview(){if(previewing){stop('Extrait arrêté.');return Promise.resolve(false);}if(active||busy)return Promise.resolve(false);return connect(false,true);},
    start:()=>{if(previewing)stop('Extrait terminé. Passons à la conversation.');return connect(true);}, end:()=>stop(), isActive:()=>active||busy,
    enter() { if(mounted)return; mounted = true; panel.hidden = false; q('voice-live-meter').hidden=false; window.BeybooEye?.enter(); if (!character.dataset.userChosen && typeof selection !== 'undefined' && character.querySelector(`option[value="${selection.character}"]`)) character.value = selection.character; state('idle','Prêt à discuter ?'); controls(); },
    leave() { window.BeybooDevice?.reset(); mounted = false; stop(); panel.hidden = true; q('voice-live-meter').hidden=true; window.BeybooEye?.leave(); window.BeybooScreen?.leave(); }
  };
  window.addEventListener('pagehide',()=>stop());
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&(active||busy))stop('Conversation arrêtée : la page a été quittée. Le micro est coupé.');});
})();
