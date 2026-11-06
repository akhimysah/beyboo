'use strict';
// Product interface with OpenAI voice and peer-to-peer family video calls (call.js).
const modeData={
  eye:['Un regard vivant.','Écoute, joie ou attention : choisissez une expression, puis touchez l’œil pour ouvrir ses applications.'],
  menu:['Tout commence au toucher.','Choisissez une activité directement sur l’écran. La peluche reste immobile pendant toute l’expérience.'],
  video:['Une petite fenêtre sur l’ailleurs.','Lancez le clip original « Mission Lune », mettez-le en pause et reprenez la lecture. YouTube est accessible depuis l’accueil de votre compagnon.'],
  call:['Un coucou. Pour de vrai.','Appelez un proche connecté à la même famille, ou envoyez-lui un lien d’invitation : l’appel passe directement entre vos appareils, dans l’œil.'],
  assistant:['Parle. Je t’écoute.','Pose ta question à voix haute. Ton compagnon comprend, te répond et garde le fil pendant la conversation. Seul l’écran réagit ; la peluche reste immobile.'],
  story:['Chaque personnage a son histoire.','Feuilletez les dix univers, rencontrez leurs personnages et ouvrez leur histoire complète.']
};
let mode='eye',responseTimer=null,screenStory=0;
const screen=$('#device-content'),eye=$('#living-eye');
function stopMedia({leaveCall=true}={}){window.BeybooVoice?.leave();if(leaveCall)window.BeybooCall?.leave();clearTimeout(responseTimer);const video=$('#demo-video');if(video)video.pause();if('speechSynthesis' in window)window.speechSynthesis.cancel();}
function showMode(next){
  if(next==='call' && window.BeybooFamily && !window.BeybooFamily.guard('calls'))return;
  if(next==='menu'&&window.BeybooScreen&&window.BeybooLauncher){
    if(!window.BeybooVoice.isMounted())showMode('assistant');
    window.BeybooScreen.run({action:'open_home'});
    return;
  }
  if(next==='game'||next==='music'){
    if(!window.BeybooVoice.isMounted())showMode('assistant');
    window.BeybooScreen.run(next==='game'?{action:'open_game'}:{action:'play_music',value:'catalog'});
    return;
  }
  if(next==='call')window.BeybooGaze?.stop();
  if(window.BeybooVoice?.isMounted() && next!=='call'){
    const actions={eye:'show_eye',assistant:'show_eye',video:'play_video',story:'open_story'};
    if(actions[next]){window.BeybooScreen?.run({action:actions[next]});return;}
  }
  if(next==='call'&&mode==='call')return;
  stopMedia();mode=next;$('.experience-card').classList.toggle('is-voice',next==='assistant');eye.hidden=next!=='eye'&&next!=='assistant';eye.disabled=false;screen.hidden=next==='eye'||next==='assistant'||next==='call';$('#voice-open').hidden=next==='assistant'||next==='call';screen.className='device-content';
  $('#expression-controls').hidden=next!=='eye';
  $$('[data-app]').forEach(b=>{b.classList.toggle('selected',b.dataset.app===next);b.setAttribute('aria-pressed',String(b.dataset.app===next));});
  $('#mode-title').textContent=modeData[next][0];$('#mode-description').textContent=modeData[next][1];
  $('#device-hint').textContent=next==='eye'?'Touchez l’œil pour ouvrir son univers.':next==='call'?'Appel entre proches · D’appareil à appareil':'BOOZZO One · Démonstration interactive';
  if(next==='menu')screen.innerHTML='<span class="screen-label">BONJOUR, VOUS.</span><h4>On fait quoi ensemble ?</h4><div class="mini-apps">'+[['video','▷','Vidéo'],['game','✦','Jeu'],['music','♫','Musique'],['assistant','◉','Assistant'],['call','▣','Appel'],['story','▤','Histoires']].map(([id,icon,label])=>`<button type="button" data-screen-app="${id}"><span>${icon}</span>${label}</button>`).join('')+'</div>';
  if(next==='video')renderVideo();
  if(next==='call')window.BeybooCall?.enter();
  if(next==='assistant')renderAssistant();if(next==='story'){screenStory=characters.findIndex(c=>c.id===selection.character);renderScreenStory();}
}
$$('[data-app]').forEach(b=>b.addEventListener('click',()=>showMode(b.dataset.app)));
eye.addEventListener('click',()=>showMode('menu'));
$('#voice-open').addEventListener('click',()=>showMode('assistant'));
$$('[data-expression]').forEach(b=>b.addEventListener('click',()=>{
  eye.dataset.expression=b.dataset.expression;
  $$('[data-expression]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});
  $('#device-hint').textContent=`Expression : ${b.textContent.trim()}. Touchez l’œil pour explorer.`;
  eye.classList.add('blink');setTimeout(()=>eye.classList.remove('blink'),180);
}));
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!reduceMotion){eye.addEventListener('pointermove',e=>{if(mode==='assistant'||window.BeybooVoice?.isMounted())return;const r=eye.getBoundingClientRect();$('img',eye).style.transform=`translate(${(e.clientX-r.left-r.width/2)/r.width*9}px,${(e.clientY-r.top-r.height/2)/r.height*9}px)`;});eye.addEventListener('pointerleave',()=>$('img',eye).style.transform='');}
function renderVideo(){
  screen.classList.add('video-content');
  screen.innerHTML='<span class="screen-label">LE PETIT CINÉMA</span><h4>Mission Lune</h4><video id="demo-video" playsinline preload="metadata" aria-label="Clip animé original : un voyage spatial vers la Lune"><source src="assets/mission-lune.mp4" type="video/mp4"></video><div class="video-controls"><button type="button" class="device-action" id="video-play">Lire ▷</button><button type="button" class="device-action secondary" id="video-restart" aria-label="Recommencer la vidéo">↺</button></div><div class="video-progress"><span id="video-progress"></span></div><small id="video-status">Clip original · 12 secondes · sans son</small>';
  const video=$('#demo-video'),button=$('#video-play');
  button.addEventListener('click',async()=>{if(video.paused){try{await video.play();}catch{$('#video-status').textContent='Lecture indisponible. Essayez de nouveau.';}}else video.pause();});
  $('#video-restart').addEventListener('click',()=>{video.currentTime=0;$('#video-status').textContent='Clip original · 12 secondes · sans son';});
  video.addEventListener('play',()=>button.textContent='Pause Ⅱ');video.addEventListener('pause',()=>button.textContent='Lire ▷');
  video.addEventListener('timeupdate',()=>{$('#video-progress').style.width=`${video.duration?video.currentTime/video.duration*100:0}%`;});
  video.addEventListener('ended',()=>{$('#video-status').textContent='Voyage terminé. Prêt à repartir ?';button.textContent='Revoir ▷';});
}
function renderAssistant(){window.BeybooVoice?.enter();}
function renderScreenStory(){
  screen.classList.add('story-content');const c=characters[screenStory];
  screen.innerHTML=`<span class="screen-label">${c.name.toUpperCase()} · ${screenStory+1}/10</span><img class="screen-character" src="${photo(c.id)}" alt="${c.name}"><h4>${c.title}</h4><button type="button" class="device-action" data-story="${c.id}">Lire son histoire ↗</button><button type="button" class="device-action secondary" id="screen-next-story">Le prochain compagnon →</button>`;
  $('#screen-next-story').addEventListener('click',()=>{screenStory=(screenStory+1)%10;renderScreenStory();});
}
screen.addEventListener('click',e=>{
  const app=e.target.closest('[data-screen-app]');if(app)showMode(app.dataset.screenApp);

});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!window.BeybooBedside?.isOpen()){stopMedia({leaveCall:false});}});
window.addEventListener('pagehide',()=>stopMedia());
