import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/camera.js',import.meta.url),'utf8');
const screenSource=await readFile(new URL('../public/screen-actions.js',import.meta.url),'utf8');
function harness({playerSize=280,secure=true,pending=false,error=null,screen=false}={}){
  const els=new Map(),requests=[],streams=[],revoked=[],timers=new Map(),windowEvents={},documentEvents={},events=[],players=[];
  let resolveRequest,timerID=0,blobID=0;
  function el(id){
    if(!els.has(id))els.set(id,{id,hidden:false,disabled:false,checked:false,textContent:'',dataset:{},attrs:{},style:{setProperty(k,v){this[k]=v;}},listeners:{},readyState:2,videoWidth:720,videoHeight:720,currentTime:0,srcObject:null,
      classList:{remove(){},add(){}},replaceChildren(){},querySelectorAll(){return[];},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},addEventListener(n,fn){this.listeners[n]=fn;},click(){return this.listeners.click?.();},play(){return Promise.resolve();},pause(){this.paused=true;}});
    return els.get(id);
  }
  const context={beginPath(){},arc(){},clip(){},translate(){},scale(){},drawImage(){}};
  let detections=[],closed=false;
  const detector={close(){closed=true;},detectForVideo:async()=>({detections})};
  const makeStream=()=>{const track={stopped:false,stop(){this.stopped=true;},getSettings(){return{};},addEventListener(n,fn){this[n]=fn;}};const s={track,getTracks:()=>[track],getVideoTracks:()=>[track]};streams.push(s);return s;};
  const document={getElementById:el,querySelector:el,querySelectorAll:()=>[],hidden:false,addEventListener(n,fn){documentEvents[n]=fn;},dispatchEvent(event){events.push(event);documentEvents[event.type]?.(event);},createElement(){return{width:0,height:0,getContext:()=>context,toBlob(fn){fn({type:'image/png'});}};}};
  const navigator={mediaDevices:{getUserMedia(options){requests.push(options);if(error)return Promise.reject({name:error});if(pending)return new Promise(r=>resolveRequest=r);return Promise.resolve(makeStream());}}};
  let gazeStops=0;
  const window={BeybooGaze:{stop(){gazeStops++;}},BeybooFaceDetector:{create:async()=>detector},isSecureContext:secure,addEventListener(n,fn){windowEvents[n]=fn;}};
  const YT={Player:class{
    constructor(id,options){this.options=options;this.muted=true;this.volume=65;players.push(this);}
    isMuted(){return this.muted;}getVolume(){return this.volume;}setVolume(value){this.volume=value;}
    mute(){this.muted=true;}unMute(){if(!this.ignoreUnmute)this.muted=false;}
    playVideo(){}pauseVideo(){}destroy(){}getIframe(){return el('youtube-iframe');}
    emit(data){this.options.events.onStateChange({data,target:this});}
  }};
  window.YT=YT;
  window.BeybooDevice={videoFor:()=>null,stopSpeech(){}};
  el('voice-youtube-player').getBoundingClientRect=()=>({width:playerSize,height:playerSize});

  const vmContext=vm.createContext({document,navigator,window,YT,location:{origin:'https://beyboo.test'},CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},URL:class extends URL{ static createObjectURL=()=>`blob:test-${++blobID}`;static revokeObjectURL=u=>revoked.push(u)},performance:{now:()=>1000},setTimeout:fn=>{const id=++timerID;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(source,vmContext);
  if(screen)vm.runInContext(screenSource,vmContext);
  const api=window.BeybooCamera;api.open();
  return {el,api,screen:window.BeybooScreen,players,events,requests,streams,revoked,timers,document,documentEvents,windowEvents,resolve:()=>resolveRequest(makeStream()),setFaces:f=>{detections=f;},detectorClosed:()=>closed,gazeStops:()=>gazeStops};
}
const flush=()=>new Promise(r=>setImmediate(r));
test('camera requires a touch and requests video only; photo is local and releases tracks',async()=>{
  const h=harness();assert.equal(h.requests.length,0);assert.equal(h.el('camera-capture').disabled,true);
  await h.el('camera-start').click();assert.equal(h.requests[0].audio,false);assert.equal(h.api.state().camera,'live');assert.equal(h.gazeStops(),1);
  const photo=await h.api.capture();assert.equal(photo.ok,true);assert.equal(h.streams[0].track.stopped,true);assert.equal(h.el('camera-preview').srcObject,null);
  assert.equal(h.api.state().photo,true);assert.match(h.el('camera-download').href,/^blob:test/);assert.equal(h.api.state().identityRecognition,false);
  h.el('camera-delete').click();assert.equal(h.api.state().photo,false);assert.deepEqual(h.revoked,['blob:test-1']);
});
test('leaving while permission is pending disposes a late stream without mounting it',async()=>{
  const h=harness({pending:true});const start=h.el('camera-start').click();h.api.leave();h.resolve();await start;
  assert.equal(h.streams[0].track.stopped,true);assert.equal(h.el('camera-preview').srcObject,null);assert.equal(h.el('camera-panel').hidden,true);assert.equal(h.timers.size,0);
});
test('camera refusal and insecure contexts remain honest and retryable',async()=>{
  const h=harness({error:'NotAllowedError'});await h.el('camera-start').click();assert.match(h.el('camera-status').textContent,/non autorisée/);assert.equal(h.el('camera-start').hidden,false);assert.equal(h.api.state().camera,'error');
  const insecure=harness({secure:false});await insecure.el('camera-start').click();assert.equal(insecure.requests.length,0);assert.match(insecure.el('camera-status').textContent,/HTTPS/);
});
test('switching cameras releases the first stream; backgrounding closes the next',async()=>{
  const h=harness();await h.el('camera-start').click();h.el('camera-switch').click();await flush();assert.equal(h.streams[0].track.stopped,true);assert.equal(h.requests[1].video.facingMode.ideal,'environment');
  h.document.hidden=true;h.documentEvents.visibilitychange();assert.equal(h.streams[1].track.stopped,true);assert.equal(h.el('camera-preview').srcObject,null);assert.equal(h.timers.size,0);
});
test('leaving erases the temporary photo and a photo command never activates the camera',async()=>{
  const h=harness();const result=await h.api.capture();assert.equal(result.ok,false);assert.equal(h.requests.length,0);
  await h.el('camera-start').click();await h.api.capture();h.api.leave();assert.equal(h.api.state().photo,false);assert.deepEqual(h.revoked,['blob:test-1']);assert.equal(h.el('camera-panel').hidden,true);
});

test('local face positions move the pupil, clear when absent, and are excluded from voice state',async()=>{
  const h=harness();h.api.open('follow');h.setFaces([{boundingBox:{originX:30,originY:60,width:70,height:90}}]);
  await h.el('camera-start').click();await flush();
  const run=async()=>{h.el('camera-preview').currentTime+=1;const entry=h.timers.entries().next().value;if(entry){h.timers.delete(entry[0]);await entry[1]();}await flush();};
  await run();assert.equal(h.api.state().faces,1);assert.match(h.el('camera-face-status').textContent,/Un visage détecté/);assert.notEqual(h.el('camera-view').style['--face-x'],'0%');
  assert.equal('faces' in h.api.publicState(),false);assert.equal('faceDetection' in h.api.publicState(),false);
  for(const event of h.events)assert.deepEqual(Object.keys(event.detail).sort(),['camera','description','photo']);
  h.setFaces([]);await run();assert.equal(h.api.state().faces,0);assert.equal(h.el('camera-face-box').hidden,true);assert.equal(h.el('camera-view').style['--face-x'],'0%');
  h.api.leave();assert.equal(h.detectorClosed(),true);
});

test('camera lifecycle updates the visible toolbar and tool state without publishing face data',async()=>{
  const h=harness({screen:true});await h.screen.run({action:'open_camera'});
  assert.match(h.el('voice-screen-status').textContent,/Active la caméra/);
  await h.el('camera-start').click();
  let state=await h.screen.run({action:'get_state'});
  assert.equal(state.camera,'live');assert.match(state.description,/Caméra en direct/);assert.equal(state.ok,true);
  assert.equal('faces' in state,false);assert.equal('faceDetection' in state,false);
  await h.api.capture();state=await h.screen.run({action:'get_state'});
  assert.equal(state.camera,'photo');assert.equal(state.photo,true);assert.match(state.description,/Photo prête/);
  await h.screen.run({action:'show_eye'});
  const message=h.el('voice-screen-status').textContent;
  h.document.dispatchEvent({type:'beyboo-camera-state',detail:{description:'Late camera status'}});
  assert.equal(h.el('voice-screen-status').textContent,message);
  const denied=harness({screen:true,error:'NotAllowedError'});await denied.screen.run({action:'open_camera'});await denied.el('camera-start').click();
  const failure=await denied.screen.run({action:'get_state'});
  assert.equal(failure.ok,false);assert.equal(failure.camera,'error');assert.match(failure.description,/non autorisée/);
});

test('YouTube sound status follows the provider on unmute, pause and resume',async()=>{
  const h=harness({screen:true});const opening=h.screen.run({action:'open_youtube',value:'https://www.youtube.com/watch?v=shQJd3oGYn8'});await flush();
  const player=h.players[0];player.emit(1);await opening;
  assert.equal(h.screen.snapshot().sound,'muted');assert.match(h.el('voice-screen-status').textContent,/Son coupé/);
  const settleSound=()=>{for(const[id,fn]of h.timers){h.timers.delete(id);fn();}};
  h.el('voice-screen-sound').click();settleSound();
  assert.equal(h.screen.snapshot().sound,'on');assert.equal(h.el('voice-screen-sound').textContent,'Couper le son');
  player.emit(2);await h.screen.run({action:'resume_media'});player.emit(1);
  assert.match(h.el('voice-screen-status').textContent,/Son activé/);assert.doesNotMatch(h.el('voice-screen-status').textContent,/Son coupé/);
  h.el('voice-screen-sound').click();settleSound();assert.equal(h.screen.snapshot().sound,'muted');
  player.ignoreUnmute=true;h.el('voice-screen-sound').click();settleSound();
  assert.match(h.el('voice-screen-status').textContent,/Son coupé/);assert.equal(h.el('voice-screen-sound').textContent,'Activer le son');
});

test('a small eye keeps the YouTube link and local film without loading the provider',async()=>{
  const h=harness({screen:true,playerSize:170});
  const result=await h.screen.run({action:'open_youtube',value:'https://www.youtube.com/watch?v=shQJd3oGYn8'});
  assert.equal(result.ok,false);assert.equal(h.players.length,0);
  assert.equal(h.el('voice-youtube-external').hidden,false);
  assert.equal(h.el('voice-video-fallback').hidden,false);
});
