/* Device commands are a separate, opt-in alternative to the live AI conversation. */
(() => {
  'use strict';
  const en = document.documentElement.lang === 'en';
  const t = (fr, english) => en ? english : fr;
  const q = id => document.getElementById(id);
  const normal = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,' ').trim();
  const cities = [
    ['paris','Paris','Paris'], ['casablanca','Casablanca','Casablanca'], ['alger','Alger','Algiers'], ['dakar','Dakar','Dakar'],
    ['london','Londres','London'], ['istanbul','Istanbul','Istanbul'], ['rio','Rio de Janeiro','Rio de Janeiro'], ['sydney','Sydney','Sydney']
  ];
  const videos = [
    {fr:'Le système solaire', en:'The solar system', ids:['shQJd3oGYn8','mibxJwpennU'], topic:/espace|space|solaire|solar|planet/},
    {fr:'Les phases de la Lune', en:'Our Moon and its phases', ids:['HPFXqqe971I','w4U_cuF-_hI'], topic:/lune|moon|eclipse/}
  ];
  function cityFor(text) {
    const words = ' '+normal(text).replace(/[^a-z]+/g,' ').trim()+' ';
    return cities.find(city => city.some(name => words.includes(' '+normal(name)+' ')));
  }
  function videoFor(text) { return videos.find(v => v.topic.test(normal(text))); }
  function command(raw) {
    const s = normal(raw);
    if (!s || /\b(pas|jamais|don t|dont|never|not)\b/.test(s)) return null;
    if (/veilleuse|night[ -]?light|bedside lamp/.test(s)){
      const off=/etein|arrete|coupe|\boff\b|turn out|switch out/.test(s);
      return {action:'set_nightlight',value:off?'off':'on'};
    }
    if (/horloge|quelle heure|affiche l heure|montre l heure|\bclock\b|what time|show the time/.test(s)) return {action:'open_clock'};
    if (/meteo|weather|forecast|quel temps/.test(s)) return {action:'open_weather', value:cityFor(s)?.[0] || ''};
    if (/accueil|\bmenu\b|applications?|\bapps?\b|home screen|\bhome\b/.test(s)) return {action:'open_home'};
    if (/\bmessages?\b|messagerie|whatsapp|\btexto/.test(s)) return {action:'open_messages'};
    if (/compagnons?|companions?|personnages?|characters?|changer de (peluche|compagnon)/.test(s)) return {action:'open_companions'};
    if (/\bpause\b/.test(s)) return {action:'pause_media'};
    if (/youtube|you tube/.test(s) || /video/.test(s) && (videoFor(s) || /sur |about |of /.test(s))) {
      const video = videoFor(s);
      return {action:'open_youtube', value:video ? 'https://www.youtube.com/watch?v='+video.ids[Number(en)] : raw.trim()};
    }
    if (/reprend|repren|resume|continue la (lecture|video)/.test(s)) return {action:'resume_media'};
    if (/arrete|retour a l oeil|revien[st]|stop|back to the eye/.test(s)) return {action:'show_eye'};
    if (/photo|camera/.test(s)) return {action:'open_camera'};
    if (/regard|follow my face/.test(s)) return {action:'open_face'};
    if (/calcul|math|addition/.test(s)) return {action:'open_math'};
    if (/histoire|story/.test(s)) return {action:'open_story',value:q('voice-character').value};
    if (/morpion|tic.?tac.?toe|noughts and crosses/.test(s)) return {action:'open_game',value:'tic'};
    if (/\bdames?\b|draughts|checkers/.test(s)) return {action:'open_game',value:'draughts'};
    if (/etoiles|catch the stars/.test(s)) return {action:'open_game',value:'stars'};
    const styles=[['trap',/\btrap\b/],['afro-pop',/afro/],['lo-fi',/lo[ -]?fi/],['boom-bap',/\brap\b|boom.?bap|hip.?hop/],['lights',/petites lumieres|little lights/]];
    const track=styles.find(([,match])=>match.test(s));
    if (track) return {action:'play_music',value:track[0]};
    if (/musique|music|melod/.test(s)) return {action:'play_music'};
    if (/mini.jeu|\bjeu\b|game/.test(s)) return {action:'open_game'};
    if (/appel|call/.test(s)) return {action:'open_call'};
    if (/lune|moon|video|clip/.test(s)) return {action:'play_video'};
    const answer=s.match(/^(?:c est |it is |the answer is )?(\d{1,2})[.!?]?$/);
    return answer ? {action:'answer_math', number:Number(answer[1])} : null;
  }
  const status=q('device-command-status'), input=q('device-command-input'), mic=q('device-command-mic');
  let recognition=null, listening=false, commandGeneration=0, utterance=null;
  const neutral=()=>{if(!window.BeybooVoice?.isActive()) window.BeybooEye?.phase('idle');};
  function stopSpeech(){
    if(utterance){window.BeybooMood?.stop('story');utterance.onend=utterance.onerror=null;window.speechSynthesis?.cancel();utterance=null;neutral();}
  }
  function stopDictation(){
    const old=recognition;recognition=null;listening=false;
    if(old){old.onresult=old.onerror=old.onend=old.onstart=null;try{old.abort();}catch{}}
    mic.setAttribute('aria-pressed','false');mic.textContent=t('Dicter','Dictate');neutral();
  }
  function reset(){++commandGeneration;stopDictation();stopSpeech();}
  function speakStory(text){
    if(utterance){stopSpeech();return;}
    const synth=window.speechSynthesis;
    if(!synth||!window.SpeechSynthesisUtterance||window.BeybooVoice?.isActive())return;
    const voice=synth.getVoices().find(v=>v.localService && v.lang.toLowerCase().startsWith(en?'en':'fr'));
    if(!voice){status.textContent=t('Installe une voix française sur ton appareil pour écouter cette histoire.','Install an English voice on this device to hear the story.');return false;}
    window.BeybooMood?.stopPreview();
    const line=new SpeechSynthesisUtterance(text);line.lang=voice.lang;line.voice=voice;line.rate=.93;line.pitch=1.08;utterance=line;
    line.onstart=()=>{window.BeybooMood?.speaking('story');window.BeybooEye?.phase('speaking');};
    line.onend=line.onerror=()=>{if(utterance===line){utterance=null;window.BeybooMood?.stop('story');neutral();}};
    synth.speak(line);return true;
  }
  async function submit(text){
    if(window.BeybooVoice?.isActive()){status.textContent=t('Termine la conversation IA pour utiliser les commandes du téléphone.','End the AI conversation to use device commands.');return;}
    const parsed=command(text);
    if(!parsed){status.textContent=t('Essaie « ouvre un calcul », « montre la Lune » ou « météo à Paris ».','Try “open maths”, “show the Moon” or “weather in Paris”.');return;}
    if(!window.BeybooVoice.isMounted())showMode('assistant');
    stopDictation();stopSpeech();const generation=++commandGeneration;
    status.textContent=t('Commande reçue…','Command received…');
    try{
      const result=await window.BeybooScreen.run(parsed);
      if(generation===commandGeneration&&!result?.cancelled)status.textContent=result?.description || q('voice-screen-status').textContent;
    }catch{if(generation===commandGeneration)status.textContent=t('Réessaie ou touche l’activité.','Try again or tap the activity.');}
  }
  q('device-command-form').addEventListener('submit',event=>{event.preventDefault();submit(input.value);});
  const Recognition=window.SpeechRecognition || window.webkitSpeechRecognition;
  mic.hidden=!Recognition;
  q('device-command-privacy').hidden=!Recognition;
  mic.addEventListener('click',()=>{
    if(window.BeybooFamily && !window.BeybooFamily.guard('voice'))return;
    if(recognition){stopDictation();status.textContent=t('Dictée arrêtée.','Dictation stopped.');return;}
    if(window.BeybooVoice?.isActive()){status.textContent=t('Termine d’abord la conversation IA.','End the AI conversation first.');return;}
    if(!window.BeybooVoice.isMounted())showMode('assistant');
    stopSpeech();const rec=new Recognition();recognition=rec;rec.lang=en?'en-US':'fr-FR';rec.continuous=false;rec.interimResults=true;
    rec.onstart=()=>{if(recognition!==rec)return;listening=true;mic.setAttribute('aria-pressed','true');mic.textContent=t('Arrêter','Stop');status.textContent=t('Je t’écoute…','Listening…');window.BeybooEye?.phase('listening');};
    rec.onresult=event=>{
      if(recognition!==rec)return;
      const result=event.results[event.resultIndex];input.value=result[0].transcript;
      if(result.isFinal){const heard=input.value;stopDictation();submit(heard);}
    };
    rec.onend=()=>{if(recognition===rec){stopDictation();status.textContent=t('Dictée terminée. Tu peux écrire ta commande.','Dictation ended. You can type a command.');}};
    rec.onerror=()=>{if(recognition===rec){stopDictation();status.textContent=t('Dictée indisponible. Écris ta commande ou vérifie le micro.','Dictation unavailable. Type a command or check your microphone.');}};
    try{rec.start();}catch{rec.onerror();}
  });
  document.addEventListener('beyboo-voice-state',e=>{if(e.detail?.busy || e.detail?.active){if(listening||recognition||utterance)reset();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
  window.addEventListener('pagehide',reset);
  q('device-commands').addEventListener('toggle',()=>{if(!q('device-commands').open)reset();});
  window.BeybooDevice={reset,stopSpeech,speakStory,command,cityFor,cities,videoFor,videos};
})();
