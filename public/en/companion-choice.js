/* One character, one live display, one remembered voice. No microphone on selection. */
(() => {
  'use strict';
  const q=id=>document.getElementById(id),card=document.querySelector('.experience-card');
  const portrait=document.querySelector('.companion-portrait'),characterSelect=q('voice-character'),voiceSelect=q('voice-choice');
  let legacyVoice='bulle';try{legacyVoice=localStorage.getItem('beyboo-voice-profile')||'bulle';}catch{}
  const preferences=window.BeybooCompanionPreferences.create(()=>localStorage,selection.character,legacyVoice);
  let current=preferences.read().character,currentAsset=null,syncingVoice=false,loading=false;
  const lookup=id=>characters.find(c=>c.id===id);
  const chooser=document.createElement('section');chooser.className='companion-choice';
  chooser.innerHTML='<button type="button" class="companion-choice-open" id="companion-choice-open" aria-haspopup="dialog"><img alt="" width="65" height="65"><span><small>YOUR COMPANION</small><b></b></span><em>Change ↗</em></button><p class="companion-choice-status" id="companion-choice-status" role="status">This browser remembers your companion and voice.</p>';
  q('product-first-demo').before(chooser);
  const dialog=document.createElement('dialog');dialog.className='companion-choice-dialog';dialog.id='companion-choice-dialog';dialog.setAttribute('aria-labelledby','companion-choice-title');
  dialog.innerHTML='<button type="button" class="dialog-close" aria-label="Close companion chooser">×</button><p class="eyebrow">MEET YOUR COMPANIONS</p><h2 id="companion-choice-title">Who’s joining you?</h2><p>Pick a plush, discover their story and choose a voice you love.</p><div class="companion-choice-grid"></div><p id="companion-choice-feedback" role="status" aria-live="polite"></p>';
  document.body.append(dialog);
  for(const c of characters){
    const button=document.createElement('button');button.type='button';button.className='companion-choice-card';button.dataset.demoCharacter=c.id;button.setAttribute('aria-label',`Choose ${c.name} for the demo`);
    const img=document.createElement('img');img.src=photo(c.id);img.alt='';img.width=1254;img.height=1254;img.loading='lazy';
    const name=document.createElement('b');name.textContent=c.name;const role=document.createElement('small');role.textContent=c.role;button.append(img,name,role);dialog.querySelector('.companion-choice-grid').append(button);
    button.addEventListener('click',()=>choose(c.id));
  }
  const status=text=>{q('companion-choice-status').textContent=text;q('companion-choice-feedback').textContent=text;};
  function render(){
    const c=lookup(current),button=q('companion-choice-open');button.querySelector('img').src=photo(current);button.querySelector('b').textContent=c.name;button.setAttribute('aria-label',`${c.name}, change companion`);
    dialog.querySelectorAll('[data-demo-character]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.demoCharacter===current)));
    characterSelect.value=current;characterSelect.dataset.userChosen='true';
    if(!window.BeybooVoice.isActive())q('companion-talk-main').textContent=`◉ Talk to ${c.name}`;
    document.querySelector('[data-companion-action="talk"] small').textContent=`With ${c.name}`;
    document.querySelector('[data-companion-action="story"] small').textContent=`${c.name}’s story`;
  }
  function restoreVoice(){
    const value=preferences.voice(current);if(![...voiceSelect.options].some(o=>o.value===value))return;
    syncingVoice=true;voiceSelect.value=value;voiceSelect.dispatchEvent(new Event('change'));syncingVoice=false;
  }
  function syncEyeTexture(){
    if(!currentAsset)return;
    const {geometry:g,src}=currentAsset;
    document.querySelectorAll('.voice-iris-texture').forEach(svg=>{
      svg.setAttribute('viewBox',`${g.x-g.a+8} ${g.y-g.b+8} ${g.a*2-16} ${g.b*2-16}`);
      const image=svg.querySelector('image');image.setAttribute('href',src);image.setAttribute('width','1254');image.setAttribute('height','1254');
    });
  }
  function prepare(id,initial=false){
    const src=photo(id),asset=src.split('/').pop().replace('.webp',''),geometry=window.BeybooPortraitGeometry[asset];
    return {id,src,geometry,initial};
  }
  const switches=window.BeybooCompanionPreferences.createSwitch(value=>new Promise((resolve,reject)=>{
    if(!value.geometry){reject(Error('geometry'));return;}
    const img=new Image();img.onload=()=>resolve();img.onerror=()=>reject(Error('portrait'));img.src=value.src;
  }),value=>{
    if(!value.initial){if(window.BeybooVoice.isActive())window.BeybooVoice.end();if(window.BeybooGaze?.isActive())window.BeybooGaze.stop();window.BeybooCompanion.home();}
    current=value.id;currentAsset=value;const g=value.geometry;
    portrait.src=value.src;portrait.width=1254;portrait.height=1254;portrait.alt=`${lookup(current).name}, ${portraitDescription(current)}, full-length view of the stationary plush`;
    card.classList.add('has-character-portrait');
    card.style.setProperty('--character-eye-left',`${(g.x-g.a)/1254*100}%`);
    card.style.setProperty('--character-eye-top',(g.y-g.b)/1254);
    card.style.setProperty('--character-eye-width',`${g.a*2/1254*100}%`);
    card.style.setProperty('--character-eye-height',g.b*2/1254);
    window.BeybooCompanion.setPortraitGeometry({aspect:1,width:g.a*2/1254,height:g.b*2/1254});
    syncEyeTexture();render();restoreVoice();
    if(!value.initial){selection.character=current;renderSelection();const result=preferences.select(current);status(result.persisted?`${lookup(current).name} is with you. Your choice has been saved on this device.`:'Your choice applies to this visit. Your browser couldn’t save it for next time.');}
    return value;
  });
  async function choose(id,initial=false){
    if(!lookup(id))return;
    loading=true;characterSelect.value=current;
    if(!initial)status(`Getting ${lookup(id).name} ready…`);
    const result=await switches.select(prepare(id,initial));
    if(result.stale)return;loading=false;
    if(result.ok){if(!initial&&dialog.open)dialog.close();}
    else{render();status('The portrait couldn’t load. You’re still with your current companion. Try again.');}
  }
  q('companion-choice-open').addEventListener('click',()=>{dialog.querySelectorAll('[data-demo-character] img').forEach(img=>{img.src=photo(img.closest('[data-demo-character]').dataset.demoCharacter);img.loading='eager';});q('companion-choice-feedback').textContent='';dialog.showModal();});
  dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{if(loading){switches.cancel();loading=false;status('Selection cancelled. Your current companion is still with you.');}});
  characterSelect.addEventListener('change',()=>choose(characterSelect.value));
  voiceSelect.addEventListener('change',()=>{if(syncingVoice)return;const result=preferences.setVoice(current,voiceSelect.value);if(result.ok)status(result.persisted?`${lookup(current).name}’s voice is saved for your next chat.`:'Voice selected for this visit. Your browser couldn’t save it.');});
  document.addEventListener('beyboo-voices-ready',restoreVoice);
  document.addEventListener('beyboo-voice-state',event=>{if(!event.detail.active&&!event.detail.busy)q('companion-talk-main').textContent=`◉ Talk to ${lookup(current).name}`;});
  window.BeybooCompanionChoice={name:()=>lookup(current).name,syncEyeTexture,choose,current:()=>current,list:()=>characters.map(c=>({id:c.id,name:c.name,role:c.role,motto:c.motto}))};
  render();choose(current,true);
})();
