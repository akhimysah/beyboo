/* Opening only on the storefront home, once per browser session; direct app and section links remain direct. */
(() => {
  'use strict';
  const root=document.documentElement,dialog=document.getElementById('brand-intro'),video=document.getElementById('intro-film');
  const skip=document.getElementById('intro-skip'),sound=document.getElementById('intro-sound'),play=document.getElementById('intro-play'),status=document.getElementById('intro-status');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let returnFocus=null,returnScroll=0,opening=false,closing=false,fadeTimer;
  function soundLabel(){sound.dataset.unlock=String(player.needsSoundGesture());sound.textContent=player.needsSoundGesture()?'Hear it from the start ♫':video.muted?'Turn sound on ♫':'Mute sound ♫';sound.setAttribute('aria-pressed',String(!video.muted));}
  function showState(state){
    soundLabel();
    play.hidden=state!=='blocked'&&state!=='paused';
    play.textContent=state==='blocked'&&player.needsSoundGesture()?'Play with sound ▷':state==='paused'?'Resume film ▷':'Play film ▷';
    status.textContent=state==='blocked'?'Tap to play the film.':state==='paused'?'The film is paused.':state==='loading'?'Loading film…':video.muted?'Noah’s film · muted':'Noah’s film · 12 seconds';
  }
  function finish(reason){
    closing=true;dialog.classList.add('is-leaving');
    const cleanup=()=>{
      clearTimeout(fadeTimer);dialog.close();dialog.classList.remove('is-leaving');root.classList.remove('intro-open','intro-pending');closing=false;
      if(opening){window.scrollTo({top:0,left:0,behavior:'instant'});const hero=document.getElementById('hero-title');hero.setAttribute('tabindex','-1');hero.focus({preventScroll:true});}
      else{window.scrollTo({top:returnScroll,behavior:'instant'});returnFocus?.focus({preventScroll:true});}
      document.dispatchEvent(new CustomEvent('beyboo-intro-end',{detail:{reason,opening}}));
    };
    if(reason==='pagehide')cleanup();
    else fadeTimer=setTimeout(cleanup,reduced.matches||reason==='unavailable'?0:600);
  }
  const player=window.BeybooIntroPlayer.create(video,{state:showState,finish});
  function open(isOpening=false){
    if(player.isActive()||closing)return;
    opening=isOpening;returnFocus=document.activeElement;returnScroll=window.scrollY;
    if(isOpening){try{sessionStorage.setItem('beyboo.intro.seen','1');}catch{}}
    if(!isOpening){
      if(window.BeybooVoice?.isActive())window.BeybooVoice.end();
      if(window.BeybooGaze?.isActive())window.BeybooGaze.stop();
      window.BeybooCamera?.leave();window.BeybooCall?.leave();
    }
    dialog.showModal();root.classList.add('intro-open');root.classList.remove('intro-pending');
    if(!video.getAttribute('src'))video.src=video.dataset.src;
    video.playsInline=true;play.hidden=true;dialog.style.setProperty('--intro-progress','0');soundLabel();
    dialog.focus({preventScroll:true});player.open();
  }
  skip.addEventListener('click',()=>player.close());
  play.addEventListener('click',()=>player.play());
  sound.addEventListener('click',()=>player.toggleSound());
  video.addEventListener('volumechange',soundLabel);
  video.addEventListener('timeupdate',()=>{if(Number.isFinite(video.duration)&&video.duration>0)dialog.style.setProperty('--intro-progress',Math.min(1,video.currentTime/video.duration));});
  dialog.addEventListener('cancel',event=>{event.preventDefault();player.close();});
  document.querySelectorAll('[data-intro-replay]').forEach(button=>button.addEventListener('click',()=>open(false)));
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&player.isActive())video.pause();});
  window.addEventListener('pagehide',()=>player.close('pagehide'));
  reduced.addEventListener('change',()=>{if(reduced.matches&&player.isActive())player.close();});
  const auto=root.classList.contains('intro-pending');
  if(auto)open(true);
  else root.classList.remove('intro-pending');
  clearTimeout(window.beybooIntroFallback);
})();
