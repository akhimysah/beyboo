/* Small lifecycle controller: a failed or stalled film must never trap the visitor. */
(() => {
  'use strict';
  function create(video,{state,finish},clock={set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id)}){
    let active=false,generation=0,watchdog=null,lastTime=0;
    let mutedByAutoplay=false;
    const clear=()=>{if(watchdog!==null)clock.clear(watchdog);watchdog=null;};
    const guard=()=>{clear();watchdog=clock.set(()=>close('unavailable'),12000);};
    function close(reason='skip'){
      if(!active)return;active=false;generation++;clear();video.pause();finish(reason);
    }
    async function play(allowMutedFallback=false){
      if(!active)return;
      const token=++generation;
      state('loading');guard();
      try{
        await video.play();
        if(!active)video.pause();
      }catch(error){
        if(!active||token!==generation)return;
        clear();
        if(allowMutedFallback&&error.name==='NotAllowedError'&&!video.muted){
          mutedByAutoplay=true;
          video.muted=true;
          return play();
        }
        state('blocked');
      }
    }
    function resume(){
      if(!active)return;
      if(mutedByAutoplay){
        mutedByAutoplay=false;
        video.currentTime=lastTime=0;
        video.muted=false;
      }
      return play();
    }
    function toggleSound(){
      if(!active)return;
      if(mutedByAutoplay)return resume();
      video.muted=!video.muted;
      if(video.paused)return play();
      state('playing');
    }
    video.addEventListener('playing',()=>{if(!active){video.pause();return;}state('playing');guard();});
    video.addEventListener('timeupdate',()=>{if(active&&!video.paused&&video.currentTime>lastTime){lastTime=video.currentTime;guard();}});
    video.addEventListener('pause',()=>{if(active&&!video.ended){clear();state('paused');}});
    video.addEventListener('waiting',()=>{if(active){state('loading');guard();}});
    video.addEventListener('ended',()=>close('ended'));
    video.addEventListener('error',()=>close('unavailable'));
    return {
      open(){
        if(active)return;
        active=true;mutedByAutoplay=false;lastTime=0;
        video.defaultMuted=false;video.muted=false;video.loop=false;video.currentTime=0;
        return play(true);
      },
      play:resume,toggleSound,close,isActive:()=>active,needsSoundGesture:()=>mutedByAutoplay
    };
  }
  window.BeybooIntroPlayer={create};
})();
