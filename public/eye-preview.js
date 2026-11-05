/* Explicit silent preview: no simulated conversation and no camera or microphone request. */
(() => {
  const button=document.getElementById('eye-preview-button'),status=document.getElementById('eye-preview-status');
  if(!button)return;
  function update(){const preview=window.BeybooEye.isPreview();button.textContent=preview?'Ⅱ Arrêter l’animation':'▷ Voir le mouvement de l’œil';button.setAttribute('aria-pressed',String(preview));button.disabled=!preview&&(window.BeybooGaze?.isActive()||window.BeybooVoice?.isActive());}
  button.addEventListener('click',()=>{
    if(!window.BeybooEye.isPreview()){
      if(!window.BeybooVoice.isMounted())showMode('assistant');
      window.BeybooScreen.run({action:'show_eye'});
      document.getElementById('living-eye').dataset.expression='listen';
    }
    const started=window.BeybooEye.preview();update();
    if(started){
      const detail=document.querySelector('.experience-card').classList.contains('has-eye-detail');
      document.getElementById(detail?'living-eye':'companion-scene').scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    }
  });
  document.addEventListener('beyboo-eye-preview',event=>{status.textContent=event.detail.message;update();});
  document.addEventListener('beyboo-gaze-state',()=>{if(window.BeybooGaze.isActive())window.BeybooEye.stopPreview('Le suivi du visage commande le regard.');update();});
  document.addEventListener('beyboo-voice-state',()=>update());
  window.BeybooEye.enter();update();
})();
