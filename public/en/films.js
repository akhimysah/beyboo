'use strict';
// Controls live below the picture, including on touch browsers.
const filmIcons={
  play:'<path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
  pause:'<path d="M8 5v14M16 5v14" stroke-width="4"/>',
  sound:'<path d="m11 5-6 4H2v6h3l6 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute:'<path d="m11 5-6 4H2v6h3l6 4V5Zm5 4 6 6m0-6-6 6"/>',
  expand:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>'
};
const filmSvg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${filmIcons[name]}</svg>`;
const filmTime=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
let expandedFilm=null;

document.querySelectorAll('[data-brand-film]').forEach(video=>{
  const player=video.closest('.film-player');
  const oldTrigger=player.querySelector('.film-trigger');
  const fallbackDuration=Number.parseFloat(oldTrigger?.querySelector('small')?.textContent)||10;
  const label=video.getAttribute('aria-label')||'BOOZZO';
  const error=player.querySelector('.film-error');
  video.controls=false;
  video.removeAttribute('controls');
  video.setAttribute('playsinline','');
  video.setAttribute('webkit-playsinline','');
  oldTrigger?.remove();
  const controls=document.createElement('div');
  controls.className='film-controls';
  controls.setAttribute('role','group');
  controls.setAttribute('aria-label',`Controls: ${label}`);
  controls.innerHTML=`<div class="film-controls-main"><button class="film-toggle" type="button">${filmSvg('play')}<span>Play</span></button><output class="film-time">0:00 / ${filmTime(fallbackDuration)}</output><button class="film-sound" type="button">${filmSvg('sound')}</button><button class="film-expand" type="button">${filmSvg('expand')}</button></div><input class="film-seek" type="range" min="0" max="1000" value="0" step="1" disabled>`;
  player.insertBefore(controls,error);
  const toggle=controls.querySelector('.film-toggle');
  const sound=controls.querySelector('.film-sound');
  const expand=controls.querySelector('.film-expand');
  const time=controls.querySelector('.film-time');
  const seek=controls.querySelector('.film-seek');
  seek.setAttribute('aria-label',`Progress: ${label}`);
  expand.setAttribute('aria-label',`Expand video: ${label}`);
  expand.setAttribute('aria-pressed','false');
  let seeking=false,placeholder=null,returnFocus=null;
  function update(){
    const playing=!video.paused&&!video.ended;
    const action=playing?'Pause':video.ended?'Replay':'Play';
    toggle.innerHTML=`${filmSvg(playing?'pause':'play')}<span>${action}</span>`;
    toggle.setAttribute('aria-label',`${playing?'Pause':video.ended?'Replay':'Play'} video: ${label}`);
    sound.innerHTML=filmSvg(video.muted?'mute':'sound');
    sound.setAttribute('aria-label',`${video.muted?'Unmute':'Mute'} audio: ${label}`);
    sound.setAttribute('aria-pressed',String(video.muted));
    player.classList.toggle('is-playing',playing);
  }
  function updateTime(){
    const duration=Number.isFinite(video.duration)?video.duration:fallbackDuration;
    time.textContent=`${filmTime(video.currentTime)} / ${filmTime(duration)}`;
    seek.disabled=!Number.isFinite(video.duration);
    if(!seeking)seek.value=String(Math.round(video.currentTime/duration*1000));
    seek.setAttribute('aria-valuetext',`${filmTime(video.currentTime)} of ${filmTime(duration)}`);
  }
  async function togglePlayback(){
    error.hidden=true;
    if(!video.paused&&!video.ended){video.pause();return;}
    toggle.disabled=true;
    try{await video.play();}catch{error.hidden=false;}finally{toggle.disabled=false;update();}
  }
  function closeExpanded(){
    if(expandedFilm?.player!==player)return;
    player.classList.remove('is-expanded');
    player.removeAttribute('role');player.removeAttribute('aria-modal');player.removeAttribute('aria-label');
    placeholder?.remove();placeholder=null;
    document.body.classList.remove('film-expanded');
    expandedFilm=null;
    expand.innerHTML=filmSvg('expand');expand.setAttribute('aria-label',`Expand video: ${label}`);expand.setAttribute('aria-pressed','false');
    returnFocus?.focus({preventScroll:true});
  }
  function openExpanded(){
    expandedFilm?.close();
    returnFocus=document.activeElement;
    placeholder=document.createElement('div');
    placeholder.className='film-placeholder';
    placeholder.style.height=`${player.getBoundingClientRect().height}px`;
    placeholder.setAttribute('aria-hidden','true');
    player.before(placeholder);
    player.classList.add('is-expanded');player.setAttribute('role','dialog');player.setAttribute('aria-modal','true');player.setAttribute('aria-label',label);
    document.body.classList.add('film-expanded');
    expandedFilm={player,close:closeExpanded};
    expand.innerHTML=filmSvg('close');expand.setAttribute('aria-label',`Reduce video:${label}`);expand.setAttribute('aria-pressed','true');
    expand.focus({preventScroll:true});
  }
  toggle.addEventListener('click',togglePlayback);
  sound.addEventListener('click',()=>{video.muted=!video.muted;});
  expand.addEventListener('click',()=>expandedFilm?.player===player?closeExpanded():openExpanded());
  seek.addEventListener('pointerdown',()=>{seeking=true;});
  for(const event of ['pointerup','pointercancel','change'])seek.addEventListener(event,()=>{seeking=false;});
  seek.addEventListener('input',()=>{if(Number.isFinite(video.duration)){video.currentTime=video.duration*Number(seek.value)/1000;updateTime();}});
  for(const event of ['play','pause','ended','volumechange'])video.addEventListener(event,update);
  for(const event of ['timeupdate','loadedmetadata','durationchange','ended'])video.addEventListener(event,updateTime);
  video.addEventListener('play',()=>{error.hidden=true;});
  video.addEventListener('error',()=>{error.hidden=false;});
  player.addEventListener('keydown',event=>{
    if(expandedFilm?.player!==player)return;
    if(event.key==='Escape'){event.preventDefault();closeExpanded();}
    if(event.key==='Tab'){
      const focusable=[...player.querySelectorAll('button,input,a')].filter(el=>!el.disabled&&el.getClientRects().length);
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  update();updateTime();
});
document.addEventListener('play',event=>{
  if(event.target.tagName!=='VIDEO')return;
  document.querySelectorAll('video').forEach(video=>{if(video!==event.target)video.pause();});
},true);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)document.querySelectorAll('[data-brand-film]').forEach(video=>video.pause());
});
