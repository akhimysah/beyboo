'use strict';
// Product interface with OpenAI voice and peer-to-peer family video calls (call.js).
const modeData={
  eye:['A lively gaze.','Choose listening, joy or curiosity, then tap the eye to open its apps.'],
  menu:['It starts with a tap.','Choose an activity on the screen. The plush stays still throughout the demo.'],
  video:['A little window into space.','Play the original Moon Mission clip, pause it and pick up where you left off. Open YouTube from your companion’s home screen.'],
  call:['Say hello on a video call.','Call someone signed in to the same family, or send them an invitation link: the call goes directly between your devices, inside the eye.'],
  assistant:['I’m listening.','Ask a question out loud. Your companion listens, replies and remembers what you’ve said during your chat. The eye reacts while the plush stays still.'],
  story:['Every character has a story.','Get to know the ten companions. Pick a character to read their full story.']
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
  $('#device-hint').textContent=next==='eye'?'Tap the eye to explore.':next==='call'?'Family calls · Device to device':'BOOZZO One · Interactive demo';
  if(next==='menu')screen.innerHTML='<span class="screen-label">HELLO THERE</span><h4>What shall we do?</h4><div class="mini-apps">'+[['video','▷','Video'],['game','✦','Game'],['music','♫','Music'],['assistant','◉','Assistant'],['call','▣','Call'],['story','▤','Stories']].map(([id,icon,label])=>`<button type="button" data-screen-app="${id}"><span>${icon}</span>${label}</button>`).join('')+'</div>';
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
  $('#device-hint').textContent=`${b.textContent.trim()}. Tap the eye to explore.`;
  eye.classList.add('blink');setTimeout(()=>eye.classList.remove('blink'),180);
}));
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!reduceMotion){eye.addEventListener('pointermove',e=>{if(mode==='assistant'||window.BeybooVoice?.isMounted())return;const r=eye.getBoundingClientRect();$('img',eye).style.transform=`translate(${(e.clientX-r.left-r.width/2)/r.width*9}px,${(e.clientY-r.top-r.height/2)/r.height*9}px)`;});eye.addEventListener('pointerleave',()=>$('img',eye).style.transform='');}
function renderVideo(){
  screen.classList.add('video-content');
  screen.innerHTML='<span class="screen-label">LITTLE CINEMA</span><h4>Moon Mission</h4><video id="demo-video" playsinline preload="metadata" aria-label="Original animated clip of a journey to the Moon"><source src="assets/mission-lune.mp4" type="video/mp4"></video><div class="video-controls"><button type="button" class="device-action" id="video-play">Play ▷</button><button type="button" class="device-action secondary" id="video-restart" aria-label="Restart video">↺</button></div><div class="video-progress"><span id="video-progress"></span></div><small id="video-status">Original clip · 12 seconds · silent</small>';
  const video=$('#demo-video'),button=$('#video-play');
  button.addEventListener('click',async()=>{if(video.paused){try{await video.play();}catch{$('#video-status').textContent='The video couldn’t play. Try again.';}}else video.pause();});
  $('#video-restart').addEventListener('click',()=>{video.currentTime=0;$('#video-status').textContent='Original clip · 12 seconds · silent';});
  video.addEventListener('play',()=>button.textContent='Pause Ⅱ');video.addEventListener('pause',()=>button.textContent='Play ▷');
  video.addEventListener('timeupdate',()=>{$('#video-progress').style.width=`${video.duration?video.currentTime/video.duration*100:0}%`;});
  video.addEventListener('ended',()=>{$('#video-status').textContent='We’ve landed. Ready to go again?';button.textContent='Replay ▷';});
}
function renderAssistant(){window.BeybooVoice?.enter();}
function renderScreenStory(){
  screen.classList.add('story-content');const c=characters[screenStory];
  screen.innerHTML=`<span class="screen-label">${c.name.toUpperCase()} · ${screenStory+1}/10</span><img class="screen-character" src="${photo(c.id)}" alt="${c.name}"><h4>${c.title}</h4><button type="button" class="device-action" data-story="${c.id}">Read the story ↗</button><button type="button" class="device-action secondary" id="screen-next-story">Next companion →</button>`;
  $('#screen-next-story').addEventListener('click',()=>{screenStory=(screenStory+1)%10;renderScreenStory();});
}
screen.addEventListener('click',e=>{
  const app=e.target.closest('[data-screen-app]');if(app)showMode(app.dataset.screenApp);

});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!window.BeybooBedside?.isOpen()){stopMedia({leaveCall:false});}});
window.addEventListener('pagehide',()=>stopMedia());
