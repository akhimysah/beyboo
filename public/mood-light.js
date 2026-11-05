/* The halo expresses the character's own mood as it speaks. */
(() => {
  'use strict';
  const dock = document.getElementById('plush-eye-dock');
  const controls = document.getElementById('mood-controls');
  const status = document.getElementById('mood-status');
  if (!dock || !controls || !status) return;

  const buttons = [...controls.querySelectorAll('[data-mood]')];
  const modes = new Map(buttons.map(button => [button.dataset.mood, button]));
  const english = document.documentElement.lang === 'en';
  const prompt = status.textContent;
  const waiting = english ? 'The eye lights up when BEYBOO speaks.' : 'L’œil s’allume quand BEYBOO parle.';
  const previewLabel = english ? 'Light preview' : 'Aperçu lumineux';
  let mood = 'smile';
  let source = '';
  let connected = false;
  let timer = null;
  let sample = null;
  let generation = 0;

  // The emotion's name, shown inside the round screen while the halo is lit.
  const label = document.createElement('span');
  label.setAttribute('class', 'mood-name');
  label.setAttribute('aria-hidden', 'true');
  label.hidden = true;
  dock.append(label);

  function paint(value, message = connected ? waiting : prompt) {
    if (value) {
      dock.dataset.led = value;
      label.textContent = (modes.get(value)?.textContent || '').trim();
      label.hidden = false;
      if (label.isConnected === false) dock.append(label);
    } else {
      delete dock.dataset.led;
      label.hidden = true;
    }
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.mood === value));
    }
    if (status.textContent !== message) status.textContent = message;
  }

  function stop(owner) {
    if (source !== owner) return;
    source = '';
    paint(null);
  }

  function stopPreview() {
    ++generation;
    clearTimeout(timer);
    timer = null;
    if (sample) {
      sample.onstart = sample.onend = sample.onerror = null;
      sample = null;
      window.speechSynthesis?.cancel();
    }
    stop('preview');
  }

  function beginTurn() {
    stopPreview();
    stop('voice');
    mood = 'smile';
  }

  function speaking(owner) {
    stopPreview();
    source = owner;
    const value = owner === 'story' ? 'smile' : mood;
    paint(value, modes.get(value).dataset.description);
  }

  function choose(value) {
    if (!modes.has(value)) return false;
    mood = value;
    if (source === 'voice') paint(value, modes.get(value).dataset.description);
    return true;
  }

  function reset() {
    stopPreview();
    source = '';
    mood = 'smile';
    paint(null);
  }

  function preview(button) {
    if (connected || window.BeybooVoice?.isActive()) return;
    if (source === 'preview' && dock.dataset.led === button.dataset.mood) {
      stopPreview();
      return;
    }
    stopPreview();
    if (window.BeybooVoice && !window.BeybooVoice.isMounted()) showMode('assistant');
    window.BeybooDevice?.reset();
    window.BeybooScreen?.run({action: 'show_eye'});

    const token = ++generation;
    const {mood: value, description, line: text} = button.dataset;
    const previewText = previewLabel + ' · ' + description;
    source = 'preview';
    paint(value, previewText);
    timer = setTimeout(stopPreview, 4500);

    const synth = window.speechSynthesis;
    if (!synth || !window.SpeechSynthesisUtterance) return;
    const language = english ? 'en' : 'fr';
    const voice = synth.getVoices().find(v => v.localService && v.lang.toLowerCase().startsWith(language));
    if (!voice) return;

    const line = new window.SpeechSynthesisUtterance(text);
    sample = line;
    line.voice = voice;
    line.lang = voice.lang;
    line.rate = .96;
    line.pitch = 1.08;
    line.onstart = () => {
      if (token !== generation) return;
      clearTimeout(timer);
      timer = setTimeout(stopPreview, 10000);
      paint(value, description + ' · ' + text);
    };
    line.onend = () => {
      if (token === generation) {
        sample = null;
        stopPreview();
      }
    };
    line.onerror = () => {
      if (token !== generation) return;
      sample = null;
      clearTimeout(timer);
      paint(value, previewText);
      timer = setTimeout(stopPreview, 3500);
    };
    try { synth.speak(line); } catch { line.onerror(); }
  }

  for (const button of buttons) button.addEventListener('click', () => preview(button));
  document.addEventListener('beyboo-voice-state', event => {
    connected = !!(event.detail.active || event.detail.busy);
    for (const button of buttons) button.disabled = connected;
    if (connected && source === 'preview') stopPreview();
    if (!source) paint(null);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  window.addEventListener('pagehide', reset);
  window.BeybooMood = {choose, beginTurn, speaking, stop, stopPreview, reset};
})();
