/* Camera pixels and face locations stay on this device. No identity templates or uploads. */
(() => {
  'use strict';
  const q = id => document.getElementById(id);
  const panel = q('camera-panel');
  if (!panel) return;
  let mounted=false, stream=null, detector=null, timer=null, generation=0;
  let facing='user', mode='photo', busy=false, photoURL=null, modelLoading=false, lastVideoTime=-1;
  let detectFaces=false, faceCount=null, cameraState='idle';
  const analysisCanvas=document.createElement('canvas');
  const disposeStream=s=>s?.getTracks().forEach(track=>track.stop());
  const status=text=>{
    q('camera-status').textContent=text;
    // Publish operational status only. Face locations, counts and pixels stay local.
    document.dispatchEvent(new CustomEvent('beyboo-camera-state',{detail:{camera:cameraState,photo:!!photoURL,description:text}}));
  };
  const faceStatus=text=>{q('camera-face-status').textContent=text;};
  function state(){return {camera:cameraState,faceDetection:detectFaces,faces:faceCount,photo:!!photoURL,identityRecognition:false};}
  function controls(){
    q('camera-start').hidden=!!stream||busy;
    if(q('camera-eye-start')){q('camera-eye-start').disabled=busy;q('camera-eye-start').textContent=busy?'Waiting for permission…':'Turn on camera';}
    q('camera-start').textContent=photoURL?'Take another photo':'Turn on camera';
    q('camera-stop').hidden=!stream&&!busy;
    q('camera-stop').textContent=busy?'Cancel':'Turn off camera';
    q('camera-switch').hidden=!stream; q('camera-capture').hidden=!!photoURL;
    q('camera-capture').disabled=!stream||busy;
    q('camera-photo-actions').hidden=!photoURL;
    q('camera-detect').checked=detectFaces;
    q('camera-mode-photo').setAttribute('aria-pressed',String(mode==='photo'));
    q('camera-mode-follow').setAttribute('aria-pressed',String(mode==='follow'));
    const stage=q('camera-view');
    q('camera-preview')?.setAttribute('aria-hidden',String(!stream));
    if(stage){stage.dataset.mode=mode;stage.dataset.mirrored=String(facing==='user');stage.dataset.active=String(!!stream);}
  }
  function clearFace(){
    faceCount=null;
    if(q('camera-face-box'))q('camera-face-box').hidden=true;
    q('camera-view')?.style.setProperty('--face-x','0%');
    q('camera-view')?.style.setProperty('--face-y','0%');
  }
  function release(){
    generation++; clearTimeout(timer);timer=null;busy=false;modelLoading=false;
    const old=stream;stream=null;disposeStream(old);
    const video=q('camera-preview');if(video){video.pause();video.srcObject=null;}
    detector?.close();detector=null;lastVideoTime=-1;analysisCanvas.width=analysisCanvas.height=0;clearFace();
  }
  function forgetPhoto(){
    if(photoURL)URL.revokeObjectURL(photoURL);photoURL=null;
    const image=q('camera-shot');if(image){image.hidden=true;image.removeAttribute('src');}
    q('camera-download').removeAttribute('href');
  }
  function stop(message='Camera off. You can turn it on whenever you like.'){
    release();cameraState=photoURL?'photo':'stopped';
    if(mounted){status(message);faceStatus('Face detection stopped.');controls();q('camera-placeholder').hidden=!!photoURL;}
  }
  function leave(){stop();forgetPhoto();mounted=false;panel.hidden=true;cameraState='idle';}
  function markup(){return '<div id="camera-view" class="camera-view" data-mode="photo" data-active="false"><video id="camera-preview" playsinline autoplay muted aria-label="Live camera view inside the eye"></video><div id="camera-follow-eye" class="camera-follow-eye" aria-hidden="true"><span class="voice-iris-window"><span class="voice-iris-motion"><svg class="voice-iris-texture" viewBox="478 797 216 187" preserveAspectRatio="none" aria-hidden="true"><image href="assets/app/companion-blue-cap.jpg" width="1152" height="1728"/></svg><span class="voice-pupil"></span></span></span></div><div id="camera-face-box" class="camera-face-box" hidden></div><div id="camera-placeholder" class="voice-screen-copy"><span class="screen-label">THE WORLD IN MY EYE</span><svg class="camera-placeholder-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M7 14h9l4-6h8l4 6h9v25H7z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="24" cy="26" r="8" stroke="currentColor" stroke-width="2"/></svg><h4>Give me a smile?</h4><p>Your photos stay on your device.</p><button type="button" id="camera-eye-start">Turn on camera</button></div><img id="camera-shot" class="camera-shot" alt="Your photo in BOOZZO’s eye" hidden></div>';}
  function open(initial='photo'){
    window.BeybooCompanionChoice?.syncEyeTexture();
    mounted=true;mode=initial==='follow'?'follow':'photo';detectFaces=mode==='follow';cameraState='ready';panel.hidden=false;
    status(mode==='follow'?'Turn on the camera to let the eye follow your face.':'Turn on the camera to see yourself in the eye and take a photo.');
    faceStatus('Face detection runs on your device and finds faces without identifying anyone.');q('camera-eye-start').addEventListener('click',start);controls();
  }
  function showFaces(results,video){
    const faces=results.detections||[];faceCount=faces.length;
    const box=q('camera-face-box');
    if(!faces.length){clearFace();faceCount=0;faceStatus('No face in view yet. Look towards the camera.');return;}
    const face=faces.slice().sort((a,b)=>b.boundingBox.width*b.boundingBox.height-a.boundingBox.width*a.boundingBox.height)[0].boundingBox;
    const w=analysisCanvas.width,h=analysisCanvas.height;
    let x=(face.originX+face.width/2)/w,y=(face.originY+face.height/2)/h;
    if(facing==='user')x=1-x;
    q('camera-view').style.setProperty('--face-x',`${Math.max(-1,Math.min(1,(x-.5)*2))*6}%`);
    q('camera-view').style.setProperty('--face-y',`${Math.max(-1,Math.min(1,(y-.5)*2))*6}%`);
    // Match object-fit:cover's square crop, including the front-camera mirror.
    const side=Math.min(w,h),cropX=(w-side)/2,cropY=(h-side)/2;
    let left=(face.originX-cropX)/side,top=(face.originY-cropY)/side,bw=face.width/side,bh=face.height/side;
    if(facing==='user')left=1-left-bw;
    box.hidden=false;box.style.left=`${left*100}%`;box.style.top=`${top*100}%`;box.style.width=`${bw*100}%`;box.style.height=`${bh*100}%`;
    faceStatus(faces.length===1?(mode==='follow'?'One face in view · the eye is following it.':'One face in view · framed for your photo.'):`${faces.length} faces in view · following the closest one.`);
  }
  async function loadDetector(token){
    if(modelLoading||detector||!detectFaces||!stream)return;
    modelLoading=true;faceStatus('Getting face detection ready on your device…');
    let next=null;
    try{
      next=await window.BeybooFaceDetector.create();
      if(token!==generation||!detectFaces){next.close();return;}
      detector=next;faceStatus('Face detection is ready. Look towards the camera.');
    }catch{
      next?.close();if(token!==generation)return;
      detectFaces=false;mode='photo';clearFace();controls();
      faceStatus('Face detection is unavailable in this browser. You can still take photos.');
    }finally{if(token===generation)modelLoading=false;}
  }
  async function tick(token){
    if(token!==generation||!stream||!mounted)return;
    const video=q('camera-preview');
    if(detectFaces&&detector&&video.readyState>=2&&video.currentTime!==lastVideoTime){
      lastVideoTime=video.currentTime;
      const activeDetector=detector;
      const ratio=video.videoHeight/video.videoWidth;
      analysisCanvas.width=320;analysisCanvas.height=Math.max(1,Math.round(320*ratio));
      try{analysisCanvas.getContext('2d').drawImage(video,0,0,analysisCanvas.width,analysisCanvas.height);const result=await activeDetector.detectForVideo(analysisCanvas);if(token!==generation||!stream)return;if(detectFaces&&detector===activeDetector)showFaces(result,video);}
      catch{if(token!==generation)return;if(detector===activeDetector){detector?.close();detector=null;detectFaces=false;mode='photo';clearFace();faceStatus('Tracking stopped. You can keep taking photos.');controls();}}
    }
    if(token===generation&&stream)timer=setTimeout(()=>tick(token),200);
  }
  async function start(){
    if(window.BeybooFamily && !window.BeybooFamily.guard('camera'))return false;
    if(!mounted||busy)return;
    window.BeybooGaze?.stop('Tracking stopped so you can take a photo.');
    release();forgetPhoto();
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){cameraState='error';status('Open the secure BOOZZO site in Safari or Chrome to use the camera.');controls();return;}
    const token=generation;busy=true;cameraState='requesting';controls();status('Allow camera access when your browser asks.');
    try{
      const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:720},height:{ideal:720}}});
      if(token!==generation||!mounted){disposeStream(next);return;}
      stream=next;const video=q('camera-preview');video.muted=true;video.srcObject=next;
      const setting=next.getVideoTracks()[0]?.getSettings?.().facingMode;
      if(setting==='user'||setting==='environment')facing=setting;
      next.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(stream===next)stop('The camera stopped. Tap “Turn on camera” to try again.');}));
      await video.play();if(token!==generation)return;
      busy=false;cameraState='live';q('camera-placeholder').hidden=true;controls();status('Live camera · video recording is off.');
      if(detectFaces)loadDetector(token);else faceStatus('Face detection is off. You can turn it on below.');
      tick(token);window.BeybooCompanion?.refresh({reveal:true});
    }catch(error){
      if(token!==generation)return;
      release();cameraState='error';controls();q('camera-placeholder').hidden=false;
      status(error?.name==='NotAllowedError'?'Camera access is blocked. Allow it in the site settings and try again.':error?.name==='NotFoundError'?'This device has no available camera.':'Couldn’t open the camera. Close any other apps using it and try again.');
    }
  }
  function showPhoto(blob){
    release();forgetPhoto();photoURL=URL.createObjectURL(blob);q('camera-shot').src=photoURL;q('camera-shot').hidden=false;
    q('camera-placeholder').hidden=true;q('camera-download').href=photoURL;cameraState='photo';controls();
  }
  async function capture(){
    const video=q('camera-preview');
    if(!stream||!video||video.readyState<2||!video.videoWidth){status('Turn on the camera and wait for the live image.');return {ok:false,description:'Tap to turn on the camera before taking a photo.'};}
    const token=generation,canvas=document.createElement('canvas');canvas.width=canvas.height=768;
    const ctx=canvas.getContext('2d'),side=Math.min(video.videoWidth,video.videoHeight);
    ctx.beginPath();ctx.arc(384,384,384,0,Math.PI*2);ctx.clip();
    if(facing==='user'){ctx.translate(768,0);ctx.scale(-1,1);}
    ctx.drawImage(video,(video.videoWidth-side)/2,(video.videoHeight-side)/2,side,side,0,0,768,768);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(token!==generation||!mounted)return {ok:false,cancelled:true};
    if(!blob){status('Couldn’t take the photo. Please try again.');return {ok:false,description:'The photo couldn’t be taken.'};}
    showPhoto(blob);
    status('Your photo is in the eye. Save it or delete it.');faceStatus('Camera and face detection are off now.');window.BeybooCompanion?.refresh({reveal:true});
    return {ok:true,description:'Your photo is in the eye. The camera is off. Nothing was sent or saved automatically.'};
  }
  function setMode(next){mode=next;if(next==='follow')detectFaces=true;controls();if(stream&&detectFaces)loadDetector(generation);}
  q('camera-import').addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';
    if(!file||!mounted)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024){
      status('Choose a JPEG, PNG or WebP photo under 12 MB.');return;
    }
    release();const token=generation,src=URL.createObjectURL(file),image=new Image();
    try{
      image.src=src;await image.decode();
      if(token!==generation||!mounted)return;
      const canvas=document.createElement('canvas');canvas.width=canvas.height=768;
      const ctx=canvas.getContext('2d'),side=Math.min(image.naturalWidth,image.naturalHeight);
      ctx.beginPath();ctx.arc(384,384,384,0,Math.PI*2);ctx.clip();
      ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,768,768);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if(token!==generation||!mounted)return;
      if(!blob)throw Error();
      showPhoto(blob);status('Your photo is in the eye and stays on your device.');faceStatus('');
    }catch{if(token===generation&&mounted){stop('This photo could not be read. Choose another file.');}}
    finally{URL.revokeObjectURL(src);}
  });
  q('camera-start').addEventListener('click',start);
  q('camera-stop').addEventListener('click',()=>stop());
  q('camera-switch').addEventListener('click',()=>{facing=facing==='user'?'environment':'user';start();});
  q('camera-capture').addEventListener('click',capture);
  q('camera-delete').addEventListener('click',()=>{forgetPhoto();cameraState='ready';q('camera-placeholder').hidden=false;status('Photo deleted. You can turn the camera on again.');controls();});
  q('camera-mode-photo').addEventListener('click',()=>setMode('photo'));
  q('camera-mode-follow').addEventListener('click',()=>setMode('follow'));
  q('camera-detect').addEventListener('change',()=>{detectFaces=q('camera-detect').checked;if(!detectFaces){mode='photo';detector?.close();detector=null;clearFace();faceStatus('Face detection is off.');}else if(stream)loadDetector(generation);controls();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&mounted)stop('The camera turned off when you left the app.');});
  window.addEventListener('pagehide',leave);
  window.BeybooCamera={markup,open,leave,capture,state,publicState:()=>({camera:cameraState,photo:!!photoURL})};
})();
