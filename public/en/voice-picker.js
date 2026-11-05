/* Voice preferences are local; samples use the existing authenticated voice service. */
(() => {
  'use strict';
  const q=id=>document.getElementById(id),choice=q('voice-choice'),button=q('voice-preview');
  if(!choice||!button)return;
  let profiles=[],session={active:false,busy:false,preview:false};
  const current=()=>profiles.find(p=>p.id===choice.value);
  function render(){
    const profile=current(),name=profile?.label.split(' · ')[0]||'Bulle';
    q('voice-profile-description').textContent=profile?.description||'A bright, bubbly character with a smile in their voice.';
    button.textContent=session.preview?(session.busy?'Cancel sample':'Ⅱ Stop sample'):`▷ Hear ${name}`;
    button.disabled=(session.active||session.busy)&&!session.preview;
  }
  choice.addEventListener('change',()=>{try{localStorage.setItem('beyboo-voice-profile',choice.value);}catch{}render();});
  q('voice-character').addEventListener('change',()=>{q('voice-character').dataset.userChosen='true';});
  document.addEventListener('beyboo-voice-state',event=>{
    session=event.detail;render();
    q('voice-preview-status').textContent=session.preview||session.kind==='error'||(!session.active&&!session.busy)?session.message:'End this chat to preview or choose another voice.';
  });
  button.addEventListener('click',()=>{
    if(!window.BeybooVoice.isMounted())showMode('assistant');
    window.BeybooVoice.preview();
  });
  fetch('/voice-profiles-en.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(catalog=>{
    profiles=catalog.profiles;let saved;try{saved=localStorage.getItem('beyboo-voice-profile');}catch{}
    // Never change a voice while its live session is in progress.
    const selected=(session.active||session.busy)?choice.value:saved||catalog.defaultProfile;
    choice.replaceChildren();
    for(const group of new Set(profiles.map(p=>p.group))){
      const optgroup=document.createElement('optgroup');optgroup.label=group;
      for(const p of profiles.filter(p=>p.group===group)){const option=document.createElement('option');option.value=p.id;option.textContent=p.label;optgroup.append(option);}
      choice.append(optgroup);
    }
    choice.value=profiles.some(p=>p.id===selected)?selected:catalog.defaultProfile;
    q('voice-catalog-note').textContent=catalog.note+' The voices are AI-generated. Each sample uses this demo’s API credits.';render();document.dispatchEvent(new CustomEvent('beyboo-voices-ready'));
  }).catch(()=>{q('voice-preview-status').textContent='The voice list couldn’t load. You can still use Bulle. Reload to try the other voices.';});

  function gazeState(event){
    const {state,message}=event.detail,active=window.BeybooGaze.isActive();
    q('gaze-toggle').setAttribute('aria-pressed',String(active));
    q('gaze-toggle').textContent=active?(state==='requesting'||state==='loading'?'Cancel tracking':'◎ Turn off tracking and camera'):'◎ Let the eye follow me';
    q('gaze-status').textContent=message;
    q('gaze-controls').dataset.state=state;
    q('gaze-recenter').hidden=state!=='tracking';
  }
  function toggleGaze(){
    if(window.BeybooGaze.isActive()){window.BeybooGaze.stop();return;}
    if(!window.BeybooVoice.isMounted())showMode('assistant');
    window.BeybooScreen.run({action:'show_eye'});
    window.BeybooGaze.start();
  }
  document.addEventListener('beyboo-gaze-state',gazeState);
  q('gaze-toggle').addEventListener('click',toggleGaze);
  q('gaze-recenter').addEventListener('click',()=>window.BeybooGaze.recenter());
  window.BeybooGazeUI={toggle:toggleGaze,show(){q('gaze-controls').scrollIntoView({behavior:'smooth',block:'center'});q('gaze-toggle').focus({preventScroll:true});}};
})();
