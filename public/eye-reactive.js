/* Independent digital iris on a fixed pearly sclera. The plush and bezel never move. */
(() => {
  const eye=document.getElementById('living-eye'),card=document.querySelector('.experience-card');
  if(!eye||!card)return;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let context=null,frame=null,mounted=false,phase='idle',muted=false;
  let mic=null,output=null,level=0,previewStart=null,previousTime=null,clock=0;
  // Observe / settle / return, rather than continuously orbiting like a loading indicator.
  const resting=[[0,0,0,1],[2250,0,0,1],[2750,3.8,-.6,.99],[4050,3.8,-.6,.99],[4700,-2.8,.8,.99],[5900,-2.8,.8,.99],[6650,0,0,1],[8500,0,0,1]];
  // Ten-second interpretation of the reference: look right / white crescent left / return.
  const reference=[[0,0,0,1],[550,1,-.3,1],[1350,8,-.5,.97],[2400,11.5,0,.95],[3100,11.5,0,.95],[3650,4,.5,.98],[4400,0,0,1],[5150,-3,1,.98],[6000,-3,.5,.98],[6750,2,-1,1],[7550,0,0,1],[8350,-2.5,0,.99],[9300,0,0,1],[10000,0,0,1]];
  function sample(points,time){
    const end=points.at(-1);if(time>=end[0])return end.slice(1);
    const index=points.findIndex(p=>p[0]>time),a=points[Math.max(0,index-1)],b=points[Math.max(1,index)];
    const t=Math.max(0,Math.min(1,(time-a[0])/(b[0]-a[0]))),s=t*t*(3-2*t);
    return a.slice(1).map((value,i)=>value+(b[i+1]-value)*s);
  }
  function render(x=0,y=0,scale=1){
    card.style.setProperty('--voice-x',`${x.toFixed(3)}%`);
    card.style.setProperty('--voice-y',`${y.toFixed(3)}%`);
    card.style.setProperty('--iris-scale',String(scale));
  }
  function previewEvent(message){document.dispatchEvent(new CustomEvent('beyboo-eye-preview',{detail:{active:previewStart!==null,message}}));}
  function stopPreview(message='Le regard est revenu au centre.'){
    const wasActive=previewStart!==null;previewStart=null;clock=0;render();
    if(wasActive)previewEvent(message);
  }
  function prepare(){try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;context||=new Audio();context.resume().catch(()=>{});}catch{}}
  function attach(stream,type){
    prepare();if(!context)return;(type==='mic'?mic:output)?.source.disconnect();
    try{const source=context.createMediaStreamSource(stream),analyser=context.createAnalyser();analyser.fftSize=512;
      source.connect(analyser); // Never route the microphone back to the speakers.
      const meter={source,analyser,data:new Uint8Array(analyser.fftSize)};if(type==='mic')mic=meter;else output=meter;
    }catch{}
  }
  function rms(meter){
    if(!meter)return 0;meter.analyser.getByteTimeDomainData(meter.data);let sum=0;
    for(const n of meter.data)sum+=((n-128)/128)**2;return Math.sqrt(sum/meter.data.length);
  }
  function draw(now){
    if(!mounted)return;
    const delta=previousTime===null?16:Math.min(80,Math.max(0,now-previousTime));previousTime=now;clock+=delta;
    const input=muted?0:Math.min(1,rms(mic)*9),reply=Math.min(1,rms(output)*6);
    eye.dataset.voiceSignal=phase==='speaking'?'reply':input>.035?'user':'quiet';
    const target=phase==='speaking'?Math.max(reply,.12):input;
    level+=(target-level)*(target>level?.55:.18);card.style.setProperty('--voice-level',level.toFixed(3));
    const following=window.BeybooGaze?.isActive()||eye.classList.contains('gaze-active');
    if(following){stopPreview('Le suivi du visage commande maintenant le regard.');render();clock=0;}
    else if(previewStart!==null){
      if(eye.hidden)stopPreview('Animation arrêtée pour afficher ton activité.');
      else{if(previewStart<0)previewStart=now;const elapsed=now-previewStart;render(...sample(reference,elapsed));if(elapsed>=10000)stopPreview('Animation terminée · retrouve le même effet pendant le suivi du visage.');}
    }else if(reduce||eye.hidden||phase==='error'||phase==='connecting')render();
    else{const [x,y,scale]=sample(resting,clock%8500),attention=phase==='speaking'?.65:phase==='listening'?.5:1;render(x*attention,y*attention,scale);}
    frame=requestAnimationFrame(draw);
  }
  function enter(){if(mounted)return;mounted=true;previousTime=null;eye.classList.add('voice-reactive');frame=requestAnimationFrame(draw);}
  function release(){
    mic?.source.disconnect();output?.source.disconnect();mic=output=null;
    if(context)context.close().catch(()=>{});context=null;level=0;muted=false;card.style.setProperty('--voice-level','0');
  }
  function leave(){mounted=false;cancelAnimationFrame(frame);previousTime=null;stopPreview();release();render();eye.classList.remove('voice-reactive');delete eye.dataset.voiceSignal;}
  window.BeybooEye={
    enter,prepare,attach,release,leave,
    phase(value){phase=value;if(['connecting','listening','speaking'].includes(value))stopPreview('Animation arrêtée pour la conversation.');},
    mute(value){muted=value;},
    preview(){
      if(previewStart!==null){stopPreview('Animation arrêtée.');return false;}
      if(window.BeybooGaze?.isActive()||window.BeybooVoice?.isActive())return false;
      enter();previewStart=-1;previewEvent('Animation du regard · 10 secondes, sans micro ni caméra.');return true;
    },
    stopPreview,isPreview:()=>previewStart!==null
  };
  document.addEventListener('visibilitychange',()=>{if(document.hidden)leave();else if(!eye.hidden)enter();});
  window.addEventListener('pagehide',leave);
})();
