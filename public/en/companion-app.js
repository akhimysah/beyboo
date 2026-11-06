/* The photograph never animates. The single live display stays inside its eye in every mode. */
(() => {
  'use strict';
  const q=id=>document.getElementById(id), card=document.querySelector('.experience-card');
  const shell=card.querySelector('.device-shell'), eye=q('living-eye');
  const appMode=document.documentElement.classList.contains('beyboo-app');
  let large=false,installPrompt=null,refreshPending=false,portraitGeometry={aspect:7/6,width:.24,height:.24};
  const scene=q('companion-scene'),dock=q('plush-eye-dock');
  const toggle=(el,name,value)=>{if(el.classList.contains(name)!==value)el.classList.toggle(name,value);};
  function sizeScreen(){
    if(document.documentElement.classList.contains('beyboo-screen')){
      // Screen mode: the dock is the whole display; the 400px screen scales to the dock itself.
      const d=dock.getBoundingClientRect().width||400;
      dock.style.setProperty('--screen-scale',d/400);dock.style.setProperty('--screen-scale-y',d/400);
      scene.style.setProperty('--detail-size',d+'px');return;
    }
    const w=scene.getBoundingClientRect().width;
    const diameter=large?Math.min(400,w-32):w*portraitGeometry.width;
    scene.style.setProperty('--photo-height',w*portraitGeometry.aspect+'px');
    scene.style.setProperty('--detail-size',Math.min(400,w-32)+'px');
    dock.style.setProperty('--screen-scale',diameter/400);
    dock.style.setProperty('--screen-scale-y',(large?diameter:w*portraitGeometry.height)/400);
  }
  function sync({reveal=false}={}) {
    refreshPending=false;
    const activity=!q('voice-stage').hidden||!q('device-content').hidden||!q('call-stage').hidden;
    if(shell.parentElement!==dock)dock.append(shell);
    toggle(card,'has-eye-detail',large);
    q('reading-screen-dock').hidden=true;
    q('companion-screen-size').hidden=false;
    q('companion-screen-size').textContent=large?'Close magnifier ↗':'Magnify the screen ↗';
    q('companion-screen-size').setAttribute('aria-expanded',String(large));
    q('companion-detail-caption').hidden=!large;
    q('companion-screen-note').textContent=activity?'Watch the activity in your companion’s eye and use the controls below.':'Tap the eye to open its apps, the microphone to talk. The plush stays still.';
    eye.disabled=false;sizeScreen();
    if(reveal){const rect=scene.getBoundingClientRect();if(rect.top<70||rect.top>innerHeight-160)requestAnimationFrame(()=>scene.scrollIntoView({behavior:'instant',block:'start'}));}
  }
  new ResizeObserver(sizeScreen).observe(scene);
  const schedule=()=>{if(!refreshPending){refreshPending=true;queueMicrotask(sync);}};
  const observer=new MutationObserver(schedule);
  [card,eye,q('voice-stage'),q('device-content'),q('call-stage')].forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['class','hidden']}));
  function ensureVoice(){if(!window.BeybooVoice.isMounted())showMode('assistant');}
  function speak(){if(window.BeybooProfile?.isOpen())window.BeybooScreen.run({action:'show_eye'});ensureVoice();sync();return window.BeybooVoice.start();}
  function home(){large=false;ensureVoice();window.BeybooScreen.run({action:'show_eye'});sync();}
  window.BeybooCompanion={speak,home,refresh:sync,setPortraitGeometry(value){portraitGeometry=value;sizeScreen();},setDetail(value,{reveal=false}={}){large=!!value;sync();if(reveal)q('companion-detail-caption').scrollIntoView({behavior:'instant',block:'start'});}};
  const mainTalk=document.createElement('button');mainTalk.id='companion-talk-main';mainTalk.type='button';mainTalk.className='companion-talk-main';mainTalk.textContent='◉ Talk to BOOZZO';
  q('voice-live-meter').after(mainTalk);
  mainTalk.addEventListener('click',()=>window.BeybooVoice.isActive()?window.BeybooVoice.end():speak());
  document.addEventListener('beyboo-voice-state',event=>{
    mainTalk.textContent=event.detail.busy?'Cancel connection':event.detail.active?(event.detail.preview?'Stop preview':'End conversation'):'◉ Talk to BOOZZO';
    mainTalk.classList.toggle('is-connected',event.detail.active);
  });
  document.querySelectorAll('[data-companion-action]').forEach(button=>button.addEventListener('click',()=>{
    const action=button.dataset.companionAction;
    if(action==='talk'){speak();return;}
    if(action==='face'){window.BeybooGazeUI?.toggle();return;}
    if(action==='call'){showMode('call');sync({reveal:true});return;}
    ensureVoice();const actions={clock:'open_clock',nightlight:'set_nightlight',weather:'open_weather',camera:'open_camera',face:'open_face',youtube:'open_youtube',math:'open_math',story:'open_story',music:'play_music',game:'open_game'};
    window.BeybooScreen.run({action:actions[action],...(['youtube','music'].includes(action)?{value:'catalog'}:{}),...(action==='story'?{value:q('voice-character').value}:{})});sync();
  }));
  q('companion-home').addEventListener('click',home);
  q('app-bottom-home').addEventListener('click',()=>{home();q('experience').scrollIntoView({behavior:'smooth',block:'start'});});
  q('app-bottom-talk').addEventListener('click',speak);
  q('companion-screen-size').addEventListener('click',()=>{large=!large;sync();if(large)q('companion-detail-caption').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});else scene.scrollIntoView({behavior:'instant',block:'start'});});
  q('companion-detail-close').addEventListener('click',()=>q('companion-screen-size').click());
  const dialog=q('companion-dialog'),body=q('companion-dialog-content');
  function showDialog(kind){
    if(kind==='account'){window.BeybooProfile?.open();return;}
    if(kind==='play'){
      q('companion-dialog-title').textContent='Google Play and your BOOZZO';
      q('companion-dialog-label').textContent='GOOGLE PLAY · ANDROID';
      body.innerHTML='<p>Google Play installs apps on compatible Android devices. This BOOZZO web app runs in your browser. Installing Android apps inside it or on an iPhone is unavailable.</p><p>To support Google Play, the future BOOZZO module would need Android, Play Protect certification and licensed Google services. Each app would also need to work on the round screen.</p><p>A parent would sign in with their Google account directly through Google. Keep your Google password with Google.</p><a class="button primary" href="https://play.google.com/store" target="_blank" rel="noopener noreferrer">Open Google Play ↗</a><p class="app-dialog-note">This link opens the official Google Play store in a new tab.</p>';
    }else{
      q('companion-dialog-title').textContent='Add BOOZZO to your Home Screen';
      q('companion-dialog-label').textContent='YOUR WEB APP';
      const installed=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
      body.innerHTML=installed?'<p>You are already using BOOZZO as an app. Tap its Home Screen icon to return to your companion and activities.</p>':'<p>Add a BOOZZO icon to your phone to open your companion in one tap.</p><div class="app-install-step"><b>On iPhone</b><p>Open BOOZZO in Safari. Tap Share, then Add to Home Screen. Turn on Open as Web App and tap Add.</p></div><div class="app-install-step"><b>On Android</b><p>Open BOOZZO in Chrome. In the menu, choose Install and create shortcut, then Install. The wording may vary by device.</p></div>'+(installPrompt?'<button type="button" class="button primary" id="app-install-now">Install BOOZZO</button>':'')+'<p class="app-dialog-note">Connect to the internet for voice conversations, videos and calls. Your phone opens BOOZZO as a web app.</p>';
      q('app-install-now')?.addEventListener('click',async()=>{const prompt=installPrompt;if(!prompt)return;await prompt.prompt();await prompt.userChoice;installPrompt=null;dialog.close();});
    }
    if(!dialog.open)dialog.showModal();
  }
  document.querySelectorAll('[data-app-dialog]').forEach(button=>button.addEventListener('click',()=>showDialog(button.dataset.appDialog)));
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
  window.addEventListener('appinstalled',()=>{installPrompt=null;});
  if(appMode){document.title='BOOZZO — My companion';document.querySelector('.companion-portrait').setAttribute('loading','eager');q('voice-sign-in').href='/signin-with-chatgpt?return_to=%2Findex-en.html%3Fapp%3D1';if('serviceWorker' in navigator)navigator.serviceWorker.register('/app-worker.js').catch(()=>{});}
  if(appMode)ensureVoice();sync();
})();
