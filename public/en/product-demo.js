/* Accessible controls for the same activity shown in the miniature product screen. */
(() => {
  'use strict';
  const q=id=>document.getElementById(id),stage=q('voice-stage');
  const panel=document.createElement('section');panel.className='product-activity';panel.hidden=true;panel.setAttribute('aria-label','Activity controls');panel.id='product-activity';
  document.querySelector('.companion-launcher').after(panel);
  // Framing controls belong with the product, including while its activity is running.
  q('companion-scene').parentElement.append(document.querySelector('.companion-view-controls'));
  const desktop=matchMedia('(min-width:701px)'),toolbar=q('voice-screen-toolbar');
  const positionToolbar=()=>{if(desktop.matches)document.querySelector('.companion-welcome').after(toolbar,panel,q('camera-panel'));else q('companion-scene').after(toolbar,panel,q('camera-panel'));};
  desktop.addEventListener('change',positionToolbar);positionToolbar();
  q('product-first-demo').addEventListener('click',()=>{
    if(!window.BeybooVoice.isMounted())showMode('assistant');
    window.BeybooScreen.run({action:'play_video'});
  });
  let signature='',pending=false;
  const element=(tag,text,className)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;};
  const button=(text,action)=>{const b=element('button',text);b.type='button';b.addEventListener('click',action);return b;};
  function render(){
    pending=false;
    const type=stage.hidden?'eye':stage.className.replace('voice-stage voice-stage--','');
    const bedside=type==='clock'||type==='nightlight';
    const next=bedside?type+'|'+stage.dataset.bedsideRevision:type+'|'+(stage.dataset.activityRevision||'')+'|'+stage.textContent+'|'+(q('voice-youtube-search')?.href||'');
    if(signature===next)return;signature=next;
    const restoreFocus=panel.contains(document.activeElement),focusedText=document.activeElement?.textContent, focusKey=document.activeElement?.dataset.move || document.activeElement?.dataset.track;
    panel.hidden=!bedside && !['music','math','game','story','search','weather','call'].includes(type);panel.replaceChildren();
    if(panel.hidden)return;
    if(bedside){window.BeybooBedside.controls(panel);return;}
    panel.append(element('p','NOW IN THE EYE','activity-label'));
    if(type==='math'){
      panel.append(element('h4',q('voice-math-question')?.textContent||stage.querySelector('.voice-math-question')?.textContent));
      const options=element('div','','product-math-options');
      stage.querySelectorAll('[data-math-answer]').forEach(b=>options.append(button(b.textContent,()=>b.click())));panel.append(options);
      const feedback=q('voice-math-feedback'),text=element('p',feedback.textContent);text.dataset.correct=feedback.dataset.correct||'false';text.setAttribute('role','status');panel.append(text);
      if(!q('voice-math-next').hidden)panel.append(button('Next question →',()=>q('voice-math-next').click()));
    }else if(type==='music'){
      window.BeybooMusic.controls(panel);
    }else if(type==='game' && window.BeybooArcade.state().game!=='stars'){
      window.BeybooArcade.controls(panel);
    }else if(type==='game'){
      panel.append(element('h4','Catch the stars'),element('p',stage.querySelector('h4')?.textContent||''));
      const grid=element('div','','product-star-grid');
      stage.querySelectorAll('[data-voice-star]').forEach(b=>{const copy=button(b.textContent,()=>b.click());copy.className=b.className;copy.setAttribute('aria-label',b.getAttribute('aria-label'));grid.append(copy);});panel.append(grid);
      if(q('voice-stars-again'))panel.append(button('Play again',()=>q('voice-stars-again').click()));
      panel.append(button('All games',()=>window.BeybooScreen.run({action:'open_game'})));
    }else if(type==='story'){
      const c=characters.find(c=>c.name===q('voice-story-name')?.textContent);
      if(!c)return;
      panel.append(element('h4',c.title),element('p',c.story[0]));
      if(c.story.length>1){const more=element('details');more.append(element('summary','Read more'));c.story.slice(1).forEach(p=>more.append(element('p',p)));panel.append(more);}
      if(window.speechSynthesis && window.SpeechSynthesisUtterance){
        const info=element('p','','activity-footnote');
        panel.append(button('Read with my device voice',()=>{
          const ok=window.BeybooDevice.speakStory(c.story.join(' '));
          info.textContent=ok===false?'Install an English voice in your device settings.':'';
        }),info);
      }
      panel.append(button('Listen with BEYBOO ♫',()=>{q('voice-question').value='Gently tell me this story about '+c.name+' : '+c.story.join(' ');q('voice-form').requestSubmit();}),element('p','AI voice · uses this demo’s API credits.','activity-footnote'));
    }else if(type==='search'){
      window.BeybooLibrary.videoControls(panel,button);
    }else if(type==='weather'){
      window.BeybooLibrary.weatherControls(panel,button);
    }else if(type==='call'){
      panel.append(element('h4','Say hello to someone you love.'),element('p','Set up a video call, then share the link with the person you want to call.'),button('Set up a video call →',()=>q('voice-go-call').click()));
    }
    if(restoreFocus){const buttons=[...panel.querySelectorAll('button')];(buttons.find(b=>focusKey && !b.disabled && (b.dataset.move===focusKey||b.dataset.track===focusKey))||buttons.find(b=>!b.disabled && b.textContent===focusedText)||buttons.find(b=>!b.disabled))?.focus({preventScroll:true});}
  }
  const schedule=()=>{if(!pending){pending=true;queueMicrotask(render);}};
  new MutationObserver(schedule).observe(stage,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','hidden','data-correct']});
  render();
})();
