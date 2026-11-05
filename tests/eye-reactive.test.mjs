import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/eye-reactive.js',import.meta.url),'utf8');
function harness({reduce=false}={}){
  const props={},classes=new Set(),events=[],listeners={},windows={};
  const eye={hidden:false,dataset:{},classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n)}};
  const card={style:{setProperty:(k,v)=>props[k]=v}},meters=[],sources=[];
  let callback,closed=0,cancelled=0,gaze=false,voice=false;
  class AudioContext{
    resume(){return Promise.resolve();}close(){closed++;return Promise.resolve();}
    createMediaStreamSource(){const node={connected:null,disconnected:false,connect(to){this.connected=to;},disconnect(){this.disconnected=true;}};sources.push(node);return node;}
    createAnalyser(){const meter={sample:128,getByteTimeDomainData(data){data.fill(this.sample);}};meters.push(meter);return meter;}
  }
  const document={hidden:false,getElementById:()=>eye,querySelector:()=>card,addEventListener:(n,fn)=>listeners[n]=fn,dispatchEvent:e=>events.push(e)};
  const window={AudioContext,BeybooGaze:{isActive:()=>gaze},BeybooVoice:{isActive:()=>voice},addEventListener:(n,fn)=>windows[n]=fn};
  vm.runInNewContext(source,{window,document,CustomEvent:class{constructor(type,o){this.type=type;this.detail=o.detail;}},matchMedia:()=>({matches:reduce}),requestAnimationFrame:fn=>{callback=fn;return 1;},cancelAnimationFrame:()=>cancelled++,Uint8Array,Math});
  return {api:window.BeybooEye,props,eye,meters,sources,events,document,classes,tick:now=>callback(now),setGaze:v=>gaze=v,setVoice:v=>voice=v,hide(){document.hidden=true;listeners.visibilitychange();},get closed(){return closed;},get cancelled(){return cancelled;}};
}
test('actual microphone and reply samples drive the pupil signal; muting and leaving release audio safely',()=>{
  const h=harness(),{api,props}=h;api.enter();api.attach({},'mic');api.phase('listening');h.tick(0);assert.equal(Number(props['--voice-level']),0);
  h.meters[0].sample=160;h.tick(16);assert.ok(Number(props['--voice-level'])>.5);assert.equal(h.eye.dataset.voiceSignal,'user');
  api.mute(true);for(let i=1;i<40;i++)h.tick(i*16);assert.ok(Number(props['--voice-level'])<.01);
  api.attach({},'output');h.meters[1].sample=150;api.phase('speaking');h.tick(700);assert.ok(Number(props['--voice-level'])>.5);
  assert.ok(h.sources.every((s,i)=>s.connected===h.meters[i]));
  api.leave();assert.ok(h.sources.every(s=>s.disconnected));assert.equal(h.closed,1);assert.equal(h.cancelled,1);assert.equal(props['--voice-level'],'0');assert.equal(parseFloat(props['--voice-x']),0);
});
test('reference preview exposes the opposite white crescent through a bounded iris shift, holds, and returns after ten seconds',()=>{
  const h=harness();assert.equal(h.api.preview(),true);h.tick(0);assert.equal(parseFloat(h.props['--voice-x']),0);
  h.tick(2400);const held=h.props['--voice-x'];assert.equal(parseFloat(held),11.5);assert.equal(Number(h.props['--iris-scale']),.95);
  h.tick(2900);assert.equal(h.props['--voice-x'],held);
  h.tick(5150);assert.equal(parseFloat(h.props['--voice-x']),-3);
  h.tick(10001);assert.equal(h.api.isPreview(),false);assert.equal(parseFloat(h.props['--voice-x']),0);assert.equal(Number(h.props['--iris-scale']),1);
  assert.equal(h.events.at(-1).detail.active,false);assert.equal(h.meters.length,0);assert.ok(Object.keys(h.props).every(p=>p.startsWith('--')));
});
test('real face tracking takes priority even while permission is pending, while audio still reacts',()=>{
  const h=harness();h.api.preview();h.tick(0);h.tick(2400);h.api.attach({},'mic');h.meters[0].sample=150;
  h.setGaze(true);h.tick(2500);assert.equal(h.api.isPreview(),false);assert.equal(parseFloat(h.props['--voice-x']),0);assert.equal(parseFloat(h.props['--voice-y']),0);assert.ok(Number(h.props['--voice-level'])>.5);
  assert.equal(h.api.preview(),false);h.setGaze(false);h.setVoice(true);assert.equal(h.api.preview(),false);
});
test('starting speech, showing a video, cancellation and backgrounding end the preview without leaving a displaced iris',()=>{
  for(const action of ['speech','video','cancel','background']){
    const h=harness();h.api.preview();h.tick(0);h.tick(2400);
    if(action==='speech')h.api.phase('connecting');if(action==='video'){h.eye.hidden=true;h.tick(2500);}if(action==='cancel')h.api.preview();if(action==='background')h.hide();
    assert.equal(h.api.isPreview(),false,action);assert.equal(parseFloat(h.props['--voice-x']),0,action);
  }
});
test('resting animation has settled fixations and no continuous sinusoidal drift',()=>{
  const h=harness();h.api.enter();for(let t=0;t<=2000;t+=16)h.tick(t);assert.equal(parseFloat(h.props['--voice-x']),0);
  for(let t=2016;t<=3000;t+=16)h.tick(t);const held=h.props['--voice-x'];assert.ok(parseFloat(held)>3);
  for(let t=3008;t<=3700;t+=16)h.tick(t);assert.equal(h.props['--voice-x'],held);
});
test('reduced motion disables automatic wandering but permits the explicitly requested reference preview',()=>{
  const h=harness({reduce:true});h.api.enter();for(let t=0;t<6000;t+=16)h.tick(t);assert.equal(parseFloat(h.props['--voice-x']),0);
  h.api.preview();h.tick(6000);h.tick(8400);assert.equal(parseFloat(h.props['--voice-x']),11.5);h.api.leave();assert.equal(h.api.isPreview(),false);
});
