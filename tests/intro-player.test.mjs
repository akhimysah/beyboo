import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={window:{},setTimeout,clearTimeout};
vm.runInNewContext(readFileSync(new URL('../public/intro-player.js',import.meta.url),'utf8'),context);
function harness(play){
  const listeners={},states=[],finished=[],timers=new Map();let next=0;
  const video={currentTime:7,muted:true,loop:true,paused:true,ended:false,addEventListener:(n,f)=>listeners[n]=f,pause(){this.paused=true;listeners.pause?.();},play(){this.paused=false;return play?play():Promise.resolve();}};
  const api=context.window.BeybooIntroPlayer.create(video,{state:s=>states.push(s),finish:s=>finished.push(s)},{set:fn=>{timers.set(++next,fn);return next;},clear:id=>timers.delete(id)});
  return {api,video,states,finished,timers,emit:n=>listeners[n](),expire(){const fn=[...timers.values()].at(-1);assert.ok(fn);fn();}};
}
test('opening starts at zero, with sound, once; ending releases the opening once',()=>{
  const h=harness();h.api.open();assert.equal(h.video.currentTime,0);assert.equal(h.video.muted,false);assert.equal(h.video.defaultMuted,false);assert.equal(h.video.loop,false);
  h.emit('playing');h.video.ended=true;h.emit('ended');h.emit('ended');assert.deepEqual(h.finished,['ended']);assert.equal(h.api.isActive(),false);assert.equal(h.timers.size,0);
});
test('blocked autoplay offers a manual start without trapping a visitor who skips',async()=>{
  const h=harness(()=>Promise.reject(Error('NotAllowedError')));h.api.open();await new Promise(setImmediate);assert.equal(h.states.at(-1),'blocked');assert.equal(h.timers.size,0);h.api.close();assert.deepEqual(h.finished,['skip']);
});
test('network error and a stalled video reveal the site',()=>{
  const error=harness();error.api.open();error.emit('error');assert.deepEqual(error.finished,['unavailable']);
  const stalled=harness();stalled.api.open();stalled.emit('playing');stalled.emit('waiting');stalled.expire();assert.deepEqual(stalled.finished,['unavailable']);
});
test('playback progress renews the watchdog but an intentional pause does not',()=>{
  const h=harness();h.api.open();h.emit('playing');const before=[...h.timers.keys()][0];h.video.currentTime=4;h.emit('timeupdate');assert.notEqual([...h.timers.keys()][0],before);
  h.video.pause();h.video.currentTime=4.1;h.emit('timeupdate');assert.equal(h.timers.size,0);assert.equal(h.states.at(-1),'paused');
});
test('a late play resolution after skipping cannot restart hidden audio',async()=>{
  let resolve;const h=harness(()=>new Promise(r=>{resolve=r;}));h.api.open();h.api.close();h.video.paused=false;resolve();await new Promise(setImmediate);assert.equal(h.video.paused,true);assert.deepEqual(h.finished,['skip']);
});
test('a late old play rejection cannot block a new introduction',async()=>{
  let reject,calls=0;const h=harness(()=>++calls===1?new Promise((_,r)=>{reject=r;}):Promise.resolve());h.api.open();h.api.close();h.api.open();h.emit('playing');reject(Error('old'));await new Promise(setImmediate);assert.equal(h.states.at(-1),'playing');assert.equal(h.api.isActive(),true);
});

test('blocked audible autoplay starts muted, then one tap plays the soundtrack from zero',async()=>{
  const attempts=[];
  const h=harness(()=>{attempts.push(h.video.muted);if(attempts.length===1)throw Object.assign(Error(),{name:'NotAllowedError'});});
  await h.api.open();
  assert.deepEqual(attempts,[false,true]);assert.equal(h.api.needsSoundGesture(),true);
  h.video.currentTime=4;await h.api.toggleSound();
  assert.deepEqual(attempts,[false,true,false]);assert.equal(h.video.currentTime,0);assert.equal(h.api.needsSoundGesture(),false);
  h.video.currentTime=6;h.api.toggleSound();assert.equal(h.video.muted,true);
  h.api.toggleSound();assert.equal(h.video.muted,false);assert.equal(h.video.currentTime,6);
});
test('when all autoplay is denied, the play button attempts sound in the user gesture',async()=>{
  let attempts=0;
  const h=harness(()=>{if(++attempts<=2)throw Object.assign(Error(),{name:'NotAllowedError'});});
  await h.api.open();assert.equal(h.states.at(-1),'blocked');assert.equal(h.timers.size,0);
  await h.api.play();assert.equal(h.video.muted,false);assert.equal(attempts,3);
});
test('skipping while audible autoplay is pending cannot start a muted fallback',async()=>{
  let reject,attempts=0;
  const h=harness(()=>{attempts++;return new Promise((_,r)=>{reject=r;});});
  const pending=h.api.open();h.api.close();reject(Object.assign(Error(),{name:'NotAllowedError'}));
  await pending;assert.equal(attempts,1);assert.equal(h.video.paused,true);
});
