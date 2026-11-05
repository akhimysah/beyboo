import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/gaze.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const face=(x,y=.5,size=1)=>({boundingBox:{originX:x*320-20*size,originY:y*240-30*size,width:40*size,height:60*size}});

function harness({secure=true,error=null,pendingCamera=false,pendingModel=false,facing='user',initial=[face(.5)]}={}){
  const styles={},classes=new Set(),events=[],requests=[],streams=[],timers=new Map(),frames=new Map();
  const docEvents={},winEvents={};let clock=1000,id=0,cameraLeft=0,detections=initial,resolveCamera,resolveModel,resolveDetection,pendingDetection=false;
  const eye={hidden:false,dataset:{},style:{setProperty:(k,v)=>styles[k]=v},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)},closest:()=>null,getClientRects:()=>[{}]};
  const video={readyState:2,videoWidth:640,videoHeight:480,currentTime:0,srcObject:null,setAttribute(){},play:async()=>{},pause(){this.paused=true;},remove(){this.mounted=false;}};
  const canvas={width:0,height:0,getContext:()=>({drawImage(){}})};
  const detector={closed:false,close(){this.closed=true;},detectForVideo(){return pendingDetection?new Promise(resolve=>resolveDetection=resolve):Promise.resolve({detections});}};
  const makeStream=()=>{const track={stopped:false,stop(){this.stopped=true;},getSettings:()=>({facingMode:facing}),addEventListener(name,callback){this[name]=callback;}};const stream={track,getTracks:()=>[track],getVideoTracks:()=>[track]};streams.push(stream);return stream;};
  const document={hidden:false,getElementById:()=>eye,createElement:tag=>tag==='video'?video:canvas,body:{appendChild:node=>node.mounted=true},addEventListener:(name,cb)=>docEvents[name]=cb,dispatchEvent:event=>events.push(event)};
  const window={isSecureContext:secure,BeybooCamera:{leave(){cameraLeft++;}},BeybooFaceDetector:{create(){return pendingModel?new Promise(resolve=>resolveModel=resolve):Promise.resolve(detector);}},addEventListener:(name,cb)=>winEvents[name]=cb};
  const navigator={mediaDevices:{getUserMedia(options){requests.push(options);if(error)return Promise.reject({name:error});return pendingCamera?new Promise(resolve=>resolveCamera=resolve):Promise.resolve(makeStream());}}};
  vm.runInNewContext(source,{document,window,navigator,performance:{now:()=>clock},CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},setTimeout:callback=>{const key=++id;timers.set(key,callback);return key;},clearTimeout:key=>timers.delete(key),requestAnimationFrame:callback=>{const key=++id;frames.set(key,callback);return key;},cancelAnimationFrame:key=>frames.delete(key)});
  const frame=async(ms=16)=>{clock+=ms;const entry=frames.entries().next().value;if(entry){frames.delete(entry[0]);entry[1](clock);}await flush();};
  const run=async(next,ms=100)=>{clock+=ms;detections=next;video.currentTime+=.1;const entry=timers.entries().next().value;if(entry){timers.delete(entry[0]);await entry[1]();}await flush();};
  return {api:window.BeybooGaze,eye,video,canvas,detector,document,events,requests,streams,styles,classes,timers,frames,docEvents,winEvents,frame,run,
    cameraLeft:()=>cameraLeft,state:()=>events.at(-1)?.detail.state,advance:ms=>clock+=ms,x:()=>parseFloat(styles['--gaze-x']),y:()=>parseFloat(styles['--gaze-y']),
    resolveCamera:()=>resolveCamera(makeStream()),resolveModel:()=>resolveModel(detector),deferDetection:()=>pendingDetection=true,resolveDetection:next=>resolveDetection({detections:next})};
}

test('gaze starts only on explicit action and requests video without taking the voice microphone',async()=>{
  const h=harness();assert.equal(h.requests.length,0);assert.equal(h.api.isActive(),false);
  await h.api.start();await flush();await h.api.start();
  assert.equal(h.requests.length,1);assert.equal(h.requests[0].audio,false);assert.equal(h.requests[0].video.facingMode.ideal,'user');assert.equal(h.cameraLeft(),1);
  assert.equal(h.api.isActive(),true);assert.equal(h.state(),'tracking');assert.equal(h.classes.has('gaze-active'),true);
  for(const event of h.events){assert.equal(event.type,'beyboo-gaze-state');assert.deepEqual(Object.keys(event.detail).sort(),['message','state']);}
});

test('front-camera gaze mirrors horizontal head movement, smooths and bounds it; rear camera is not mirrored',async()=>{
  const h=harness();await h.api.start();await flush();await h.frame();
  await h.run([face(.65,.6)]);await h.frame(100);
  assert.ok(h.x()<0,'moving right in raw front-camera pixels means left in the mirror');assert.ok(h.y()>0);
  assert.ok(h.x()>-3.15,'a frame approaches the target gradually');
  await h.run([face(.9,.75)]);for(let i=0;i<20;i++)await h.frame(30);
  assert.ok(h.x()>=-7&&h.x()<-5);assert.ok(h.y()>3&&h.y()<=5.5);
  const rear=harness({facing:'environment'});await rear.api.start();await flush();await rear.run([face(.65)]);await rear.frame(100);
  assert.ok(rear.x()>0,'a rear camera keeps the raw coordinate direction');
});

test('a larger bystander does not steal the spatially locked face',async()=>{
  const h=harness({initial:[face(.3)]});await h.api.start();await flush();
  await h.run([face(.75,.5,1.6),face(.35)]);await h.frame(100);
  assert.ok(h.x()<0&&h.x()>-1.1,'nearby original face continues even when a larger face appears');
  await h.run([face(.8,.5,1.7)],1300);for(let i=0;i<15;i++)await h.frame(30);
  assert.equal(h.state(),'searching');assert.ok(Math.abs(h.x())<.02,'missing locked face recenters rather than following bystander immediately');
});

test('missing faces and stalled camera frames recenter with no fabricated pupil motion',async()=>{
  const h=harness();await h.api.start();await flush();await h.run([face(.7)]);for(let i=0;i<10;i++)await h.frame(30);
  assert.ok(Math.abs(h.x())>2);
  // No new video frame or inference result arrives: the same expiry still applies.
  await h.frame(1200);for(let i=0;i<30;i++)await h.frame(30);
  assert.equal(h.state(),'searching');assert.equal(h.x(),0);assert.equal(h.y(),0);
  assert.equal(h.api.recenter(),false);
  await h.run([]);assert.equal(h.x(),0);
});

test('manual calibration resets the center and hidden activities receive no gaze transform',async()=>{
  const h=harness();await h.api.start();await flush();await h.run([face(.67)]);await h.frame(100);
  assert.notEqual(h.x(),0);assert.equal(h.api.recenter(),true);for(let i=0;i<20;i++)await h.frame(30);assert.ok(Math.abs(h.x())<.01);
  await h.run([face(.77)]);h.eye.hidden=true;await h.frame(100);assert.equal(h.x(),0);assert.equal(h.api.isActive(),true);assert.equal(h.streams[0].track.stopped,false);
  h.eye.hidden=false;await h.frame(100);assert.ok(h.x()<0);
});

test('permission can be cancelled and a late camera stream is disposed without detector startup',async()=>{
  const h=harness({pendingCamera:true});const pending=h.api.start();assert.equal(h.api.isActive(),true);assert.equal(h.state(),'requesting');
  h.api.stop();h.resolveCamera();await pending;
  assert.equal(h.streams[0].track.stopped,true);assert.equal(h.video.srcObject,null);assert.equal(h.api.isActive(),false);assert.equal(h.state(),'off');assert.equal(h.timers.size,0);assert.equal(h.frames.size,0);
});

test('late model and inference results cannot revive tracking after cancellation',async()=>{
  const h=harness({pendingModel:true});const pending=h.api.start();await flush();assert.equal(h.state(),'loading');
  h.api.stop();h.resolveModel();await pending;assert.equal(h.detector.closed,true);assert.equal(h.streams[0].track.stopped,true);assert.equal(h.classes.has('gaze-active'),false);
  const active=harness();await active.api.start();await flush();active.deferDetection();const detecting=active.run([face(.7)]);
  active.api.stop();active.resolveDetection([face(.7)]);await detecting;assert.equal(active.state(),'off');assert.equal(active.x(),0);assert.equal(active.timers.size,0);
});

test('visibility loss, page exit and external camera interruption release all local resources',async()=>{
  for(const reason of ['hidden','pagehide','track']){
    const h=harness();await h.api.start();await flush();
    if(reason==='hidden'){h.document.hidden=true;h.docEvents.visibilitychange();}else if(reason==='pagehide')h.winEvents.pagehide();else h.streams[0].track.ended();
    assert.equal(h.api.isActive(),false);assert.equal(h.streams[0].track.stopped,true);assert.equal(h.detector.closed,true);assert.equal(h.video.srcObject,null);assert.equal(h.video.mounted,false);assert.equal(h.canvas.width,0);assert.equal(h.timers.size,0);assert.equal(h.frames.size,0);assert.equal(h.x(),0);
  }
});

test('denied permission and insecure context never claim the face is connected',async()=>{
  const denied=harness({error:'NotAllowedError'});await denied.api.start();assert.equal(denied.state(),'error');assert.equal(denied.api.isActive(),false);assert.match(denied.events.at(-1).detail.message,/non autorisée/);
  const insecure=harness({secure:false});await insecure.api.start();assert.equal(insecure.requests.length,0);assert.equal(insecure.state(),'error');assert.equal(insecure.classes.has('gaze-active'),false);
});
