/* Mode écran (?screen=1) : plein écran, tout au doigt. L'accueil rond s'ouvre tout de suite ;
   les panneaux hors de l'œil (voix, appel, photo, réglages) vivent dans un tiroir en bas. */
(() => {
  'use strict';
  const html = document.documentElement;
  if (!html.classList.contains('beyboo-screen')) return;
  const en = html.lang === 'en';
  const t = (fr, english) => en ? english : fr;
  const q = id => document.getElementById(id);
  const controls = document.querySelector('.experience-controls');
  if (!controls) return;
  /* logo discret en haut */
  const mark = document.createElement('img');
  mark.className = 'screen-wordmark'; mark.src = 'assets/universe/brand-boozzo-640.webp'; mark.alt = 'BOOZZO'; mark.width = 640; mark.height = 213;
  document.body.append(mark);
  /* tiroir */
  const head = document.createElement('div');
  head.className = 'screen-drawer-head';
  head.innerHTML = '<b>' + t('Réglages et panneaux', 'Settings and panels') + '</b><div><button type="button" data-drawer="family">' + t('Espace famille', 'Family') + '</button><button type="button" data-drawer="close">' + t('Fermer', 'Close') + '</button></div>';
  controls.prepend(head);
  const settingsButton = () => bar.querySelector('[data-screen="settings"]');
  function open(target) {
    html.classList.add('screen-drawer-open');
    settingsButton().setAttribute('aria-pressed', 'true');
    if (target) { const el = q(target); if (el && !el.hidden) requestAnimationFrame(() => el.scrollIntoView({block:'start'})); }
  }
  function close() { html.classList.remove('screen-drawer-open'); settingsButton().setAttribute('aria-pressed', 'false'); }
  head.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.drawer === 'close') close();
    if (button.dataset.drawer === 'family') q('family-open')?.click();
  });
  /* barre basse */
  const bar = document.createElement('nav');
  bar.className = 'screen-bar'; bar.setAttribute('aria-label', t('Barre de l’écran', 'Screen bar'));
  bar.innerHTML = [['home', '⌂', t('Accueil', 'Home')], ['talk', '◉', t('Parler', 'Talk')], ['companions', '☺', t('Compagnons', 'Companions')], ['settings', '⚙', t('Réglages', 'Settings')]]
    .map(([id, icon, label]) => '<button type="button" data-screen="' + id + '" aria-pressed="false"><span aria-hidden="true">' + icon + '</span>' + label + '</button>').join('');
  document.body.append(bar);
  const home = () => { if (typeof showMode === 'function') showMode('menu'); };
  bar.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const id = button.dataset.screen;
    if (id === 'home') { close(); home(); }
    else if (id === 'talk') { close(); window.BeybooCompanion?.speak(); setTimeout(() => { if (!q('voice-panel')?.hidden && !window.BeybooVoice?.isActive?.()) open('voice-panel'); }, 900); }
    else if (id === 'companions') { close(); window.BeybooScreen?.run({action:'open_companions'}); }
    else if (id === 'settings') { html.classList.contains('screen-drawer-open') ? close() : open(); }
  });
  /* appel et photo : leurs commandes sont hors de l'œil, le tiroir s'ouvre avec elles */
  const watched = ['call-panel', 'camera-panel'];
  const observer = new MutationObserver(() => {
    for (const id of watched) {
      const el = q(id); if (!el) continue;
      if (!el.hidden && el.dataset.screenSeen !== 'open') { el.dataset.screenSeen = 'open'; open(id); }
      else if (el.hidden) el.dataset.screenSeen = '';
    }
  });
  for (const id of watched) { const el = q(id); if (el) observer.observe(el, {attributes:true, attributeFilter:['hidden']}); }
  /* taille de l'écran rond */
  function fit() {
    const d = Math.max(240, Math.min(innerWidth - 24, innerHeight - 176));
    html.style.setProperty('--screen-diameter', d + 'px');
    window.BeybooCompanion?.refresh?.();
  }
  /* Les commandes de l'activité sont déplacées par product-demo.js selon la largeur ; en mode écran elles vivent sous le cercle. */
  const relocate = () => { const panel = q('product-activity'); if (panel && panel.parentElement !== document.body) document.body.append(panel); };
  let relocateTimer = null;
  const onResize = () => { fit(); clearTimeout(relocateTimer); relocateTimer = setTimeout(relocate, 120); };
  fit(); relocate(); addEventListener('resize', onResize);
  new MutationObserver(relocate).observe(document.body, {childList:true, subtree:true});
  addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  /* Au retour au premier plan, le site a refermé l'activité : l'écran revient à l'accueil rond, pas au regard vide. */
  const idle = () => q('voice-stage')?.hidden && q('device-content')?.hidden && q('call-stage')?.hidden;
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => { if (idle()) home(); }, 250); });
  /* démarrage : l'accueil rond, sans passer par la page */
  const onHome = () => !q('voice-stage')?.hidden && /voice-stage--home/.test(q('voice-stage')?.className || '');
  const start = () => { fit(); home(); setTimeout(() => { fit(); if (!onHome() && q('device-content')?.hidden && q('call-stage')?.hidden) home(); }, 1400); };
  if (document.readyState === 'complete') setTimeout(start, 80); else addEventListener('load', () => setTimeout(start, 80));
  window.BeybooScreenMode = {open, close, fit};
})();
