(() => {
  'use strict';
  const grid = document.getElementById('presidents-grid');
  if (!grid) return;
  const english = document.documentElement.lang === 'en';
  const locale = english ? 'en' : 'fr';
  const copy = english ? {
    play:'Hear the voice', stop:'Stop sample', loading:'Preparing the voice…',
    speaking:'Playing the line…', done:'Sample finished.', stopped:'Sample stopped.',
    error:'The voice sample is unavailable right now.', localError:'Your device could not read this line aloud.',
    busy:'Finish your current voice session before playing a sample.', image:'BEYBOO plush'
  } : {
    play:'Écouter sa voix', stop:'Arrêter l’extrait', loading:'Préparation de la voix…',
    speaking:'Lecture de la réplique…', done:'Extrait terminé.', stopped:'Extrait arrêté.',
    error:'L’extrait vocal est momentanément indisponible.', localError:'La voix de cet appareil est indisponible.',
    busy:'Terminez la session vocale en cours pour écouter un extrait.', image:'Peluche BEYBOO'
  };
  const cards = new Map();
  let active = null;
  let visible = null;
  let localSpeech = null;

  function playback(card, running, message, speaking = false) {
    card.querySelector('.president-status').textContent = message;
    card.querySelector('.president-play-label').textContent = running ? copy.stop : copy.play;
    card.querySelector('.president-play-icon').textContent = running ? 'Ⅱ' : '▷';
    const button = card.querySelector('.president-play');
    button.setAttribute('aria-pressed', String(running));
    button.setAttribute('aria-label', (running ? copy.stop : copy.play) + ' · ' + card.querySelector('h3').textContent);
    card.classList.toggle('is-speaking', speaking);
  }
  function stop() {
    const card = active;
    if (!card) return;
    active = null;
    if (localSpeech) {
      localSpeech.onend = localSpeech.onerror = null;
      localSpeech = null;
      window.speechSynthesis.cancel();
    } else if (window.BeybooVoice?.isActive()) {
      window.BeybooVoice.end();
    }
    playback(card, false, copy.stopped);
  }
  function reveal(card) {
    if (visible && visible !== card) visible.querySelector('.president-response').hidden = true;
    visible = card;
    card.querySelector('.president-response').hidden = false;
    card.querySelector('.president-local').hidden = true;
  }
  function unavailable(card, message) {
    active = null;
    playback(card, false, message || copy.error);
    card.querySelector('.president-local').hidden = !(window.speechSynthesis && window.SpeechSynthesisUtterance);
  }
  function readOnDevice(card, person) {
    stop();
    if (window.BeybooVoice?.isActive()) { playback(card, false, copy.busy); return; }
    reveal(card);
    const speech = new SpeechSynthesisUtterance(person[locale].line);
    speech.lang = english ? 'en-US' : 'fr-FR';
    active = card;
    localSpeech = speech;
    playback(card, true, copy.loading);
    speech.onstart = () => { if (localSpeech === speech) playback(card, true, copy.speaking, true); };
    const finish = message => {
      if (localSpeech !== speech) return;
      active = localSpeech = null;
      playback(card, false, message);
    };
    speech.onend = () => finish(copy.done);
    speech.onerror = () => finish(copy.localError);
    window.speechSynthesis.speak(speech);
  }
  async function listen(card, id) {
    const toggling = active === card;
    stop();
    if (toggling) return;
    reveal(card);
    if (window.BeybooVoice?.isActive()) { playback(card, false, copy.busy); return; }
    active = card;
    playback(card, true, copy.loading);
    try {
      const ok = await window.BeybooVoice?.previewEdition(id);
      if (!ok && active === card) unavailable(card, copy.error);
    } catch { if (active === card) unavailable(card, copy.error); }
  }
  document.addEventListener('beyboo-edition-voice', event => {
    const {id,kind,message} = event.detail;
    const card = cards.get(id);
    if (!card || card !== active || localSpeech) return;
    if (kind === 'error') { unavailable(card, message); return; }
    if (kind === 'idle') {
      active = null;
      playback(card, false, copy.done);
      return;
    }
    playback(card, true, kind === 'speaking' ? copy.speaking : copy.loading, kind === 'speaking');
  });
  function render(people) {
    const template = document.getElementById('president-card');
    for (const person of people) {
      const card = template.content.firstElementChild.cloneNode(true);
      const {name,role,line} = person[locale];
      card.querySelector('h3').textContent = name;
      card.querySelector('.president-role').textContent = role;
      card.querySelector('.president-line').textContent = english ? '“' + line + '”' : '« ' + line + ' »';
      card.querySelector('.president-photo').alt = copy.image + ' · ' + name;
      for (const img of card.querySelectorAll('img')) img.src = 'assets/presidents/' + person.id + '.webp';
      for (const key of ['x','y','r']) card.style.setProperty('--eye-' + key, person.eye[key] + '%');
      const button = card.querySelector('.president-play');
      button.setAttribute('aria-label', copy.play + ' · ' + name);
      button.addEventListener('click', () => listen(card, person.id));
      card.querySelector('.president-local').addEventListener('click', () => readOnDevice(card, person));
      cards.set(person.id, card);
      grid.append(card);
    }
  }
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  fetch('presidents.json?v=1').then(response => {
    if (!response.ok) throw new Error('catalog');
    return response.json();
  }).then(render).catch(() => { document.getElementById('presidents-load-error').hidden = false; });
})();
