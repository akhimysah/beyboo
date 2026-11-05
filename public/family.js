(() => {
  const button=document.getElementById('family-open');
  if(!button)return;
  const en=document.documentElement.lang==='en';
  const t=(fr,english)=>en?english:fr;
  const labels={voice:t('Voix IA et dictée','AI voice and dictation'),camera:t('Photo et suivi du regard','Photos and gaze tracking'),calls:t('Appels Jitsi','Jitsi calls')};
  const key='beyboo.family.v1';
  const dialog=document.createElement('dialog');
  dialog.className='family-dialog';
  dialog.setAttribute('aria-labelledby','family-title');
  dialog.innerHTML='<button type="button" class="family-cross" aria-label="'+t('Fermer','Close')+'">×</button><h2 id="family-title">'+t('Espace famille','Family settings')+'</h2><div class="family-body"></div>';
  document.body.append(dialog);
  const body=dialog.querySelector('.family-body');
  let revision=0, failures=0, retryAt=0;
  function read(){
    try{
      const raw=localStorage.getItem(key);
      if(!raw)return null;
      const s=JSON.parse(raw);
      if(!/^[a-f0-9]{32}$/.test(s.salt)||!/^[a-f0-9]{64}$/.test(s.hash)||!Object.keys(labels).every(k=>typeof s.permissions?.[k]==='boolean'))throw Error();
      return s;
    }catch{return {unavailable:true};}
  }
  function allowed(feature){const s=read();return !s || s.permissions?.[feature]===true;}
  function close(){dialog.close();}
  function show(){if(!dialog.open)dialog.showModal();}
  function render(html){++revision;body.innerHTML=html;show();}
  function note(message){body.querySelector('[role=status]').textContent=message;}
  function guard(feature){
    if(allowed(feature))return true;
    render('<p>'+labels[feature]+' · '+t('Cette fonction est désactivée dans l’espace famille de ce navigateur.','This feature is disabled in this browser’s family settings.')+'</p><button type="button" class="family-done">'+t('Compris','Got it')+'</button>');
    body.querySelector('button').onclick=close;
    return false;
  }
  const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  async function digest(pin,salt){
    const input=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
    const bytes=Uint8Array.from(salt.match(/../g),n=>parseInt(n,16));
    return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes,iterations:120000,hash:'SHA-256'},input,256)));
  }
  function apply(){
    if(!allowed('voice')){if(window.BeybooVoice?.isActive())window.BeybooVoice.end();window.BeybooDevice?.reset();}
    if(!allowed('camera')){window.BeybooGaze?.stop();window.BeybooCamera?.leave();}
    if(!allowed('calls'))window.BeybooCall?.leave();
    const link=document.getElementById('call-external');
    if(link)link.hidden=!allowed('calls');
  }
  function settings(record){
    render('<p>'+t('Choisis les fonctions autorisées sur cet appareil. Les jeux, la musique et la veilleuse restent accessibles.','Choose the features allowed on this device. Games, music and the night light stay available.')+'</p><form>'+
      Object.entries(labels).map(([id,label])=>'<label class="family-option"><span>'+label+'</span><input type="checkbox" name="'+id+'" '+(record.permissions[id]?'checked':'')+'></label>').join('')+
      '<p class="family-small">'+t('Un appel autorisé peut utiliser le micro et la caméra chez Jitsi.','An allowed Jitsi call can use the microphone and camera.')+'</p><button type="submit">'+t('Enregistrer et verrouiller','Save and lock')+'</button><p role="status"></p></form>');
    body.querySelector('form').onsubmit=e=>{
      e.preventDefault();
      const permissions=Object.fromEntries(Object.keys(labels).map(k=>[k,e.target.elements.namedItem(k).checked]));
      try{
        const previous=read();
        if(previous && (previous.salt!==record.salt||previous.hash!==record.hash)){open();return;}
        localStorage.setItem(key,JSON.stringify({...record,permissions}));apply();
      }catch{note(t('Enregistrement impossible sur cet appareil.','Could not save on this device.'));return;}
      render('<p>'+t('Réglages enregistrés. Le code sera demandé à la prochaine modification.','Settings saved. Your code is required for the next change.')+'</p><button type="button">'+t('Terminé','Done')+'</button>');
      body.querySelector('button').onclick=close;
    };
  }
  function open(){
    const record=read();
    if(record?.unavailable){render('<p>'+t('Réglages indisponibles. Vérifie que le stockage local est autorisé.','Settings unavailable. Check that local storage is allowed.')+'</p>');return;}
    const pinLabel=record?t('Code famille','Family PIN'):t('Créer un code famille','Create a family PIN');
    const pinInput=(name,label)=>'<label class="family-pin">'+label+'<input name="'+name+'" type="password" inputmode="numeric" pattern="[0-9]{4,8}" minlength="4" maxlength="8" required autocomplete="off"></label>';
    render('<p>'+t('Ces réglages sont propres à ce navigateur. Un code de 4 à 8 chiffres protège leurs modifications.','These settings apply to this browser. A 4–8 digit PIN protects changes.')+'</p><form>'+pinInput('pin',pinLabel)+(record?'':pinInput('repeat',t('Confirmer le code','Confirm PIN')))+'<button type="submit">'+t('Continuer','Continue')+'</button><p role="status"></p></form>');
    const generation=revision;
    body.querySelector('form').onsubmit=async e=>{
      e.preventDefault();
      const form=e.target, pin=form.elements.pin.value;
      if(record && Date.now()<retryAt){note(t('Réessaie dans 30 secondes.','Try again in 30 seconds.'));return;}
      if(!/^[0-9]{4,8}$/.test(pin)||(!record && pin!==form.elements.repeat.value)){note(t('Vérifie les deux codes.','Check both PINs.'));return;}
      const submit=form.querySelector('button'); submit.disabled=true;
      try {
        const salt=record?.salt||hex(crypto.getRandomValues(new Uint8Array(16)));
        const hash=await digest(pin,salt);
        if(!dialog.open||revision!==generation)return;
        if(record && hash!==record.hash){if(++failures>=5){failures=0;retryAt=Date.now()+30000;}note(t('Code incorrect.','Incorrect PIN.'));form.elements.pin.value='';return;}
        failures=0;retryAt=0;
        settings(record||{salt,hash,permissions:{voice:true,camera:true,calls:true}});
      } catch {note(t('Le code nécessite un navigateur sécurisé.','A secure browser is required for the PIN.'));}
      finally {submit.disabled=false;}
    };
  }
  button.addEventListener('click',open);
  dialog.querySelector('.family-cross').onclick=close;
  dialog.addEventListener('close',()=>{revision++;body.replaceChildren();});
  window.addEventListener('storage',e=>{if(e.key===key||e.key===null){if(dialog.open)close();apply();}});
  window.BeybooFamily={allowed,guard};
  if(new URLSearchParams(location.search).get('outil')==='famille')open();
})();
