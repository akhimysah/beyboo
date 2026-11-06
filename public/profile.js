/* One form inside the actual circular screen, with a touch keyboard and explicit local save. */
(() => {
  'use strict';
  const q=id=>document.getElementById(id),card=document.querySelector('.experience-card');
  const model=window.BeybooProfileModel.create(()=>window.localStorage);
  const welcome=document.querySelector('.companion-welcome h3'),originalWelcome=welcome.innerHTML;
  const panel=document.createElement('section');
  panel.id='profile-panel';panel.className='profile-panel';panel.hidden=true;panel.setAttribute('aria-labelledby','profile-panel-title');
  panel.innerHTML='<p class="eyebrow">TON PROFIL · SUR CET APPAREIL</p><h4 id="profile-panel-title">Un nom. Ton univers.</h4><p>Touche Nom ou Identifiant dans l’œil, puis utilise son clavier. « Enregistrer » garde ton profil dans ce navigateur.</p><p id="profile-status" role="status" aria-live="polite"></p><div class="profile-tools"><button type="button" id="profile-native-keyboard" aria-pressed="false">Utiliser le clavier de mon appareil</button><button type="button" id="profile-return">Revenir à l’œil</button><button type="button" id="profile-delete" hidden>Effacer mon profil</button></div><p class="profile-privacy">Profil de démonstration local. Aucun compte créé, aucune vérification de disponibilité de l’identifiant. Le nom et l’identifiant ne sont pas envoyés à OpenAI et ne connectent pas Google ou WhatsApp.</p>';
  document.querySelector('.companion-launcher').after(panel);
  let form=null,fields=null,current='name',draft=null,shift=false,layout='letters',native=false,previousDetail=false;
  const rows={letters:['AZERTYUIOP','QSDFGHJKLM','WXCVBN'],numbers:['1234567890','@._-+!?',',:;/()'],accents:['éèêëàâä','îïôöùûü','çœæÉÀÇ']};
  function greeting(profile){
    if(profile)welcome.textContent='Bonjour, '+profile.name+'.';
    else welcome.innerHTML=originalWelcome;
    document.querySelectorAll('[data-profile-open] small').forEach(el=>el.textContent=profile?'@'+profile.handle:'Nom et identifiant');
    q('profile-delete').hidden=!profile;
  }
  greeting(model.read());
  function status(message,error=false){q('profile-status').textContent=message;q('profile-status').dataset.error=String(error);}
  function markup(){return '<form class="profile-eye-form" id="profile-eye-form" aria-label="Profil BOOZZO dans l’œil" novalidate><h4>Mon profil</h4><label for="profile-name">Nom<input id="profile-name" name="name" maxlength="40" autocomplete="off" inputmode="none" spellcheck="false" aria-describedby="profile-status" placeholder="Ton prénom"></label><label for="profile-handle">Identifiant<input id="profile-handle" name="handle" maxlength="24" autocomplete="off" autocapitalize="none" inputmode="none" spellcheck="false" aria-describedby="profile-status" placeholder="ton.identifiant"></label><div id="profile-keyboard" class="profile-keyboard" role="group" aria-label="Clavier tactile AZERTY"></div><button class="profile-save" type="submit">Enregistrer</button><span id="profile-eye-message" class="profile-eye-message">Sur cet appareil</span></form>';}
  function keyButton(text,action,label){
    const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label',label||text);button.dataset.key=action;
    // Keep the field's selection when tapping, without opening the phone keyboard.
    button.addEventListener('pointerdown',event=>event.preventDefault());
    return button;
  }
  function keyboard(){
    const root=q('profile-keyboard');root.replaceChildren();
    rows[layout].forEach((row,index)=>{
      const line=document.createElement('div');line.className='profile-key-row';
      if(layout==='letters'&&index===2){const b=keyButton('⇧','shift','Majuscules');b.setAttribute('aria-pressed',String(shift));line.append(b);}
      for(const ch of row){const char=layout==='letters'?(shift?ch:ch.toLowerCase()):ch;line.append(keyButton(layout==='letters'?ch:ch,'char:'+char,'Touche '+char));}
      if(index===2)line.append(keyButton('⌫','backspace','Effacer le caractère précédent'));
      root.append(line);
    });
    const bottom=document.createElement('div');bottom.className='profile-key-row profile-key-bottom';
    bottom.append(keyButton(layout==='numbers'?'ABC':'123',layout==='numbers'?'letters':'numbers','Lettres ou chiffres'),keyButton(layout==='accents'?'ABC':'éà',layout==='accents'?'letters':'accents','Lettres accentuées'),keyButton('espace','space','Espace'),keyButton('→','next','Champ suivant'));
    root.append(bottom);
  }
  function dirty(){
    draft={name:fields.name.value,handle:fields.handle.value};
    for(const input of Object.values(fields))input.removeAttribute('aria-invalid');
    q('profile-eye-message').textContent='Modifications à enregistrer';
    status('Saisie en cours. Touche « Enregistrer » quand tu as terminé.');
  }
  function choose(field,focus=false){
    current=field;
    for(const [name,input] of Object.entries(fields))input.classList.toggle('profile-field-active',name===field);
    if(focus)fields[field].focus({preventScroll:true});
  }
  function type(action){
    const input=fields[current];
    if(['letters','numbers','accents'].includes(action)){layout=action;keyboard();return;}
    if(action==='shift'){shift=!shift;keyboard();return;}
    if(action==='next'){choose(current==='name'?'handle':'name',true);return;}
    let start=input.selectionStart??input.value.length,end=input.selectionEnd??start;
    const addition=action==='space'?' ':action.startsWith('char:')?action.slice(5):'';
    if(action==='backspace'&&start===end&&start>0)start-=Array.from(input.value.slice(0,start)).at(-1).length;
    if(input.value.length-(end-start)+addition.length>input.maxLength){status('La longueur maximale du champ est atteinte.',true);return;}
    input.setRangeText(addition,start,end,'end');dirty();
    if(shift&&action.startsWith('char:')){shift=false;keyboard();}
  }
  function save(event){
    event.preventDefault();
    const result=model.save({name:fields.name.value,handle:fields.handle.value});
    if(!result.ok){status(result.message,true);fields[result.field].setAttribute('aria-invalid','true');choose(result.field,true);return;}
    draft={name:result.profile.name,handle:result.profile.handle};
    fields.name.value=draft.name;fields.handle.value=draft.handle;greeting(result.profile);
    q('profile-eye-message').textContent=result.persisted?'Profil enregistré ✓':'Pour cette session seulement';
    status(result.persisted?'Profil enregistré sur cet appareil : '+draft.name+' · @'+draft.handle+'.':'La saisie fonctionne, mais le navigateur refuse la sauvegarde. Le profil reste disponible pour cette session seulement.',!result.persisted);
    Object.values(fields).forEach(input=>input.blur());
  }
  function mount(){
    previousDetail=card.classList.contains('has-eye-detail');
    form=q('profile-eye-form');fields={name:q('profile-name'),handle:q('profile-handle')};
    const initial=draft||model.read()||{name:'',handle:''};
    fields.name.value=initial.name;fields.handle.value=initial.handle;
    current='name';layout='letters';shift=false;native=false;
    q('profile-native-keyboard').setAttribute('aria-pressed','false');q('profile-native-keyboard').textContent='Utiliser le clavier de mon appareil';
    form.addEventListener('submit',save);form.addEventListener('input',dirty);
    for(const [name,input] of Object.entries(fields))input.addEventListener('focus',()=>choose(name));
    q('profile-keyboard').addEventListener('click',event=>{const button=event.target.closest('[data-key]');if(button)type(button.dataset.key);});
    keyboard();choose('name');panel.hidden=false;card.classList.add('has-profile-editor');
    status('Touche un champ, saisis ton nom et ton identifiant, puis enregistre.');
    window.BeybooCompanion?.setDetail(true,{reveal:true});
  }
  function leave(){
    if(!form)return;
    draft={name:fields.name.value,handle:fields.handle.value};
    form=null;fields=null;panel.hidden=true;card.classList.remove('has-profile-editor');
    window.BeybooCompanion?.setDetail(previousDetail);
  }
  function open(){
    if(isOpen()){window.BeybooCompanion?.setDetail(true,{reveal:true});return;}
    window.BeybooVoice?.end();window.BeybooGaze?.stop();
    if(!window.BeybooVoice?.isMounted())showMode('assistant');
    window.BeybooScreen.run({action:'open_profile'});
  }
  const isOpen=()=>!!form;
  q('profile-native-keyboard').addEventListener('click',()=>{
    if(!fields)return;native=!native;
    for(const input of Object.values(fields))input.inputMode=native?'text':'none';
    q('profile-native-keyboard').setAttribute('aria-pressed',String(native));
    q('profile-native-keyboard').textContent=native?'Revenir au clavier de l’œil':'Utiliser le clavier de mon appareil';
    if(native)choose(current,true);else fields[current].blur();
  });
  q('profile-return').addEventListener('click',()=>window.BeybooCompanion.home());
  q('profile-delete').addEventListener('click',()=>{
    const result=model.remove();if(!result.ok){status(result.message,true);return;}
    draft=null;greeting(null);fields.name.value='';fields.handle.value='';
    q('profile-eye-message').textContent='Sur cet appareil';status('Le profil a été effacé de cet appareil.');choose('name');
  });
  document.querySelectorAll('[data-profile-open]').forEach(button=>button.addEventListener('click',open));
  window.BeybooProfile={markup,mount,leave,open,isOpen};
  if(new URLSearchParams(location.search).get('screen')==='profile')open();
})();
