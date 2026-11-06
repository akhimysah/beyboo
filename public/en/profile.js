/* One form inside the actual circular screen, with a touch keyboard and explicit local save. */
(() => {
  'use strict';
  const q=id=>document.getElementById(id),card=document.querySelector('.experience-card');
  const model=window.BeybooProfileModel.create(()=>window.localStorage);
  const welcome=document.querySelector('.companion-welcome h3'),originalWelcome=welcome.innerHTML;
  const panel=document.createElement('section');
  panel.id='profile-panel';panel.className='profile-panel';panel.hidden=true;panel.setAttribute('aria-labelledby','profile-panel-title');
  panel.innerHTML='<p class="eyebrow">YOUR PROFILE · ON THIS DEVICE</p><h4 id="profile-panel-title">What should we call you?</h4><p>Tap Name or Username in the eye and use its keyboard. Tap Save to keep your profile in this browser.</p><p id="profile-status" role="status" aria-live="polite"></p><div class="profile-tools"><button type="button" id="profile-native-keyboard" aria-pressed="false">Use my device keyboard</button><button type="button" id="profile-return">Back to the eye</button><button type="button" id="profile-delete" hidden>Delete my profile</button></div><p class="profile-privacy">This demo profile is stored locally. Usernames are for this device only. Your name and username stay here, separate from OpenAI, Google and WhatsApp accounts.</p>';
  document.querySelector('.companion-launcher').after(panel);
  let form=null,fields=null,current='name',draft=null,shift=false,layout='letters',native=false,previousDetail=false;
  const rows={letters:['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'],numbers:['1234567890','@._-+!?',',:;/()'],accents:['éèêëàâä','îïôöùûü','çœæÉÀÇ']};
  function greeting(profile){
    if(profile)welcome.textContent='Hello, '+profile.name+'.';
    else welcome.innerHTML=originalWelcome;
    document.querySelectorAll('[data-profile-open] small').forEach(el=>el.textContent=profile?'@'+profile.handle:'Name and username');
    q('profile-delete').hidden=!profile;
  }
  greeting(model.read());
  function status(message,error=false){q('profile-status').textContent=message;q('profile-status').dataset.error=String(error);}
  function markup(){return '<form class="profile-eye-form" id="profile-eye-form" aria-label="BOOZZO profile in the eye" novalidate><h4>My profile</h4><label for="profile-name">Name<input id="profile-name" name="name" maxlength="40" autocomplete="off" inputmode="none" spellcheck="false" aria-describedby="profile-status" placeholder="Your first name"></label><label for="profile-handle">Username<input id="profile-handle" name="handle" maxlength="24" autocomplete="off" autocapitalize="none" inputmode="none" spellcheck="false" aria-describedby="profile-status" placeholder="your.username"></label><div id="profile-keyboard" class="profile-keyboard" role="group" aria-label="QWERTY touch keyboard"></div><button class="profile-save" type="submit">Save</button><span id="profile-eye-message" class="profile-eye-message">On this device</span></form>';}
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
      if(layout==='letters'&&index===2){const b=keyButton('⇧','shift','Shift');b.setAttribute('aria-pressed',String(shift));line.append(b);}
      for(const ch of row){const char=layout==='letters'?(shift?ch:ch.toLowerCase()):ch;line.append(keyButton(layout==='letters'?ch:ch,'char:'+char,'Key '+char));}
      if(index===2)line.append(keyButton('⌫','backspace','Delete the previous character'));
      root.append(line);
    });
    const bottom=document.createElement('div');bottom.className='profile-key-row profile-key-bottom';
    bottom.append(keyButton(layout==='numbers'?'ABC':'123',layout==='numbers'?'letters':'numbers','Letters or numbers'),keyButton(layout==='accents'?'ABC':'éà',layout==='accents'?'letters':'accents','Accented letters'),keyButton('space','space','Space'),keyButton('→','next','Next field'));
    root.append(bottom);
  }
  function dirty(){
    draft={name:fields.name.value,handle:fields.handle.value};
    for(const input of Object.values(fields))input.removeAttribute('aria-invalid');
    q('profile-eye-message').textContent='Unsaved changes';
    status('Tap Save when you’re finished typing.');
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
    if(input.value.length-(end-start)+addition.length>input.maxLength){status('This field has reached its character limit.',true);return;}
    input.setRangeText(addition,start,end,'end');dirty();
    if(shift&&action.startsWith('char:')){shift=false;keyboard();}
  }
  function save(event){
    event.preventDefault();
    const result=model.save({name:fields.name.value,handle:fields.handle.value});
    if(!result.ok){status(result.message,true);fields[result.field].setAttribute('aria-invalid','true');choose(result.field,true);return;}
    draft={name:result.profile.name,handle:result.profile.handle};
    fields.name.value=draft.name;fields.handle.value=draft.handle;greeting(result.profile);
    q('profile-eye-message').textContent=result.persisted?'Profile saved ✓':'For this session only';
    status(result.persisted?'Profile saved on this device for '+draft.name+' · @'+draft.handle+'.':'Your browser couldn’t save the profile. It’s available for this session only.',!result.persisted);
    Object.values(fields).forEach(input=>input.blur());
  }
  function mount(){
    previousDetail=card.classList.contains('has-eye-detail');
    form=q('profile-eye-form');fields={name:q('profile-name'),handle:q('profile-handle')};
    const initial=draft||model.read()||{name:'',handle:''};
    fields.name.value=initial.name;fields.handle.value=initial.handle;
    current='name';layout='letters';shift=false;native=false;
    q('profile-native-keyboard').setAttribute('aria-pressed','false');q('profile-native-keyboard').textContent='Use my device keyboard';
    form.addEventListener('submit',save);form.addEventListener('input',dirty);
    for(const [name,input] of Object.entries(fields))input.addEventListener('focus',()=>choose(name));
    q('profile-keyboard').addEventListener('click',event=>{const button=event.target.closest('[data-key]');if(button)type(button.dataset.key);});
    keyboard();choose('name');panel.hidden=false;card.classList.add('has-profile-editor');
    status('Tap a field, enter your name and username, then tap Save.');
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
    q('profile-native-keyboard').textContent=native?'Use the eye’s keyboard':'Use my device keyboard';
    if(native)choose(current,true);else fields[current].blur();
  });
  q('profile-return').addEventListener('click',()=>window.BeybooCompanion.home());
  q('profile-delete').addEventListener('click',()=>{
    const result=model.remove();if(!result.ok){status(result.message,true);return;}
    draft=null;greeting(null);fields.name.value='';fields.handle.value='';
    q('profile-eye-message').textContent='On this device';status('Your profile has been deleted from this device.');choose('name');
  });
  document.querySelectorAll('[data-profile-open]').forEach(button=>button.addEventListener('click',open));
  window.BeybooProfile={markup,mount,leave,open,isOpen};
  if(new URLSearchParams(location.search).get('screen')==='profile')open();
})();
