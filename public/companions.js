/* Choix du compagnon dans l'œil : les dix personnages, un par un, au doigt. Le corps de la peluche ne bouge jamais. */
(() => {
  'use strict';
  const en = document.documentElement.lang === 'en';
  const t = (fr, english) => en ? english : fr;
  let index = 0;
  const all = () => (window.BeybooCompanionChoice?.list?.() || characters.map(c => ({id:c.id, name:c.name, role:c.role, motto:c.motto})));
  const current = () => window.BeybooCompanionChoice?.current?.() || 'noah';
  const portrait = id => typeof photo === 'function' ? photo(id) : 'assets/studio/' + id + '.webp';
  function card(i) {
    const list = all(), c = list[i], chosen = c.id === current();
    return '<span class="screen-label">' + t('COMPAGNONS', 'COMPANIONS') + ' · ' + (i + 1) + '/' + list.length + '</span>' +
      '<div class="eye-companion-row"><button type="button" data-companion-nav="-1" aria-label="' + t('Précédent', 'Previous') + '">‹</button>' +
      '<img src="' + portrait(c.id) + '" alt="' + c.name + '" width="1254" height="1254" decoding="async">' +
      '<button type="button" data-companion-nav="1" aria-label="' + t('Suivant', 'Next') + '">›</button></div>' +
      '<h4>' + c.name + '</h4><p>' + c.role + '</p>' +
      '<div class="eye-companion-actions"><button type="button" class="eye-home-go" data-companion-choose="' + c.id + '"' + (chosen ? ' disabled' : '') + '>' + (chosen ? t('Ton compagnon', 'Your companion') : t('Choisir', 'Choose') + ' ' + c.name) + '</button>' +
      '<button type="button" class="eye-home-go is-secondary" data-companion-story="' + c.id + '">' + t('Son histoire', 'Story') + '</button></div>';
  }
  function markup() {
    index = Math.max(0, all().findIndex(c => c.id === current()));
    return '<div class="eye-companions" role="group" aria-label="' + t('Choisir ton compagnon', 'Choose your companion') + '">' + card(index) + '</div>';
  }
  function mount(stage, run) {
    const root = stage.querySelector('.eye-companions');
    if (!root) return;
    const paint = () => { root.innerHTML = card(index); };
    const step = delta => { const n = all().length; index = (index + delta + n) % n; paint(); };
    root.addEventListener('click', async event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.companionNav) return step(Number(button.dataset.companionNav));
      if (button.dataset.companionStory) return run({action:'open_story', value:button.dataset.companionStory});
      if (button.dataset.companionChoose) {
        button.disabled = true; button.textContent = t('Préparation…', 'Preparing…');
        try { await window.BeybooCompanionChoice?.choose?.(button.dataset.companionChoose); } catch { /* le statut est affiché par le module de choix */ }
        if (root.isConnected) paint();
      }
    });
    let x0 = null;
    root.addEventListener('touchstart', event => { x0 = event.touches[0].clientX; }, {passive:true});
    root.addEventListener('touchend', event => { if (x0 === null) return; const dx = event.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1); }, {passive:true});
    root.addEventListener('keydown', event => { if (event.key === 'ArrowRight') step(1); if (event.key === 'ArrowLeft') step(-1); });
  }
  window.BeybooCompanions = {markup, mount, message: () => t('Choisis ton compagnon : glisse ou touche les flèches, puis « Choisir ».', 'Choose your companion: swipe or tap the arrows, then “Choose”.')};
})();
