import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/voice-functions.js',import.meta.url),'utf8');
function harness(execute=async args=>({ok:true,action:args.action})){
  const window={},sent=[];let current=true,followups=0;
  vm.runInNewContext(source,{window,Map,Promise,JSON});
  const bridge=window.createBeybooToolBridge({send:e=>sent.push(e),execute,isCurrent:()=>current,onFollowup:()=>followups++});
  return {bridge,sent,close:()=>current=false,get followups(){return followups;}};
}
const call={type:'function_call',name:'control_beyboo_screen',call_id:'c1',arguments:'{"action":"play_video"}'};
const created={type:'response.created',response:{id:'r1'}};
const ready={type:'response.function_call_arguments.done',response_id:'r1',...call,type:'response.function_call_arguments.done'};
const done={type:'response.done',response:{id:'r1',status:'completed',output:[call]}};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('executes immediately once and waits for both completion and real action result before speaking',async()=>{
  let count=0,resolveAction;const h=harness(()=>{count++;return new Promise(r=>resolveAction=r);});
  h.bridge.handle(created);h.bridge.handle(ready);await flush();assert.equal(count,1);assert.equal(h.sent.length,0);
  h.bridge.handle(done);await flush();assert.equal(count,1);assert.equal(h.followups,0);
  resolveAction({ok:true,screen:'video',media:'playing'});await flush();
  assert.equal(h.sent[0].item.type,'function_call_output');
  assert.equal(JSON.parse(h.sent[0].item.output).media,'playing');
  assert.equal(h.sent[1].type,'response.create');assert.equal(h.followups,1);
  h.bridge.handle(done);await flush();assert.equal(h.followups,1);
});
test('response.done alone still executes tools and invalid arguments report failure',async()=>{
  const h=harness();h.bridge.handle(created);h.bridge.handle(done);await flush();assert.equal(h.followups,1);
  const bad=harness();bad.bridge.handle({...done,response:{...done.response,output:[{...call,arguments:'broken'}]}});await flush();
  assert.equal(JSON.parse(bad.sent[0].item.output).ok,false);
});
test('a new utterance suppresses stale follow-up speech, and disposal suppresses late output',async()=>{
  for(const dispose of [false,true]){
    let resolveAction;const h=harness(()=>new Promise(r=>resolveAction=r));
    h.bridge.handle(created);h.bridge.handle(ready);h.bridge.handle(done);await flush();
    if(dispose)h.bridge.dispose();else h.bridge.interrupt();
    resolveAction({ok:true});await flush();assert.equal(h.followups,0);
    assert.equal(h.sent.length,dispose?0:1);
  }
});
test('late calls from an interrupted response do not mutate the screen',async()=>{
  let count=0;const h=harness(async()=>{count++;return {ok:true};});
  h.bridge.handle(created);h.bridge.interrupt();h.bridge.handle(ready);h.bridge.handle(done);await flush();
  assert.equal(count,0);assert.equal(JSON.parse(h.sent[0].item.output).cancelled,true);assert.equal(h.followups,0);
});
