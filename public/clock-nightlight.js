/* The clock and the bedside lamp share the single display in the plush. */
(() => {
  'use strict';
  const chip = document.getElementById('eye-time-shortcut');
  if (!chip) return;
  const dock = document.getElementById('plush-eye-dock');
  const en = document.documentElement.lang === 'en';
  const t = (fr, english) => en ? english : fr;
  const locale = en ? 'en-GB' : 'fr-FR';
  const time = new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const calendar = new Intl.DateTimeFormat(locale,{weekday:'long',day:'numeric',month:'long'});
  const presets = [15*60,30*60,60*60,0];
  let mode = '', screen, panel, notify, revision = 0;
  let testing = false, lit = false, brightness = 40, duration = presets[0], deadline = null, expired = false;
  let tick, wakeLock, wakeRequest = 0, requesting = false;

  function text(el, value) {
    if (el && el.textContent !== value) el.textContent = value;
  }
  function releaseWake() {
    ++wakeRequest;
    requesting = false;
    const lock = wakeLock;
    wakeLock = null;
    if (lock) lock.release().catch(()=>{});
  }
  async function keepAwake() {
    if (!lit || document.hidden || wakeLock || requesting || !navigator.wakeLock) return;
    const token = ++wakeRequest;
    requesting = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (token !== wakeRequest || !lit || document.hidden) { await lock.release(); return; }
      wakeLock = lock;
      lock.addEventListener('release',()=>{if (wakeLock===lock) wakeLock=null;});
    } catch { /* The screen still works while the device is awake. */ }
    finally { if (token===wakeRequest) requesting=false; }
  }
  function message() {
    if (mode==='clock') return t('Horloge de ton appareil.','Your device’s local clock.');
    if (lit) return t('La veilleuse est allumée.','The night light is on.');
    return expired ? t('La minuterie a éteint la veilleuse.','The timer turned the night light off.')
      : t('La veilleuse est éteinte.','The night light is off.');
  }
  function turn(on, seconds=duration) {
    if (mode!=='nightlight') return;
    testing=on && seconds===10;
    if (on && presets.includes(seconds)) duration=seconds;
    lit=on; expired=false;
    deadline = on && seconds ? Date.now()+seconds*1000 : null;
    if (lit) keepAwake(); else releaseWake();
    update();
    notify?.(message());
  }
  function countdown(now) {
    if (!lit) return message();
    if (!deadline) return t('Allumée jusqu’à ton prochain toucher.','On until you switch it off.');
    const seconds = Math.ceil((deadline-now)/1000);
    if (seconds<=60) return t('Extinction dans ','Turns off in ')+seconds+' s';
    return t('Extinction à ','Turns off at ')+time.format(deadline);
  }
  function update() {
    clearTimeout(tick);
    if (document.hidden) return;
    const now = Date.now(), date = new Date(now), hhmm = time.format(date);
    text(chip.querySelector('time'),hhmm);
    if (mode==='clock') {
      const hours=date.getHours()%12, minutes=date.getMinutes(), seconds=date.getSeconds();
      screen.querySelector('.hand-hour').setAttribute('transform','rotate('+(30*hours+minutes/2)+' 100 100)');
      screen.querySelector('.hand-minute').setAttribute('transform','rotate('+(6*minutes+seconds/10)+' 100 100)');
      screen.querySelector('.hand-second').setAttribute('transform','rotate('+(6*seconds)+' 100 100)');
      text(screen.querySelector('time'),hhmm);
      text(panel?.querySelector('.bedside-time'),hhmm);
      text(panel?.querySelector('.bedside-date'),calendar.format(date));
    }
    if (mode==='nightlight') {
      if (lit && deadline && now>=deadline) {
        lit=false; expired=true; deadline=null; releaseWake(); notify?.(message());
      }
      const lamp=screen.querySelector('.night-lamp');
      lamp.dataset.on=String(lit);
      const level=brightness/100;
      lamp.style.setProperty('--lamp-level',String(level));
      dock.style.setProperty('--lamp-halo',String(lit ? level : 0));
      dock.classList.toggle('night-glow',lit);
      text(lamp.querySelector('time'),lit ? hhmm : '');
      lamp.setAttribute('aria-label',lit?t('Éteindre la veilleuse dans l’œil','Switch off the night light in the eye'):t('Rallumer la veilleuse dans l’œil','Turn the night light back on in the eye'));
      text(panel?.querySelector('.lamp-toggle'),lit?t('Éteindre','Switch off'):t('Rallumer','Switch on'));
      text(panel?.querySelector('output'),brightness+' %');
      text(panel?.querySelector('.lamp-countdown'),countdown(now));
      for (const button of panel?.querySelectorAll('[data-seconds]')||[]) {
        const seconds=Number(button.dataset.seconds);
        button.setAttribute('aria-pressed',String(lit && seconds===duration && !testing));
      }
    }
    const interval=mode==='clock'||(lit && deadline && deadline-now<=60000)?1000:60000;
    let delay=interval-now%interval;
    if (lit && deadline) delay=Math.min(delay,deadline-now);
    tick=setTimeout(update,Math.max(1,delay));
  }
  function reset() {
    if (!mode) return;
    lit=false; expired=false; testing=false; deadline=null; mode='';
    screen=null; panel=null; notify=null;
    dock.classList.remove('night-glow');
    dock.style.removeProperty('--lamp-halo');
    releaseWake(); update();
  }
  function dial() {
    let marks='';
    for (let i=0;i<60;i++) {
      const big=i%5===0;
      marks+='<path d="M100 9v'+(big?9:3)+'" transform="rotate('+i*6+' 100 100)" class="'+(big?'major':'minor')+'"/>';
    }
    return '<div class="bedside-dial"><svg viewBox="0 0 200 200" aria-hidden="true">'+marks+
      '<g class="dial-letters"><text x="100" y="35">12</text><text x="170" y="105">3</text><text x="30" y="105">9</text></g>'+
      '<path class="hand-hour" d="M100 100V60"/><path class="hand-minute" d="M100 100V41"/><path class="hand-second" d="M100 111V26"/><circle cx="100" cy="100" r="4" fill="#f9c990"/></svg><time></time></div>';
  }
  function mount(stage,type,say) {
    mode=type; screen=stage; notify=say;
    stage.dataset.bedsideRevision=String(++revision);
    if (type==='clock') {
      screen.innerHTML=dial(); update(); say(message());
    } else {
      screen.innerHTML='<button type="button" class="night-lamp" data-on="false"><span class="lamp-light" aria-hidden="true"></span><time></time></button>';
      screen.querySelector('.night-lamp').addEventListener('click',()=>lit?turn(false):turn(true,duration));
      turn(true,duration);
    }
  }
  function controls(root) {
    panel=root;
    if (mode==='clock') {
      root.innerHTML='<div class="bedside-controls"><h4>'+t('Horloge','Clock')+'</h4><time class="bedside-time"></time><p class="bedside-date"></p><button type="button" class="lamp-open">'+t('Allumer la veilleuse','Turn on the night light')+'</button></div>';
      root.querySelector('.lamp-open').onclick=()=>window.BeybooScreen.run({action:'set_nightlight',value:'on'});
    } else {
      root.innerHTML='<div class="bedside-controls"><h4>'+t('Veilleuse','Night light')+'</h4><p class="bedside-sub">'+t('Une lumière ambrée dans l’œil de ton compagnon.','A warm amber light in your companion’s eye.')+'</p>'+
        '<label class="lamp-label" for="lamp-level">'+t('Luminosité','Brightness')+' <output for="lamp-level"></output></label><input id="lamp-level" type="range" min="5" max="100" step="5" value="'+brightness+'">'+
        '<fieldset class="lamp-timer"><legend>'+t('Extinction automatique','Sleep timer')+'</legend>'+presets.map(sec=>'<button type="button" data-seconds="'+sec+'">'+(sec?sec/60+' min':t('Sans limite','No timer'))+'</button>').join('')+'</fieldset>'+
        '<div class="lamp-actions"><button type="button" class="lamp-toggle"></button><button type="button" class="lamp-test">'+t('Tester 10 secondes','Try for 10 seconds')+'</button></div><p class="lamp-countdown"></p><p class="lamp-foot">'+t('Garde la démo ouverte et le téléphone déverrouillé.','Keep the demo open and the phone unlocked.')+'</p></div>';
      root.querySelector('#lamp-level').oninput=e=>{brightness=Number(e.target.value);update();};
      root.querySelector('.lamp-toggle').onclick=()=>lit?turn(false):turn(true,duration);
      root.querySelector('.lamp-test').onclick=()=>turn(true,10);
      root.querySelectorAll('[data-seconds]').forEach(b=>b.onclick=()=>turn(true,Number(b.dataset.seconds)));
    }
    update();
  }
  function state() {
    const localTime=time.format(Date.now());
    return mode==='nightlight'?{localTime,light:lit?'on':'off',brightness,remainingSeconds:deadline?Math.max(0,Math.ceil((deadline-Date.now())/1000)):null}:{localTime};
  }
  function launch(type) {
    if(!window.BeybooVoice.isMounted())showMode('assistant');
    window.BeybooScreen.run(type==='clock'?{action:'open_clock'}:{action:'set_nightlight',value:'on'});
  }
  window.BeybooBedside={mount,controls,reset,state,turn,isOpen:()=>!!mode,message};
  chip.addEventListener('click',()=>launch('clock'));
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){clearTimeout(tick);releaseWake();}
    else {update();if(lit)keepAwake();}
  });
  window.addEventListener('pagehide',()=>{reset();clearTimeout(tick);});
  window.addEventListener('pageshow',update);
  update();
  const query=new URLSearchParams(location.search);
  if(query.get('app')==='1'&&['horloge','veilleuse'].includes(query.get('outil')))launch(query.get('outil')==='horloge'?'clock':'nightlight');
})();
