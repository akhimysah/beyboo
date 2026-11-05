/* The round home screen of the eye: one app menu drawn by the single live display. The plush never moves. */
(() => {
  'use strict';
  const en = document.documentElement.lang === 'en';
  const t = (fr, english) => en ? english : fr;
  const svg = (body, extra = '') => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"' + extra + '>' + body + '</svg>';
  const glyphs = {
    whatsapp: svg('<path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z" fill="#fff"/><path d="M9.2 8.1c.2-.3.5-.3.7-.1l1.1 1.5c.2.3.1.6-.1.8l-.6.6c.6 1.2 1.6 2.2 2.8 2.8l.6-.6c.2-.2.5-.3.8-.1l1.5 1.1c.3.2.3.5.1.7l-.6.9c-.4.5-1 .7-1.6.5-2.7-.9-4.9-3.1-5.8-5.8-.2-.6 0-1.2.5-1.6z" fill="#1fb857"/>'),
    youtube: svg('<rect x="3" y="6" width="18" height="12" rx="4" fill="#fff"/><path d="M10 9.2v5.6l5-2.8z" fill="#e00000"/>'),
    spotify: svg('<circle cx="12" cy="12" r="9" fill="#101314"/><path d="M7.5 9.6c3-.9 6.3-.7 9 .9M8 12.3c2.5-.7 5.2-.5 7.4.8M8.5 14.8c2-.5 4.1-.4 5.9.7" stroke="#1ed760" stroke-width="1.5" stroke-linecap="round" fill="none"/>'),
    calls: svg('<path d="M6.6 3.8l2.3-.4 1.6 3.9-1.7 1.4a11 11 0 0 0 6.5 6.5l1.4-1.7 3.9 1.6-.4 2.3c-.2 1-1.1 1.7-2.1 1.6C10.4 18.4 5.6 13.6 5 5.9c-.1-1 .6-1.9 1.6-2.1z" fill="#fff"/>'),
    photo: svg('<path d="M4 8h3.2l1.3-2h7l1.3 2H20v11H4z" fill="#fff"/><circle cx="12" cy="13.2" r="3.3" fill="#2c2c2e"/><circle cx="12" cy="13.2" r="1.6" fill="#fff"/>'),
    assistant: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="#fff"/><circle cx="18.5" cy="17.5" r="1.6" fill="#fff"/>'),
    home: svg('<path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z" fill="#fff"/>'),
    mic: svg('<rect x="9" y="3" width="6" height="11" rx="3" fill="#fff"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>'),
    wifi: svg('<path d="M2.5 8.5a14 14 0 0 1 19 0M5.5 11.8a9.5 9.5 0 0 1 13 0M8.5 15a5 5 0 0 1 7 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><circle cx="12" cy="18.5" r="1.5" fill="currentColor"/><path class="eye-wifi-off" d="M4 4l16 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', ' class="eye-wifi"'),
    battery: svg('<rect x="2.5" y="7" width="17" height="10" rx="2.5" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="20.5" y="10" width="1.8" height="4" rx=".6" fill="currentColor"/><rect class="eye-battery-level" x="4.5" y="9" width="13" height="6" rx="1" fill="currentColor"/>', ' class="eye-battery"')
  };
  // Order and labels follow the published interface concept. WhatsApp and Spotify stay illustrative.
  const apps = [
    {id:'whatsapp', label:'WhatsApp', concept:true},
    {id:'youtube', label:'YouTube', command:{action:'open_youtube', value:'catalog'}},
    {id:'spotify', label:'Spotify', concept:true},
    {id:'calls', label:t('Appels','Calls'), mode:'call'},
    {id:'photo', label:'Photo', command:{action:'open_camera'}},
    {id:'assistant', label:t('Assistant','Assistant'), talk:true}
  ];
  const concepts = {
    whatsapp: {
      title:'WhatsApp',
      text:t('Concept d’interface. WhatsApp n’est pas intégré à cette démo : les appels vidéo passent par Jitsi, avec un adulte.','Interface concept. WhatsApp is not part of this demo: video calls run through Jitsi, with an adult.'),
      go:'calls', goLabel:t('Préparer un appel','Prepare a call')
    },
    spotify: {
      title:'Spotify',
      text:t('Concept d’interface. Spotify n’est pas intégré : écoute les cinq instrumentaux originaux BEYBOO.','Interface concept. Spotify is not integrated: listen to the five original BEYBOO instrumentals.'),
      go:'music', goLabel:t('Écouter la musique BEYBOO','Play BEYBOO music')
    }
  };
  const locale = en ? 'en-GB' : 'fr-FR';
  const clock = new Intl.DateTimeFormat(locale, {hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
  const has = value => value === undefined || value === '' || Object.hasOwn(concepts, value);
  function statusBar() {
    return '<div class="eye-home-status"><time class="eye-home-time">' + clock.format(new Date()) + '</time>' + glyphs.wifi + glyphs.battery + '</div>';
  }
  function markup(value) {
    const concept = concepts[value];
    if (concept) {
      return '<div class="eye-home eye-home-concept" role="group" aria-label="' + concept.title + '">' + statusBar() +
        '<div class="eye-home-body"><span class="eye-app eye-app-' + value + '">' + glyphs[value] + '</span><h4>' + concept.title + '</h4><p>' + concept.text + '</p><button type="button" class="eye-home-go" data-home-go="' + concept.go + '">' + concept.goLabel + '</button></div>' +
        '<div class="eye-home-dock"><button type="button" data-home-nav="back" aria-label="' + t('Retour à l’accueil','Back to home') + '">' + glyphs.home + '</button></div></div>';
    }
    return '<div class="eye-home" role="group" aria-label="' + t('Accueil de l’écran BEYBOO','BEYBOO home screen') + '">' + statusBar() +
      '<div class="eye-home-grid">' + apps.map(app =>
        '<button type="button" data-home-app="' + app.id + '"' + (app.concept ? ' data-concept="true" aria-label="' + app.label + ' · ' + t('concept','concept') + '"' : '') + '><span class="eye-app eye-app-' + app.id + '">' + glyphs[app.id] + '</span><span class="eye-app-label">' + app.label + '</span></button>'
      ).join('') + '</div>' +
      '<div class="eye-home-dock"><button type="button" data-home-nav="home" aria-label="' + t('Revenir au regard','Back to the eye') + '">' + glyphs.home + '</button><button type="button" data-home-nav="mic" aria-label="' + t('Parler à BEYBOO','Talk to BEYBOO') + '">' + glyphs.mic + '</button></div></div>';
  }
  function message(value) {
    const concept = concepts[value];
    if (concept) return concept.title + ' · ' + t('concept, non intégré à cette démo.','concept, not part of this demo.');
    return t('Accueil de l’écran · touche une application. Logos illustratifs, sans partenariat annoncé.','Home screen · tap an app. Logos are illustrative, with no announced partnership.');
  }
  function talk() {
    if (window.BeybooCompanion) return window.BeybooCompanion.speak();
    if (typeof showMode === 'function') showMode('assistant');
    return window.BeybooVoice?.start();
  }
  function go(target, run) {
    if (target === 'calls') { if (typeof showMode === 'function') showMode('call'); window.BeybooCompanion?.refresh({reveal:true}); return; }
    if (target === 'music') return run({action:'play_music', value:'catalog'});
  }
  function mount(stage, run) {
    const root = stage.querySelector('.eye-home');
    if (!root) return;
    const live = () => root.isConnected;
    const time = root.querySelector('.eye-home-time');
    const wifi = root.querySelector('.eye-wifi'), level = root.querySelector('.eye-battery-level');
    const paintNetwork = () => { if (wifi) wifi.classList.toggle('is-off', navigator.onLine === false); };
    const paintBattery = battery => { if (level && battery && Number.isFinite(battery.level)) level.setAttribute('width', String(Math.max(1, Math.round(13 * battery.level)))); };
    paintNetwork();
    const timer = setInterval(() => {
      if (!live()) { clearInterval(timer); window.removeEventListener('online', paintNetwork); window.removeEventListener('offline', paintNetwork); return; }
      const now = clock.format(new Date());
      if (time && time.textContent !== now) time.textContent = now;
      paintNetwork();
    }, 1000);
    window.addEventListener('online', paintNetwork); window.addEventListener('offline', paintNetwork);
    navigator.getBattery?.().then(battery => {
      if (!live()) return;
      paintBattery(battery);
      battery.addEventListener('levelchange', function onLevel() { if (live()) paintBattery(battery); else battery.removeEventListener('levelchange', onLevel); });
    }).catch(() => {});
    root.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || !root.contains(button)) return;
      const app = apps.find(item => item.id === button.dataset.homeApp);
      if (app) {
        if (app.concept) return run({action:'open_home', value:app.id});
        if (app.command) return run(app.command);
        if (app.mode === 'call') return go('calls', run);
        if (app.talk) return talk();
      }
      if (button.dataset.homeGo) return go(button.dataset.homeGo, run);
      if (button.dataset.homeNav === 'back') return run({action:'open_home'});
      if (button.dataset.homeNav === 'mic') return talk();
      if (button.dataset.homeNav === 'home') return window.BeybooCompanion ? window.BeybooCompanion.home() : run({action:'show_eye'});
    });
  }
  window.BeybooLauncher = {apps, has, markup, message, mount, unknown:() => t('Choisis une application de l’accueil.','Choose an app from the home screen.')};
})();
