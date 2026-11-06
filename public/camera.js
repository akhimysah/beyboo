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
    if(q('camera-eye-start')){q('camera-eye-start').disabled=busy;q('camera-eye-start').textContent=busy?'Autorisation…':'Activer la caméra';}
    q('camera-start').textContent=photoURL?'Reprendre une photo':'Activer la caméra';
    q('camera-stop').hidden=!stream&&!busy;
    q('camera-stop').textContent=busy?'Annuler':'Couper la caméra';
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
  function stop(message='Caméra coupée. Tu peux la réactiver quand tu veux.'){
    release();cameraState=photoURL?'photo':'stopped';
    if(mounted){status(message);faceStatus('Détection arrêtée.');controls();q('camera-placeholder').hidden=!!photoURL;}
  }
  function leave(){stop();forgetPhoto();mounted=false;panel.hidden=true;cameraState='idle';}
  function markup(){return '<div id="camera-view" class="camera-view" data-mode="photo" data-active="false"><video id="camera-preview" playsinline autoplay muted aria-label="Caméra en direct dans l’œil"></video><div id="camera-follow-eye" class="camera-follow-eye" aria-hidden="true"><span class="voice-iris-window"><span class="voice-iris-motion"><svg class="voice-iris-texture" viewBox="478 797 216 187" preserveAspectRatio="none" aria-hidden="true"><image href="assets/app/companion-blue-cap.jpg" width="1152" height="1728"/></svg><span class="voice-pupil"></span></span></span></div><div id="camera-face-box" class="camera-face-box" hidden></div><div id="camera-placeholder" class="voice-screen-copy"><span class="screen-label">LE MONDE DANS MON ŒIL</span><svg class="camera-placeholder-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M7 14h9l4-6h8l4 6h9v25H7z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="24" cy="26" r="8" stroke="currentColor" stroke-width="2"/></svg><h4>Un sourire ?</h4><p>Tout reste sur ton appareil.</p><button type="button" id="camera-eye-start">Activer la caméra</button></div><img id="camera-shot" class="camera-shot" alt="Ta photo dans l’œil BOOZZO" hidden></div>';}
  function open(initial='photo'){
    window.BeybooCompanionChoice?.syncEyeTexture();
    mounted=true;mode=initial==='follow'?'follow':'photo';detectFaces=mode==='follow';cameraState='ready';panel.hidden=false;
    status(mode==='follow'?'Active la caméra : le regard pourra suivre ton visage.':'Active la caméra pour te voir dans l’œil et prendre une photo.');
    faceStatus('Détection locale : repère un visage, sans reconnaître son identité.');q('camera-eye-start').addEventListener('click',start);controls();
  }
  function showFaces(results,video){
    const faces=results.detections||[];faceCount=faces.length;
    const box=q('camera-face-box');
    if(!faces.length){clearFace();faceCount=0;faceStatus('Aucun visage détecté. Place-toi face à la caméra.');return;}
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
    faceStatus(faces.length===1?(mode==='follow'?'Un visage détecté · le regard suit sa position.':'Un visage détecté · cadrage repéré.'):`${faces.length} visages détectés · suivi du visage le plus proche.`);
  }
  async function loadDetector(token){
    if(modelLoading||detector||!detectFaces||!stream)return;
    modelLoading=true;faceStatus('Préparation de la détection sur ton appareil…');
    let next=null;
    try{
      next=await window.BeybooFaceDetector.create();
      if(token!==generation||!detectFaces){next.close();return;}
      detector=next;faceStatus('Détection prête. Place-toi face à la caméra.');
    }catch{
      next?.close();if(token!==generation)return;
      detectFaces=false;mode='photo';clearFace();controls();
      faceStatus('Détection indisponible sur ce navigateur. La caméra et les photos restent utilisables.');
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
      catch{if(token!==generation)return;if(detector===activeDetector){detector?.close();detector=null;detectFaces=false;mode='photo';clearFace();faceStatus('Le suivi s’est arrêté. Tu peux continuer à prendre des photos.');controls();}}
    }
    if(token===generation&&stream)timer=setTimeout(()=>tick(token),200);
  }
  async function start(){
    if(window.BeybooFamily && !window.BeybooFamily.guard('camera'))return false;
    if(!mounted||busy)return;
    window.BeybooGaze?.stop('Suivi arrêté pour ouvrir l’appareil photo.');
    release();forgetPhoto();
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){cameraState='error';status('Ouvre l’application BOOZZO en HTTPS dans Safari ou Chrome pour utiliser la caméra.');controls();return;}
    const token=generation;busy=true;cameraState='requesting';controls();status('Autorise la caméra dans la demande de ton navigateur.');
    try{
      const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:720},height:{ideal:720}}});
      if(token!==generation||!mounted){disposeStream(next);return;}
      stream=next;const video=q('camera-preview');video.muted=true;video.srcObject=next;
      const setting=next.getVideoTracks()[0]?.getSettings?.().facingMode;
      if(setting==='user'||setting==='environment')facing=setting;
      next.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(stream===next)stop('La caméra a été interrompue. Touche Activer pour réessayer.');}));
      await video.play();if(token!==generation)return;
      busy=false;cameraState='live';q('camera-placeholder').hidden=true;controls();status('Caméra en direct · aucun enregistrement vidéo.');
      if(detectFaces)loadDetector(token);else faceStatus('Détection désactivée. Tu peux l’activer ci-dessous.');
      tick(token);window.BeybooCompanion?.refresh({reveal:true});
    }catch(error){
      if(token!==generation)return;
      release();cameraState='error';controls();q('camera-placeholder').hidden=false;
      status(error?.name==='NotAllowedError'?'Caméra non autorisée. Autorise-la dans les réglages du site, puis réessaie.':error?.name==='NotFoundError'?'Aucune caméra disponible sur cet appareil.':'Impossible d’ouvrir la caméra. Ferme les autres apps qui l’utilisent, puis réessaie.');
    }
  }
  function showPhoto(blob){
    release();forgetPhoto();photoURL=URL.createObjectURL(blob);q('camera-shot').src=photoURL;q('camera-shot').hidden=false;
    q('camera-placeholder').hidden=true;q('camera-download').href=photoURL;cameraState='photo';controls();
  }
  async function capture(){
    const video=q('camera-preview');
    if(!stream||!video||video.readyState<2||!video.videoWidth){status('Active d’abord la caméra et attends l’image.');return {ok:false,description:'La caméra doit être activée par un toucher avant de prendre une photo.'};}
    const token=generation,canvas=document.createElement('canvas');canvas.width=canvas.height=768;
    const ctx=canvas.getContext('2d'),side=Math.min(video.videoWidth,video.videoHeight);
    ctx.beginPath();ctx.arc(384,384,384,0,Math.PI*2);ctx.clip();
    if(facing==='user'){ctx.translate(768,0);ctx.scale(-1,1);}
    ctx.drawImage(video,(video.videoWidth-side)/2,(video.videoHeight-side)/2,side,side,0,0,768,768);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(token!==generation||!mounted)return {ok:false,cancelled:true};
    if(!blob){status('La photo n’a pas pu être créée. Réessaie.');return {ok:false,description:'Échec de la capture.'};}
    showPhoto(blob);
    status('Photo prête dans l’œil. Enregistre-la ou efface-la.');faceStatus('Caméra et détection coupées après la photo.');window.BeybooCompanion?.refresh({reveal:true});
    return {ok:true,description:'Photo prise et affichée dans l’œil. Caméra coupée. Aucun fichier envoyé ni enregistré automatiquement.'};
  }
  function setMode(next){mode=next;if(next==='follow')detectFaces=true;controls();if(stream&&detectFaces)loadDetector(generation);}
  q('camera-import').addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';
    if(!file||!mounted)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024){
      status('Choisis une photo JPEG, PNG ou WebP de moins de 12 Mo.');return;
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
      showPhoto(blob);status('Ta photo est dans l’œil. Elle reste sur ton appareil.');faceStatus('');
    }catch{if(token===generation&&mounted){stop('Cette photo ne peut pas être lue. Choisis un autre fichier.');}}
    finally{URL.revokeObjectURL(src);}
  });
  q('camera-start').addEventListener('click',start);
  q('camera-stop').addEventListener('click',()=>stop());
  q('camera-switch').addEventListener('click',()=>{facing=facing==='user'?'environment':'user';start();});
  q('camera-capture').addEventListener('click',capture);
  q('camera-delete').addEventListener('click',()=>{forgetPhoto();cameraState='ready';q('camera-placeholder').hidden=false;status('Photo effacée. Tu peux réactiver la caméra.');controls();});
  q('camera-mode-photo').addEventListener('click',()=>setMode('photo'));
  q('camera-mode-follow').addEventListener('click',()=>setMode('follow'));
  q('camera-detect').addEventListener('change',()=>{detectFaces=q('camera-detect').checked;if(!detectFaces){mode='photo';detector?.close();detector=null;clearFace();faceStatus('Détection désactivée.');}else if(stream)loadDetector(generation);controls();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&mounted)stop('Caméra coupée lorsque l’application passe en arrière-plan.');});
  window.addEventListener('pagehide',leave);
  window.BeybooCamera={markup,open,leave,capture,state,publicState:()=>({camera:cameraState,photo:!!photoURL})};
})();
