/* Local face position only. No identity recognition, recording or network upload. */
(() => {
  'use strict';
  const eye=document.getElementById('living-eye');
  if(!eye)return;
  const video=document.createElement('video'),canvas=document.createElement('canvas');
  video.className='gaze-capture-surface';video.muted=true;video.playsInline=true;
  video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');video.tabIndex=-1;
  let generation=0,enabled=false,stream=null,detector=null,timer=null,frame=null;
  let state='off',message='',mirrored=true,lastVideoTime=-1,lastSeen=0,lastFrame=0;
  let lock=null,neutral=null,target={x:0,y:0},position={x:0,y:0};
  const LOST_AFTER=1100,REACQUIRE_AFTER=1800;
  const clamp=(value,limit=1)=>Math.max(-limit,Math.min(limit,value));
  const disposeStream=value=>value?.getTracks().forEach(track=>track.stop());
  function announce(next,text){
    if(state===next&&message===text)return;
    state=next;message=text;eye.dataset.gazeState=state;
    // Operational messages only; face coordinates never leave this closure.
    document.dispatchEvent(new CustomEvent('beyboo-gaze-state',{detail:{state,message}}));
  }
  function render(x=0,y=0){
    eye.style.setProperty('--gaze-x',`${x.toFixed(3)}%`);
    eye.style.setProperty('--gaze-y',`${y.toFixed(3)}%`);
  }
  function release(){
    generation++;enabled=false;clearTimeout(timer);cancelAnimationFrame(frame);timer=frame=null;
    const old=stream;stream=null;disposeStream(old);video.pause();video.srcObject=null;video.remove();
    detector?.close();detector=null;canvas.width=canvas.height=0;lastVideoTime=-1;lastSeen=lastFrame=0;
    lock=neutral=null;target={x:0,y:0};position={x:0,y:0};eye.classList.remove('gaze-active');render();
  }
  function stop(text='Tracking stopped · camera off.'){
    release();announce('off',text);
  }
  function loseFace(now){
    if(!lock||now-lastSeen<=LOST_AFTER)return;
    target={x:0,y:0};announce('searching','Your face is out of view. Look towards the camera again.');
    if(now-lastSeen>REACQUIRE_AFTER){lock=neutral=null;}
  }
  function animate(now){
    if(!enabled||!stream)return;
    loseFace(now);
    const delta=lastFrame?Math.min(100,now-lastFrame):16;lastFrame=now;
    const alpha=1-Math.exp(-delta/110);
    position.x+=(target.x-position.x)*alpha;position.y+=(target.y-position.y)*alpha;
    if(Math.abs(position.x)<.003)position.x=0;if(Math.abs(position.y)<.003)position.y=0;
    // Video activities keep the explicit camera session, but never move another screen.
    const hidden=eye.hidden||!!eye.closest('[hidden]')||eye.getClientRects().length===0;
    render(hidden?0:position.x,hidden?0:position.y);
    frame=requestAnimationFrame(animate);
  }
  function facesFrom(result){
    return (result?.detections||[]).map(item=>{
      const b=item.boundingBox;
      if(!b||![b.originX,b.originY,b.width,b.height].every(Number.isFinite)||b.width<=0||b.height<=0)return null;
      const rawX=(b.originX+b.width/2)/canvas.width,y=(b.originY+b.height/2)/canvas.height;
      if(rawX<0||rawX>1||y<0||y>1)return null;
      return {x:mirrored?1-rawX:rawX,y,area:b.width*b.height/(canvas.width*canvas.height)};
    }).filter(Boolean);
  }
  function follow(result,now){
    loseFace(now);
    const faces=facesFrom(result);
    let next=null;
    if(lock){
      // Spatial continuity, not identity: a larger second face cannot steal the gaze.
      const candidates=faces.map(face=>({face,distance:Math.hypot(face.x-lock.x,face.y-lock.y)}))
        .filter(({face,distance})=>distance<.33&&face.area/lock.area>.35&&face.area/lock.area<2.8)
        .sort((a,b)=>a.distance-b.distance);
      next=candidates[0]?.face||null;
    }else next=faces.sort((a,b)=>b.area-a.area)[0]||null;
    if(!next)return;
    if(!neutral)neutral={x:next.x,y:next.y};
    lock=next;lastSeen=now;
    target={x:clamp((next.x-neutral.x)*3)*7,y:clamp((next.y-neutral.y)*3)*5.5};
    announce('tracking','There you are! Move your head slowly and my eye will follow.');
  }
  async function tick(token){
    if(token!==generation||!enabled||!stream||!detector)return;
    if(video.readyState>=2&&video.videoWidth&&video.videoHeight&&video.currentTime!==lastVideoTime){
      lastVideoTime=video.currentTime;
      canvas.width=320;canvas.height=Math.max(1,Math.round(320*video.videoHeight/video.videoWidth));
      try{
        canvas.getContext('2d',{willReadFrequently:true}).drawImage(video,0,0,canvas.width,canvas.height);
        const result=await detector.detectForVideo(canvas);
        if(token!==generation||!enabled)return;
        follow(result,performance.now());
      }catch{
        if(token!==generation)return;
        release();announce('error','Tracking is unavailable. The camera is off. You can try again.');return;
      }
    }
    if(token===generation&&enabled)timer=setTimeout(()=>tick(token),80);
  }
  async function start(){
    if(window.BeybooFamily && !window.BeybooFamily.guard('camera'))return false;
    if(enabled)return;
    release();window.BeybooCamera?.leave();
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
      announce('error','Open the secure BEYBOO site in Safari or Chrome to turn on tracking.');return;
    }
    if(document.hidden){announce('off','Bring BEYBOO back into view to turn on tracking.');return;}
    const token=generation;enabled=true;
    announce('requesting','Allow camera access so my eye can follow you.');
    let pendingDetector=null;
    try{
      const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'user'},width:{ideal:640},height:{ideal:480},frameRate:{ideal:15,max:24}}});
      if(token!==generation||!enabled){disposeStream(next);return;}
      stream=next;mirrored=next.getVideoTracks()[0]?.getSettings?.().facingMode!=='environment';
      next.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{
        if(stream===next)stop('The camera stopped. You can turn tracking on again.');
      }));
      document.body.appendChild(video);video.srcObject=next;await video.play();
      if(token!==generation||!enabled)return;
      announce('loading','Getting eye tracking ready on your device…');
      pendingDetector=await window.BeybooFaceDetector.create();
      if(token!==generation||!enabled){pendingDetector.close();return;}
      detector=pendingDetector;eye.classList.add('gaze-active');
      announce('searching','Look towards the camera so my eye can find you.');
      frame=requestAnimationFrame(animate);tick(token);
    }catch(error){
      if(token!==generation){pendingDetector?.close();return;}
      release();
      announce('error',error?.name==='NotAllowedError'?'Camera access is blocked. Allow it in the site settings and try again.':error?.name==='NotFoundError'?'This device has no available camera.':'Couldn’t start tracking. The camera is off. Close other apps using it and try again.');
    }
  }
  function recenter(){
    if(!enabled||!lock||performance.now()-lastSeen>LOST_AFTER)return false;
    neutral={x:lock.x,y:lock.y};target={x:0,y:0};return true;
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&enabled)stop('Tracking stopped when you left the app. The camera is off.');});
  window.addEventListener('pagehide',()=>{if(enabled)stop();});
  window.BeybooGaze={start,stop,recenter,isActive:()=>enabled};
})();
