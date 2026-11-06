/* The round home screen of the eye: one app menu drawn by the single live display. The plush never moves. */
(() => {
  'use strict';
  const en = document.documentElement.lang === 'en';
  const t = (fr, english) => en ? english : fr;
  const svg = (body, extra = '') => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"' + extra + '>' + body + '</svg>';
  const glyphs = {
    messages: svg('<path d="M12 3.5c-4.9 0-8.8 3.3-8.8 7.4 0 2.2 1.1 4.1 2.9 5.5L5.4 20.5l4.4-1.6c.7.2 1.4.2 2.2.2 4.9 0 8.8-3.3 8.8-7.4S16.9 3.5 12 3.5z" fill="#fff"/><circle cx="8.6" cy="10.9" r="1.1" fill="#1d6fe0"/><circle cx="12" cy="10.9" r="1.1" fill="#1d6fe0"/><circle cx="15.4" cy="10.9" r="1.1" fill="#1d6fe0"/>'),
    youtube: svg('<rect x="3" y="6" width="18" height="12" rx="4" fill="#fff"/><path d="M10 9.2v5.6l5-2.8z" fill="#e00000"/>'),
    spotify: svg('<circle cx="12" cy="12" r="9" fill="#101314"/><path d="M7.5 9.6c3-.9 6.3-.7 9 .9M8 12.3c2.5-.7 5.2-.5 7.4.8M8.5 14.8c2-.5 4.1-.4 5.9.7" stroke="#1ed760" stroke-width="1.5" stroke-linecap="round" fill="none"/>'),
    calls: svg('<path d="M6.6 3.8l2.3-.4 1.6 3.9-1.7 1.4a11 11 0 0 0 6.5 6.5l1.4-1.7 3.9 1.6-.4 2.3c-.2 1-1.1 1.7-2.1 1.6C10.4 18.4 5.6 13.6 5 5.9c-.1-1 .6-1.9 1.6-2.1z" fill="#fff"/>'),
    photo: svg('<path d="M4 8h3.2l1.3-2h7l1.3 2H20v11H4z" fill="#fff"/><circle cx="12" cy="13.2" r="3.3" fill="#2c2c2e"/><circle cx="12" cy="13.2" r="1.6" fill="#fff"/>'),
    assistant: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="#fff"/><circle cx="18.5" cy="17.5" r="1.6" fill="#fff"/>'),
    companions: svg('<circle cx="12" cy="9" r="4.2" fill="#fff"/><path d="M4.5 20c.6-3.6 3.6-6 7.5-6s6.9 2.4 7.5 6z" fill="#fff"/><circle cx="12" cy="9" r="1.7" fill="#2a63c9"/>'),
    music: svg('<path d="M9 17.5V6.2l10-2v11.3" stroke="#fff" stroke-width="2" fill="none" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.6" fill="#fff"/><circle cx="16.5" cy="15.5" r="2.6" fill="#fff"/>'),
    games: svg('<rect x="3" y="7" width="18" height="11" rx="4.5" fill="#fff"/><path d="M8 10v5M5.5 12.5h5" stroke="#1d1d1f" stroke-width="1.6" stroke-linecap="round"/><circle cx="15.5" cy="11.3" r="1.1" fill="#e0304a"/><circle cx="18" cy="13.6" r="1.1" fill="#1d6fe0"/>'),
    stories: svg('<path d="M4 5.5h6.5a2 2 0 0 1 2 2V19a2.5 2.5 0 0 0-2-1H4zM20 5.5h-6.5a2 2 0 0 0-2 2V19a2.5 2.5 0 0 1 2-1H20z" fill="#fff"/>'),
    clock: svg('<circle cx="12" cy="12" r="8.5" fill="#fff"/><path d="M12 7.5V12l3 2" stroke="#1d1d1f" stroke-width="1.8" stroke-linecap="round" fill="none"/>'),
    nightlight: svg('<path d="M14.5 3.5a8.5 8.5 0 1 0 6 14.3 8 8 0 0 1-6-14.3z" fill="#fff"/>'),
    weather: svg('<circle cx="9" cy="9" r="3.6" fill="#ffd54a"/><path d="M8 19h9.5a3.5 3.5 0 0 0 .6-6.95A5 5 0 0 0 8.6 11.5 3.75 3.75 0 0 0 8 19z" fill="#fff"/>'),
    math: svg('<text x="12" y="16.5" text-anchor="middle" font-size="11" font-weight="700" font-family="system-ui,sans-serif" fill="#fff">7+5</text>'),
    face: svg('<path d="M4 9V4h5M15 4h5v5M4 15v5h5M15 20h5v-5" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M9 10v1.5M15 10v1.5M9.5 14.5q2.5 2.3 5 0" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none"/>'),
    profile: svg('<rect x="3" y="7" width="18" height="10" rx="2.5" fill="#fff"/><path d="M6 10h1.5M9.5 10H11M13 10h1.5M16.5 10H18M7 13.5h10" stroke="#1d1d1f" stroke-width="1.4" stroke-linecap="round"/>'),
    home: svg('<path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z" fill="#fff"/>'),
    mic: svg('<rect x="9" y="3" width="6" height="11" rx="3" fill="#fff"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>'),
    wifi: svg('<path d="M2.5 8.5a14 14 0 0 1 19 0M5.5 11.8a9.5 9.5 0 0 1 13 0M8.5 15a5 5 0 0 1 7 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><circle cx="12" cy="18.5" r="1.5" fill="currentColor"/><path class="eye-wifi-off" d="M4 4l16 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', ' class="eye-wifi"'),
    battery: svg('<rect x="2.5" y="7" width="17" height="10" rx="2.5" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="20.5" y="10" width="1.8" height="4" rx=".6" fill="currentColor"/><rect class="eye-battery-level" x="4.5" y="9" width="13" height="6" rx="1" fill="currentColor"/>', ' class="eye-battery"')
  };
  // Two pages of real activities. Everything opens inside the eye; no app is a brand concept any more.
  const pages = [
    [
      {id:'messages', label:t('Messages','Messages'), command:{action:'open_messages'}},
      {id:'youtube', label:'YouTube', command:{action:'open_youtube', value:'catalog'}},
      {id:'calls', label:t('Appels','Calls'), mode:'call'},
      {id:'assistant', label:t('Assistant','Assistant'), talk:true},
      {id:'photo', label:'Photo', command:{action:'open_camera'}},
      {id:'companions', label:t('Compagnons','Companions'), command:{action:'open_companions'}}
    ],
    [
      {id:'music', label:t('Musique','Music'), command:{action:'play_music', value:'catalog'}},
      {id:'games', label:t('Jeux','Games'), command:{action:'open_game'}},
      {id:'stories', label:t('Histoires','Stories'), story:true},
      {id:'clock', label:t('Horloge','Clock'), command:{action:'open_clock'}},
      {id:'nightlight', label:t('Veilleuse','Night light'), command:{action:'set_nightlight', value:'on'}},
      {id:'weather', label:t('Météo','Weather'), command:{action:'open_weather'}},
      {id:'math', label:t('Calcul','Math'), command:{action:'open_math'}},
      {id:'face', label:t('Visage','Face'), command:{action:'open_face'}},
      {id:'profile', label:t('Profil','Profile'), command:{action:'open_profile'}}
    ]
  ];
  const apps = pages.flat();
  let page = 0;
  const concepts = {};
  const locale = en ? 'en-GB' : 'fr-FR';
  const clock = new Intl.DateTimeFormat(locale, {hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
  const has = value => value === undefined || value === '' || Object.hasOwn(concepts, value);
  // Unread family messages (messages.js) show as a dot on the Messages tile and refresh while the home screen is live.
  const unread = () => Number(window.BeybooMessages?.unread?.()) || 0;
  const badgeLabel = count => t('Messages','Messages') + (count ? ' · ' + count + ' ' + t(count > 1 ? 'non lus' : 'non lu', 'unread') : '');
  const badge = count => '<span class="eye-app-badge" aria-hidden="true"' + (count ? '' : ' hidden') + '>' + (count > 99 ? '99+' : count || '') + '</span>';
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
    const tiles = pages[page] || pages[0];
    return '<div class="eye-home" role="group" aria-label="' + t('Accueil de l’écran BOOZZO','BOOZZO home screen') + '" data-page="' + page + '">' + statusBar() +
      '<div class="eye-home-grid' + (tiles.length > 6 ? ' is-dense' : '') + '">' + tiles.map(app =>
        '<button type="button" data-home-app="' + app.id + '"' + (app.id === 'messages' ? ' aria-label="' + badgeLabel(unread()) + '"' : '') + '><span class="eye-app eye-app-' + app.id + '">' + glyphs[app.id] + (app.id === 'messages' ? badge(unread()) : '') + '</span><span class="eye-app-label">' + app.label + '</span></button>'
      ).join('') + '</div>' +
      '<div class="eye-home-pager" aria-label="' + t('Pages de l’accueil','Home pages') + '"><button type="button" data-home-page="-1" aria-label="' + t('Page précédente','Previous page') + '">‹</button>' +
        pages.map((_, i) => '<i' + (i === page ? ' class="is-on"' : '') + '></i>').join('') +
      '<button type="button" data-home-page="1" aria-label="' + t('Page suivante','Next page') + '">›</button></div>' +
      '<div class="eye-home-dock"><button type="button" data-home-nav="home" aria-label="' + t('Revenir au regard','Back to the eye') + '">' + glyphs.home + '</button><button type="button" data-home-nav="mic" aria-label="' + t('Parler à BOOZZO','Talk to BOOZZO') + '">' + glyphs.mic + '</button></div></div>';
  }
  function message(value) {
    const concept = concepts[value];
    if (concept) return concept.title + ' · ' + t('concept, non intégré à cette démo.','concept, not part of this demo.');
    return t('Accueil de l’écran · touche une application, glisse pour voir la suite.','Home screen · tap an app, swipe for more.');
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
  function flip(delta, run) { page = (page + delta + pages.length) % pages.length; return run({action:'open_home'}); }
  function mount(stage, run) {
    const root = stage.querySelector('.eye-home');
    if (!root) return;
    let x0 = null;
    root.addEventListener('touchstart', event => { x0 = event.touches[0].clientX; }, {passive:true});
    root.addEventListener('touchend', event => { if (x0 === null) return; const dx = event.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 45) flip(dx < 0 ? 1 : -1, run); }, {passive:true});
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
    const paintUnread = () => {
      const tile = root.querySelector('[data-home-app="messages"]'), pill = root.querySelector('.eye-app-badge');
      if (!tile || !pill) return;
      const count = unread();
      pill.hidden = !count; pill.textContent = count > 99 ? '99+' : count || ''; tile.setAttribute('aria-label', badgeLabel(count));
    };
    const onMessages = () => { if (live()) paintUnread(); else document.removeEventListener('beyboo-messages', onMessages); };
    document.addEventListener?.('beyboo-messages', onMessages);
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
        if (app.command) return run(app.command);
        if (app.mode === 'call') return go('calls', run);
        if (app.talk) return talk();
        if (app.story) return run({action:'open_story', value:window.BeybooCompanionChoice?.current?.() || 'noah'});
      }
      if (button.dataset.homePage) return flip(Number(button.dataset.homePage), run);
      if (button.dataset.homeGo) return go(button.dataset.homeGo, run);
      if (button.dataset.homeNav === 'back') return run({action:'open_home'});
      if (button.dataset.homeNav === 'mic') return talk();
      if (button.dataset.homeNav === 'home') return window.BeybooCompanion ? window.BeybooCompanion.home() : run({action:'show_eye'});
    });
  }
  window.BeybooLauncher = {apps, pages, has, markup, message, mount, page:()=>page, setPage:value=>{page=Math.min(Math.max(0,value|0),pages.length-1);}, unknown:() => t('Choisis une application de l’accueil.','Choose an app from the home screen.')};
})();
