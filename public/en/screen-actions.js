/* One real screen controller shared by touch controls and Realtime function calls. */
(() => {
  'use strict';
  const q = id => document.getElementById(id);
  const stage = q('voice-stage'), toolbar = q('voice-screen-toolbar');
  if (!stage || !toolbar) return;
  const eye = q('living-eye'), card = document.querySelector('.experience-card');
  const allowed = new Set(['show_eye','open_profile','set_speaking_mood','set_expression','play_video','open_youtube','pause_media','resume_media','stop_media','open_game','open_math','answer_math','next_math','play_music','open_story','open_call','open_weather','open_clock','set_nightlight','open_camera','open_face','take_photo','open_messages','open_companions','get_state','open_home']);
  const maths = [[7,5],[4,3],[9,6],[8,8],[12,7],[15,9]];
  let view = 'eye', playback = 'idle', revision = 0, video = null, youtube = null, youtubeLoader = null;
  let question = 0, mathAnswered = false, score = 0, target = 4, cancelYouTube = null;
  function say(message) {
    q('voice-screen-status').textContent = message;
    q('voice-action-status').textContent = message;
  }
  document.addEventListener('beyboo-camera-state',event=>{
    if(view==='camera'&&typeof event.detail?.description==='string')say(event.detail.description);
  });
  function youtubeSound(player=youtube) {
    try {
      const muted=player?.isMuted();
      if(typeof muted!=='boolean')return 'unknown';
      return muted||player.getVolume?.()===0?'muted':'on';
    }catch{return 'unknown';}
  }
  function youtubePlayingMessage(sound) {
    return sound==='muted'?'YouTube is playing with the sound off. Tap Unmute to listen.':sound==='on'?'YouTube is playing with sound.':'YouTube is playing. Waiting for the player to confirm the sound setting.';
  }
  function buttons() {
    const media = ['video','youtube','music'].includes(view);
    q('voice-screen-play').hidden = q('voice-screen-pause').hidden = !media;
    q('voice-screen-sound').hidden = view !== 'youtube';
    const sound=youtubeSound();
    q('voice-screen-sound').textContent=sound==='on'?'Mute':'Unmute';
    q('voice-screen-sound').setAttribute('aria-pressed',String(sound==='on'));
    q('voice-screen-sound').disabled=!youtube||playback==='loading';
    q('voice-video-fallback').hidden = view!=='youtube'||!['blocked','error'].includes(playback);
    q('voice-screen-play').disabled = playback === 'loading';
    q('voice-screen-pause').disabled = playback === 'loading';
  }
  function snapshot(description) {
    const camera=view==='camera'?(window.BeybooCamera?.publicState()||{}):{};
    return {ok:playback!=='error'&&camera.camera!=='error',screen:view,media:playback,...(description?{description}:{}),...(view==='math'?{question:`${maths[question][0]} + ${maths[question][1]}`,answered:mathAnswered}:{}),...(view==='game'?{...window.BeybooArcade?.state(),score}: {}),...(view==='music'?window.BeybooMusic?.state():{}),...(view==='youtube'?{sound:youtubeSound()}:{}),...(['clock','nightlight'].includes(view)?window.BeybooBedside?.state():{}),...(window.BeybooMessages?{unreadMessages:window.BeybooMessages.unread(),lastSender:window.BeybooMessages.lastSender(),...(view==='messages'?window.BeybooMessages.state():{})}:{}),...camera};
  }
  let weatherAbort=null, searchAbort=null;
  function clear() {
    window.BeybooBedside?.reset();
    window.BeybooMessages?.leave();
    window.BeybooMood?.stopPreview();
    weatherAbort?.abort();weatherAbort=null;searchAbort?.abort();searchAbort=null;
    window.BeybooDevice?.stopSpeech();
    window.BeybooProfile?.leave();
    window.BeybooCamera?.leave();
    revision++; window.BeybooMusic?.stop(); window.BeybooArcade?.reset();
    if (cancelYouTube) { cancelYouTube(); cancelYouTube=null; }
    if (video) { video.pause(); video.removeAttribute('src'); video.replaceChildren(); video.load(); video=null; }
    if (youtube) { try{youtube.destroy();}catch{} youtube=null; }
    stage.replaceChildren(); q('voice-youtube-external').hidden=true; card.classList.remove('has-screen-wide');
    playback='idle';
  }
  function display(next, html) {
    clear(); view=next;
    eye.hidden=true; q('device-content').hidden=true;
    stage.hidden=toolbar.hidden=false; stage.className='voice-stage voice-stage--'+next;
    stage.innerHTML=html; buttons();
    window.BeybooCompanion?.refresh({reveal:true}); // Keep the full product visible; the user alone chooses the optional magnifier.
    // Touch targets inside a small eye are unusable: interactive screens open the magnifier automatically.
    if(['home','game','math','profile','messages','companions'].includes(next) && q('plush-eye-dock').getBoundingClientRect().width<200)window.BeybooCompanion?.setDetail(true,{reveal:true});
    return revision;
  }
  function showEye() {
    clear(); view='eye'; stage.hidden=true; eye.hidden=false; toolbar.hidden=true;
    say('The eye is back. You can keep talking.');
    return snapshot('The eye is showing.');
  }
  async function playLocal() {
    if (!video) return {ok:false,description:'Open a BOOZZO clip first.'};
    const current=revision, media=video;
    try {
      await media.play();
      if(current!==revision)return {ok:false,cancelled:true};
      playback='playing'; say('Moon Mission is playing. Say “pause” to stop the video.');
    } catch {
      if(current!==revision)return {ok:false,cancelled:true};
      playback='blocked'; say('The video is ready. Tap Play to start.');
    }
    buttons(); return snapshot(playback==='playing'?'Moon Mission is playing.':'The video is ready. Tap Play to start it.');
  }
  async function openVideo() {
    display('video','<video id="voice-video" playsinline muted preload="auto" aria-label="Moon Mission, original clip"><source src="assets/mission-lune.mp4" type="video/mp4"></video>');
    video=q('voice-video'); video.muted=true;
    video.addEventListener('ended',()=>{playback='ended';say('Moon Mission has finished. Say “play it again” or choose an activity.');buttons();});
    video.addEventListener('error',()=>{playback='error';say('The video couldn’t load. Check your connection and try again.');buttons();});
    return playLocal();
  }
  function youtubeId(value) {
    try {
      const u=new URL(value);
      if(u.protocol!=='https:'||!['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(u.hostname))return null;
      const id=u.hostname==='youtu.be'?u.pathname.slice(1):u.pathname==='/watch'?u.searchParams.get('v'): /^\/(embed|shorts|live)\//.test(u.pathname)?u.pathname.split('/')[2]:null;
      return /^[a-zA-Z0-9_-]{11}$/.test(id||'')?id:null;
    }catch{return null;}
  }
  function loadYouTube() {
    if(window.YT?.Player)return Promise.resolve();
    if(youtubeLoader)return youtubeLoader;
    youtubeLoader=new Promise((resolve,reject)=>{
      const script=document.createElement('script');let done=false;
      const previous=window.onYouTubeIframeAPIReady;
      const finish=error=>{if(done)return;done=true;clearTimeout(timeout);script.onerror=null;if(error){script.remove();reject(error);}else resolve();};
      const timeout=setTimeout(()=>finish(Error('timeout')),12000);
      window.onYouTubeIframeAPIReady=()=>{try{previous?.();}finally{finish();}};
      script.src='https://www.youtube.com/iframe_api';script.async=true;script.onerror=()=>finish(Error('network'));
      document.head.append(script);
    }).catch(error=>{youtubeLoader=null;throw error;});
    return youtubeLoader;
  }
  async function openYouTube(value='catalog') {
    const selection=window.BeybooDevice.videoFor(value);
    const id=youtubeId(value)||(selection?selection.ids[1]:null);
    if(!id){
      const current=display('search','<div class="voice-screen-copy"><span class="screen-label">YOUTUBE</span><h4>Pick your video.</h4><p>BOOZZO and Paxi films · choose below the eye.</p><a id="voice-youtube-search" target="_blank" rel="noopener noreferrer">Search YouTube ↗</a></div>');
      q('voice-youtube-search').href='https://www.youtube.com/results?search_query='+encodeURIComponent(value && !['space','catalog'].includes(value)?value:'Paxi ESA');
      if(value && !['space','catalog','paxi','espace','youtube','you tube'].includes(value.toLowerCase())){
        searchAbort=new AbortController();
        const results=await window.BeybooLibrary.search(value,searchAbort.signal);
        if(current!==revision)return {ok:false,cancelled:true};
        if(results.message){
          const label=stage.querySelector('p');label.textContent=results.message;
          label.dataset.results=JSON.stringify(results.items||[]);
          say(results.message);return snapshot(results.description||results.message);
        }
      }
      say('Choose a film below the eye, or open a search on YouTube.');
      return snapshot('Film selection displayed. Choose a title to play it.');
    }
    const current=display('youtube','<div id="voice-youtube-player"></div>');
    playback='loading';buttons();
    q('voice-youtube-external').href='https://www.youtube.com/watch?v='+id;
    q('voice-youtube-external').hidden=false;
    window.BeybooCompanion?.setDetail(true,{reveal:true});
    const playerArea=q('voice-youtube-player').getBoundingClientRect();
    if(playerArea.width<200 || playerArea.height<200){
      playback='error';const message='This eye is too small for the YouTube player. Open the YouTube link or play the BOOZZO film in the eye.';say(message);buttons();return snapshot(message);
    }
    say('Loading the YouTube player…');
    // The complete provider viewport sits inside the round eye. Playback controls are below the plush.
    try {
      await loadYouTube();if(current!==revision)return {ok:false,cancelled:true};
      const bounds=q('voice-youtube-player').getBoundingClientRect();if(bounds.width<200||bounds.height<200)throw Error('player_size');
      return await new Promise(resolve=>{
        let settled=false;
        const finish=description=>{if(settled)return;settled=true;clearTimeout(wait);cancelYouTube=null;resolve(current===revision?snapshot(description):{ok:false,cancelled:true});};
        const wait=setTimeout(()=>{if(current===revision&&playback==='loading'){playback='blocked';say('YouTube is taking a while to respond. Tap Play or open the video on YouTube.');buttons();}finish('Playback is unconfirmed. Check the player or connection.');},14000);
        cancelYouTube=()=>finish('Action cancelled.');
        youtube=new YT.Player('voice-youtube-player',{
          width:'100%',height:'100%',videoId:id,host:'https://www.youtube-nocookie.com',
          playerVars:{playsinline:1,rel:0,origin:location.origin,hl:'en',controls:1,fs:1},
          events:{
            onReady:e=>{if(current!==revision)return;e.target.mute();e.target.playVideo();},
            onStateChange:e=>{
              if(current!==revision)return;
              if(e.data===1){playback='playing';const message=youtubePlayingMessage(youtubeSound(e.target));say(message);finish(message);}
              if(e.data===2){playback='paused';say('YouTube is paused. You can keep talking.');}
              if(e.data===0){playback='ended';say('The YouTube video has finished.');}
              buttons();
            },
            onAutoplayBlocked:()=>{if(current!==revision)return;playback='blocked';say('YouTube is ready. Tap Play to start.');buttons();finish('Your browser requires a tap on Play to start the video.');},
            onError:()=>{if(current!==revision)return;playback='error';say('YouTube couldn’t play this video here. Open the link below the player or try another video.');buttons();finish('YouTube could not play this video.');}
          }
        });
        const iframe=youtube.getIframe();
        iframe.title='YouTube video in BOOZZO';iframe.setAttribute('allow','autoplay; encrypted-media; fullscreen; picture-in-picture');iframe.referrerPolicy='strict-origin-when-cross-origin';

      });
    }catch{
      if(current!==revision)return {ok:false,cancelled:true};
      playback='error';say('YouTube couldn’t load. You can still watch Moon Mission.');buttons();
      return {ok:false,screen:view,description:'YouTube is unavailable on this connection.'};
    }
  }
  if(window.ResizeObserver)new window.ResizeObserver(()=>{
    if(view!=='youtube'||!youtube)return;
    const bounds=youtube.getIframe().getBoundingClientRect();
    if(bounds.width>=200&&bounds.height>=200)return;
    ++revision;cancelYouTube?.();youtube.destroy();youtube=null;playback='error';buttons();
    say('Player closed. Choose the BOOZZO film in the eye or open YouTube.');
  }).observe(q('plush-eye-dock'));
  function renderMath() {
    const [a,b]=maths[question],answer=a+b;
    const choices=[answer-1,answer,answer+2].sort((x,y)=>(x%3)-(y%3));
    stage.innerHTML='<div class="voice-screen-copy"><span class="screen-label">YOUR TURN</span><h4 class="voice-math-question">'+a+' + '+b+' ?</h4><div class="voice-math-options">'+choices.map(n=>`<button type="button" data-math-answer="${n}">${n}</button>`).join('')+'</div><p id="voice-math-feedback" role="status">Say your answer or tap a number.</p><button type="button" id="voice-math-next" hidden>Next question →</button></div>';
    stage.querySelectorAll('[data-math-answer]').forEach(b=>b.addEventListener('click',()=>run({action:'answer_math',number:Number(b.dataset.mathAnswer)})));
    q('voice-math-next').addEventListener('click',()=>run({action:'next_math'}));
    say(`What’s ${a} + ${b}? Tell BOOZZO your answer.`);
  }
  function renderStars() {
    stage.innerHTML=score>=5?'<div class="voice-screen-copy"><span class="screen-label">WELL DONE</span><h4>Five stars!</h4><p>A constellation of your very own.</p><button type="button" id="voice-stars-again">Play again</button></div>':'<div class="voice-screen-copy"><span class="screen-label">CATCH THE STARS</span><h4>'+score+' / 5</h4><div class="star-grid">'+Array.from({length:9},(_,i)=>`<button type="button" data-voice-star="${i}" class="${i===target?'star-target':''}" aria-label="${i===target?'Catch the star':'Empty square'}">${i===target?'✦':'·'}</button>`).join('')+'</div></div>';
    stage.querySelectorAll('[data-voice-star]').forEach(b=>b.addEventListener('click',()=>{if(Number(b.dataset.voiceStar)!==target)return;score++;target=(target+4)%9;renderStars();say(`You found ${score} star${score===1?'':'s'}.`);}));
    q('voice-stars-again')?.addEventListener('click',()=>run({action:'open_game',value:'stars'}));
  }
  async function openMusic(value) {
    display('music','');
    const current=revision;
    await window.BeybooMusic.open(stage,value,(state,message)=>{
      if(current!==revision)return;
      playback=state; buttons(); say(message);
    });
    return current===revision ? snapshot(q('voice-screen-status').textContent) : {ok:false,cancelled:true};
  }
  async function run(args) {
    if(!args||!allowed.has(args.action)|| (args.value!==undefined&&(typeof args.value!=='string'||args.value.length>500)))return {ok:false,description:'Unknown command.'};
    const {action,value,number}=args;
    const feature={open_camera:'camera',open_face:'camera',take_photo:'camera',open_call:'calls',open_messages:'messages'}[action];
    if(feature && window.BeybooFamily && !window.BeybooFamily.guard(feature))return {ok:false,description:'Disabled in family settings.'};
    if(args.mood!==undefined || action==='set_speaking_mood'){
      if(!window.BeybooMood?.choose(args.mood))return {ok:false,description:"Choose a supported companion mood."};
      if(action==='set_speaking_mood')return {ok:true,mood:args.mood,description:"Mood ready for your spoken reply."};
    }
    if(action==='open_clock'){
      display('clock',''); window.BeybooBedside.mount(stage,'clock',say);
      return snapshot(window.BeybooBedside.message());
    }
    if(action==='set_nightlight'){
      if(value!==undefined && !['on','off'].includes(value))return {ok:false,description:'Choose on or off.'};
      if(value==='off'){
        if(view==='nightlight')window.BeybooBedside.turn(false);
        return {...snapshot('The night light is off.'),light:'off'};
      }
      if(view==='nightlight')window.BeybooBedside.turn(true);
      else {display('nightlight','');window.BeybooBedside.mount(stage,'nightlight',say);}
      return snapshot(window.BeybooBedside.message());
    }
    if(action==='get_state')return snapshot(q('voice-screen-status').textContent);
    if(action==='open_home'){
      const launcher=window.BeybooLauncher;
      if(!launcher)return {ok:false,description:'The home screen is unavailable.'};
      if(!launcher.has(value))return {ok:false,description:launcher.unknown()};
      display('home',launcher.markup(value));launcher.mount(stage,run);
      const message=launcher.message(value);say(message);return snapshot(message);
    }
    if(action==='open_companions'){
      const companions=window.BeybooCompanions;
      if(!companions)return {ok:false,description:'Choix des compagnons indisponible.'};
      display('companions',companions.markup());companions.mount(stage,run);
      const message=companions.message();say(message);return snapshot(message);
    }
    if(action==='open_messages'){
      const messages=window.BeybooMessages;
      if(!messages)return {ok:false,description:'Messages are unavailable.'};
      display('messages',messages.markup());messages.open(stage,say);
      const message=messages.message();say(message);return snapshot(message);
    }
    if(action==='show_eye'||action==='stop_media')return showEye();
    if(action==='set_expression'){
      if(!['listen','joy','attention'].includes(value))return {ok:false,description:'Unknown expression.'};
      showEye();eye.dataset.expression=value;say('Expression: '+({listen:'listening',joy:'joy',attention:'attention'}[value]));return snapshot('Current expression: '+value);
    }
    if(action==='open_profile'){
      if(!window.BeybooProfile)return {ok:false,description:'The profile is unavailable.'};
      display('profile',window.BeybooProfile.markup());window.BeybooProfile.mount();
      say('The profile keyboard is open in the eye. Your details are saved on this device.');
      return snapshot('Local demo profile, stored on this device.');
    }
    if(action==='open_face'){
      showEye();window.BeybooGazeUI?.show();
      const active=window.BeybooGaze?.isActive();
      return snapshot(active?'Local face tracking is on. Its status appears below the plush. Tracking follows movement without identifying people.':'The eye is ready. Tap the face-tracking control below the plush to allow camera access. Tracking follows movement locally without identifying you.');
    }
    if(action==='open_weather'){
      const current=display('weather','<div class="voice-screen-copy eye-weather-screen"><span id="eye-weather-symbol" aria-hidden="true">☀</span><h4 id="eye-weather-title">Weather</h4><p id="eye-weather-label"></p></div>');
      weatherAbort=new AbortController();
      const result=await window.BeybooLibrary.weather(value || '',()=>revision===current,weatherAbort.signal);
      if(revision!==current)return {ok:false,cancelled:true};
      say(result.description);return {...snapshot(result.description),ok:result.ok};
    }
    if(action==='open_camera'){
      display('camera',window.BeybooCamera.markup());window.BeybooCamera.open('photo');
      return snapshot('The camera screen is open in the eye. Tap Enable camera to start. Local detection finds faces without identifying people.');
    }
    if(action==='take_photo')return window.BeybooCamera.capture();
    if(action==='play_video')return openVideo();
    if(action==='open_youtube')return openYouTube(value);
    if(action==='pause_media'){
      if(video){video.pause();playback='paused';}
      else if(youtube){youtube.pauseVideo();playback='pause_requested';}
      else if(view==='music'){window.BeybooMusic.pause();return snapshot(q('voice-screen-status').textContent);}
      else return {ok:false,description:'Open a video or play some music first.'};
      say(youtube?'Asking YouTube to pause.':'Playback paused. You can keep talking.');buttons();return snapshot(youtube?'Pause request sent to YouTube.':'Playback paused.');
    }
    if(action==='resume_media'){
      if(video){if(video.ended)video.currentTime=0;return playLocal();}
      if(youtube){youtube.playVideo();return snapshot('Asking YouTube to resume. Watch the player for confirmation.');}
      if(view==='music'){const current=revision;await window.BeybooMusic.play();return current===revision?snapshot(q('voice-screen-status').textContent):{ok:false,cancelled:true};}
      return {ok:false,description:'Ask for a video or some music to get started.'};
    }
    if(action==='open_math'||action==='next_math'){
      question=action==='next_math'?(question+1)%maths.length:0;mathAnswered=false;display('math','');renderMath();return snapshot('The question is on the screen.');
    }
    if(action==='answer_math'){
      if(view!=='math'||!Number.isInteger(number))return {ok:false,description:'Open a math question and answer with a whole number.'};
      const correct=number===maths[question][0]+maths[question][1];mathAnswered=correct;
      q('voice-math-feedback').textContent=correct?'Well done! '+number+' is the right answer.':'Not quite. Try another answer.';
      q('voice-math-feedback').dataset.correct=String(correct);q('voice-math-next').hidden=!correct;
      say(q('voice-math-feedback').textContent);return {...snapshot(),correct,answer:number};
    }
    if(action==='open_game'){
      score=0; target=4; display('game','');
      window.BeybooArcade.start(stage,value);
      if(value==='stars')renderStars();
      const title=window.BeybooArcade.title();
      say(title); return snapshot(title);
    }
    if(action==='play_music')return openMusic(value);
    if(action==='open_story'){
      const c=characters.find(c=>c.id===(value||'liam'));if(!c)return {ok:false,description:'Unknown companion.'};
      display('story','<div class="voice-screen-copy"><span class="screen-label">A STORY WITH</span><img id="voice-story-image" class="voice-story-image" alt=""><h4 id="voice-story-name"></h4><p id="voice-story-title"></p></div>');
      q('voice-story-image').src=photo(c.id);q('voice-story-image').alt=c.name;q('voice-story-name').textContent=c.name;q('voice-story-title').textContent=c.title;
      say(c.name+' is on the screen. Ask BOOZZO to tell their story.');return {...snapshot('The character is on screen. You can now tell their story.'),character:c.name,story:c.story};
    }
    if(action==='open_call'){
      display('call','<div class="voice-screen-copy"><span class="screen-label">VIDEO CALL</span><h4>Say hello to someone you love.</h4><p>Your call connects your devices directly.<br>Tap below to end the AI conversation and set up your call.</p><button type="button" id="voice-go-call">Go to video call →</button></div>');
      q('voice-go-call').addEventListener('click',()=>showMode('call'));
      say('Tap the button in the eye to choose who to call.');return snapshot('The Calls screen button is ready. Nobody has been called yet.');
    }
  }
  q('voice-video-fallback').addEventListener('click',()=>run({action:'play_video'}));
  q('voice-screen-play').addEventListener('click',()=>run({action:'resume_media'}));
  q('voice-screen-pause').addEventListener('click',()=>run({action:'pause_media'}));
  q('voice-screen-home').addEventListener('click',showEye);
  q('voice-screen-sound').addEventListener('click',()=>{
    if(!youtube)return;
    const current=revision,player=youtube,muting=youtubeSound(player)==='on';
    try{
      if(muting)player.mute();else{player.unMute();player.setVolume(65);}
      say(muting?'Asking YouTube to mute…':'Asking YouTube to turn on sound…');
      // The iframe confirms commands asynchronously. Read its actual state afterwards.
      setTimeout(()=>{
        if(current!==revision||youtube!==player)return;
        const sound=youtubeSound(player);buttons();
        if(playback==='playing')say(youtubePlayingMessage(sound));
        else say(sound==='on'?'YouTube sound is on.':sound==='muted'?'YouTube is muted.':'Waiting for YouTube to confirm the sound setting.');
      },250);
    }catch{say('Sound controls are unavailable here. Open the video on YouTube to try again.');}
  });
  q('voice-youtube-form').addEventListener('submit',event=>{event.preventDefault();run({action:'open_youtube',value:q('voice-youtube-url').value.trim()});});
  document.querySelectorAll('[data-voice-action]').forEach(button=>button.addEventListener('click',()=>run({action:button.dataset.voiceAction,...(button.dataset.value?{value:button.dataset.value}:{})})));
  window.BeybooScreen={run,snapshot,
    duck(value){window.BeybooMusic?.duck(value);try{if(youtube)youtube.setVolume(value?15:65);}catch{}},
    leave(){clear();window.BeybooMusic?.duck(false);view='eye';stage.hidden=toolbar.hidden=true;eye.hidden=false;q('voice-youtube-external').hidden=true;}
  };
})();
