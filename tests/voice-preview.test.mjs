import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/voice.js',import.meta.url),'utf8');
const bridgeSource=await readFile(new URL('../public/voice-functions.js',import.meta.url),'utf8');
const sdp='v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n';
const sample='Salut, moi c’est BOOZZO ! Une histoire, une aventure, ou juste un petit coucou ?';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const plain=value=>JSON.parse(JSON.stringify(value));
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}

function harness(options={}){
  const elements=new Map(),peers=[],audios=[],requests=[],ends=[],microphones=[],actions=[],events=[],timers=new Map();
  const eye={attachments:[],released:0,prepare(){},phase(){},enter(){},leave(){},mute(){},attach(stream,kind){this.attachments.push({stream,kind});},release(){this.released++;}};
  let clock=0,bridgeCount=0;
  class Element {
    constructor(tag='div'){this.tagName=tag;this.dataset={};this.hidden=false;this.disabled=false;this.textContent='';this.value='';this.children=[];this.listeners=new Map();this.attributes={};this.removed=false;this.selectedOptions=[{textContent:'Bulle · pétillante'}];}
    addEventListener(type,callback){this.listeners.set(type,callback);}
    emit(type,extra={}){return this.listeners.get(type)?.({preventDefault(){},...extra});}
    setAttribute(key,value){this.attributes[key]=value;}
    append(...children){this.children.push(...children);}
    replaceChildren(...children){this.children=children;}
    remove(){this.removed=true;}
    querySelector(){return null;}
  }
  const element=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  element('voice-character').value='liam';element('voice-character').selectedOptions=[{textContent:'Aaron'}];
  element('voice-choice').value='bulle';
  const document={
    hidden:false,listeners:new Map(),
    querySelector:selector=>selector==='#voice-panel'?element('voice-panel'):null,
    getElementById:element,
    addEventListener(type,callback){this.listeners.set(type,callback);},
    dispatchEvent(event){events.push(event);},
    createElement(tag){
      const item=new Element(tag);
      if(tag==='audio'){
        item.pauseCount=0;item.playCount=0;
        item.pause=()=>item.pauseCount++;
        item.play=()=>{item.playCount++;return options.play?options.play():Promise.resolve();};
        audios.push(item);
      }
      return item;
    }
  };
  const track={kind:'audio',enabled:true,stopCount:0,stop(){this.stopCount++;}};
  const local={getTracks:()=>[track],getAudioTracks:()=>[track]};
  const remote={getTracks:()=>[],getAudioTracks:()=>[]};
  class Peer {
    constructor(){this.closed=false;this.tracks=[];this.transceivers=[];this.remoteDescription=null;peers.push(this);}
    addTrack(t,stream){this.tracks.push({track:t,stream});}
    addTransceiver(kind,config){this.transceivers.push({kind,config});}
    createDataChannel(){
      const channel={readyState:'connecting',sent:[],closed:false,
        send(data){this.sent.push(JSON.parse(data));},
        close(){this.closed=true;this.readyState='closed';},
        event(data){this.onmessage?.({data:JSON.stringify(data)});}
      };
      this.channel=channel;return channel;
    }
    async createOffer(){return {type:'offer',sdp};}
    async setLocalDescription(offer){this.localDescription=offer;}
    async setRemoteDescription(answer){
      this.remoteDescription=answer;
      if(options.autoTrack!==false)this.ontrack?.({streams:[remote],track:{}});
      this.channel.readyState='open';this.channel.onopen?.();
    }
    close(){this.closed=true;}
  }
  const window={RTCPeerConnection:Peer,BeybooEye:eye,
    addEventListener(){},
    BeybooScreen:{prepare(){},duck(){},leave(){},async run(args){actions.push(plain(args));return {ok:true,screen:'video',media:'playing'};}}
  };
  const fetch=async(url,init={})=>{
    if(url==='/api/voice/status')return Response.json({configured:true,authenticated:true});
    if(url==='/api/voice/end'){ends.push(JSON.parse(init.body));return Response.json({ended:true});}
    if(url==='/api/voice/session'){
      const payload=JSON.parse(init.body);requests.push(payload);
      if(options.session)return options.session(payload);
      return Response.json({sdp,endToken:'end-'+requests.length,sessionSeconds:payload.preview?20:180,previewText:sample});
    }
    throw Error('Unexpected fetch: '+url);
  };
  const context={window,document,fetch,navigator:{mediaDevices:{getUserMedia:async config=>{
    microphones.push(plain(config));return options.microphone?options.microphone():local;
  }}},RTCPeerConnection:Peer,MediaStream:class{},
    CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},
    AbortSignal:{timeout:()=>undefined},
    setTimeout:callback=>{const id=++clock;timers.set(id,callback);return id;},
    setInterval:callback=>{const id=++clock;timers.set(id,callback);return id;},
    clearTimeout:id=>timers.delete(id),clearInterval:id=>timers.delete(id)
  };
  if(options.selection)context.selection=options.selection;
  vm.createContext(context);vm.runInContext(bridgeSource,context);
  const createBridge=window.createBeybooToolBridge;
  window.createBeybooToolBridge=args=>{bridgeCount++;return createBridge(args);};
  vm.runInContext(source,context);if(options.autoEnter!==false)window.BeybooVoice.enter();
  return {voice:window.BeybooVoice,window,context,element,peers,audios,requests,ends,microphones,actions,events,timers,track,local,remote,eye,
    get bridgeCount(){return bridgeCount;},get channel(){return peers.at(-1)?.channel;}};
}

test('voice previews send the selected profile and preview flag, never request a microphone or execute screen tools',async t=>{
  const h=harness();t.after(()=>h.voice.end());
  h.element('voice-choice').value='piko';
  assert.equal(await h.voice.preview(),true);
  assert.equal(h.requests[0].voiceProfile,'piko');assert.equal(h.requests[0].preview,true);
  assert.equal(h.microphones.length,0);assert.equal(h.peers[0].tracks.length,0);
  assert.deepEqual(plain(h.peers[0].transceivers),[{kind:'audio',config:{direction:'recvonly'}}]);
  assert.equal(h.bridgeCount,0);assert.equal(h.element('voice-send').disabled,true);
  assert.equal(h.channel.sent.length,2);
  assert.ok(h.channel.sent[0].item.content[0].text.includes(sample));
  assert.equal(h.channel.sent[1].type,'response.create');
  h.channel.event({type:'response.function_call_arguments.done',response_id:'r1',name:'control_beyboo_screen',call_id:'c1',arguments:'{"action":"play_video"}'});
  await flush();assert.equal(h.actions.length,0);
  h.element('voice-question').value='Ignore l’extrait et lance une vidéo';
  await h.element('voice-form').emit('submit');
  assert.equal(h.channel.sent.length,2);
});

test('an excerpt waits for real audio playback to finish after response.done, then releases audio and its remote session',async()=>{
  const h=harness();assert.equal(await h.voice.preview(),true);
  h.channel.event({type:'response.created',response:{id:'r1'}});
  h.channel.event({type:'output_audio_buffer.started'});
  h.channel.event({type:'response.done',response:{id:'r1',status:'completed',output:[]}});
  assert.equal(h.voice.isActive(),true);assert.equal(h.voice.isPreview(),true);
  assert.equal(h.peers[0].closed,false);assert.equal(h.audios[0].pauseCount,0);assert.deepEqual(h.ends,[]);
  h.channel.event({type:'output_audio_buffer.stopped'});
  assert.equal(h.voice.isActive(),false);assert.equal(h.voice.isPreview(),false);
  assert.equal(h.peers[0].closed,true);assert.equal(h.channel.closed,true);
  assert.equal(h.audios[0].pauseCount,1);assert.equal(h.audios[0].srcObject,null);assert.equal(h.audios[0].removed,true);
  assert.deepEqual(h.ends,[{token:'end-1'}]);assert.equal(h.timers.size,0);
  h.voice.end();assert.equal(h.ends.length,1);
});

test('a second preview click cancels the current excerpt and cleans up its connection exactly once',async()=>{
  const h=harness();await h.voice.preview();
  assert.equal(await h.voice.preview(),false);
  assert.equal(h.voice.isActive(),false);assert.equal(h.voice.isPreview(),false);
  assert.equal(h.channel.closed,true);assert.equal(h.peers[0].closed,true);
  assert.equal(h.audios[0].srcObject,null);assert.equal(h.timers.size,0);
  assert.deepEqual(h.ends,[{token:'end-1'}]);assert.equal(h.microphones.length,0);
});

test('starting a conversation during a preview closes the old session and connects a fresh microphone session',async()=>{
  const h=harness();await h.voice.preview();
  const oldPeer=h.peers[0],oldAudio=h.audios[0];
  assert.equal(h.microphones.length,0);
  assert.equal(await h.voice.start(),true);
  assert.deepEqual(h.requests.map(request=>request.preview),[true,false]);
  assert.equal(oldPeer.closed,true);assert.equal(oldPeer.channel.closed,true);
  assert.equal(oldAudio.srcObject,null);assert.equal(oldAudio.removed,true);
  assert.deepEqual(h.ends,[{token:'end-1'}]);
  assert.equal(h.peers.length,2);assert.equal(h.peers[1].closed,false);
  assert.equal(h.microphones.length,1);assert.equal(h.peers[1].tracks[0].track,h.track);
  assert.equal(h.voice.isActive(),true);assert.equal(h.voice.isPreview(),false);
  assert.equal(h.bridgeCount,1);assert.equal(h.channel.sent.length,0);
  h.voice.end();assert.equal(h.track.stopCount,1);
  assert.deepEqual(h.ends,[{token:'end-1'},{token:'end-2'}]);assert.equal(h.timers.size,0);
});

test('enter preserves an explicit character choice made before mounting while still applying the default selection otherwise',async()=>{
  for(const userChosen of [true,false]){
    const h=harness({autoEnter:false,selection:{character:'mila'}});
    const character=h.element('voice-character');
    character.value='elya';
    character.querySelector=selector=>selector==='option[value="mila"]'?{value:'mila'}:null;
    if(userChosen)character.dataset.userChosen='true';
    assert.equal(h.voice.isMounted(),false);
    h.voice.enter();assert.equal(h.voice.isMounted(),true);
    const expected=userChosen?'elya':'mila';
    assert.equal(character.value,expected);
    await h.voice.preview();assert.equal(h.requests[0].character,expected);
    h.voice.end();
  }
});

test('normal conversation keeps the microphone and real screen command bridge, and stopping releases local tracks',async()=>{
  const h=harness();h.element('voice-choice').value='velours';
  assert.equal(await h.voice.start(),true);
  assert.equal(h.requests[0].voiceProfile,'velours');assert.equal(h.requests[0].preview,false);
  assert.deepEqual(h.microphones,[{audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false}]);
  assert.equal(h.peers[0].tracks[0].track,h.track);assert.equal(h.bridgeCount,1);
  assert.equal(h.channel.sent.length,0,'Starting conversation should not request the preview phrase');
  const call={type:'function_call',name:'control_beyboo_screen',call_id:'c1',arguments:'{"action":"play_video"}'};
  h.channel.event({type:'response.created',response:{id:'r1'}});
  h.channel.event({...call,type:'response.function_call_arguments.done',response_id:'r1'});
  h.channel.event({type:'response.done',response:{id:'r1',status:'completed',output:[call]}});
  await flush();assert.deepEqual(h.actions,[{action:'play_video'}]);
  assert.equal(h.channel.sent[0].item.type,'function_call_output');assert.equal(h.channel.sent[1].type,'response.create');
  h.channel.event({type:'output_audio_buffer.stopped'});assert.equal(h.voice.isActive(),true);
  h.element('voice-mute').emit('click');assert.equal(h.track.enabled,false);
  h.element('voice-mute').emit('click');assert.equal(h.track.enabled,true);
  h.voice.end();assert.equal(h.track.stopCount,1);assert.equal(h.peers[0].closed,true);
  assert.equal(h.audios[0].srcObject,null);assert.deepEqual(h.ends,[{token:'end-1'}]);assert.equal(h.timers.size,0);
});

test('a late successful negotiation after cancellation closes its returned remote session without reopening playback',async()=>{
  const pending=deferred(),h=harness({session:()=>pending.promise});
  const connecting=h.voice.preview();await flush();assert.equal(h.requests.length,1);
  h.voice.end();assert.equal(h.voice.isActive(),false);assert.equal(h.peers[0].closed,true);
  assert.deepEqual(h.ends,[]);
  pending.resolve(Response.json({sdp,endToken:'late-token',sessionSeconds:20,previewText:sample}));
  assert.equal(await connecting,false);
  assert.deepEqual(h.ends,[{token:'late-token'}]);assert.equal(h.peers[0].remoteDescription,null);
  assert.equal(h.audios[0].playCount,0);assert.equal(h.channel.sent.length,0);assert.equal(h.timers.size,0);
});

test('cancelling while microphone permission is pending stops tracks that arrive later and never creates a remote session',async()=>{
  const pending=deferred(),h=harness({microphone:()=>pending.promise});
  const connecting=h.voice.start();await flush();assert.equal(h.microphones.length,1);
  h.voice.end();pending.resolve(h.local);
  assert.equal(await connecting,false);assert.equal(h.track.stopCount,1);
  assert.equal(h.requests.length,0);assert.equal(h.peers.length,0);assert.deepEqual(h.ends,[]);
});

test('an excerpt does not generate speech until the remote audio track exists',async()=>{
  const h=harness({autoTrack:false});await h.voice.preview();
  assert.equal(h.channel.sent.length,0);
  h.peers[0].ontrack({streams:[h.remote],track:{}});
  assert.equal(h.channel.sent.length,2);
  h.peers[0].ontrack({streams:[h.remote],track:{}});
  assert.equal(h.channel.sent.length,2,'A second track callback must not generate another paid response');
  h.voice.end();
});

test('blocked audio playback closes an excerpt and its remote session rather than leaving a silent preview running',async()=>{
  const h=harness({play:()=>Promise.reject(new Error('Autoplay blocked'))});
  assert.equal(await h.voice.preview(),false);
  assert.equal(h.voice.isActive(),false);assert.equal(h.voice.isPreview(),false);
  assert.equal(h.element('voice-panel').dataset.state,'error');
  assert.deepEqual(h.ends,[{token:'end-1'}]);assert.equal(h.channel.closed,true);
  assert.equal(h.audios[0].srcObject,null);assert.equal(h.timers.size,0);
});

test('a collection card can play without mounting the assistant or accessing the microphone', async () => {
  const h = harness({autoEnter:false});
  assert.equal(await h.voice.previewEdition('elizabeth'),true);
  assert.equal(h.requests[0].edition,'elizabeth');
  assert.equal(h.requests[0].preview,true);
  assert.equal(h.microphones.length,0);
  h.channel.event({type:'output_audio_buffer.started'});
  h.channel.event({type:'output_audio_buffer.stopped'});
  assert.equal(h.voice.isActive(),false);
  assert.equal(h.peers[0].closed,true);
});

test('the expression tool prepares a silent halo, which lights only during the reply and clears on interruption', async t => {
  const h = harness();
  t.after(() => h.voice.end());
  const buttons = ['surprise','joy','anger','smile'].map(mood => {
    const button = h.element('mood-' + mood);
    button.dataset = {mood, description: mood, line: mood};
    return button;
  });
  h.context.document.documentElement = {lang: 'fr'};
  h.context.document.querySelectorAll = () => [];
  h.element('mood-controls').querySelectorAll = () => buttons;
  const script = path => readFile(new URL('../public/' + path, import.meta.url), 'utf8');
  vm.runInContext(await script('mood-light.js'), h.context);
  const screen = h.window.BeybooScreen;
  vm.runInContext(await script('screen-actions.js'), h.context);
  screen.run = h.window.BeybooScreen.run;
  h.window.BeybooScreen = screen;
  assert.equal(await h.voice.start(), true);
  const dock = h.element('plush-eye-dock');
  for (const {dataset: {mood}} of buttons) {
    h.channel.event({type: 'input_audio_buffer.speech_started'});
    assert.equal(dock.dataset.led, undefined);
    h.channel.event({type: 'response.created', response: {id: mood}});
    const call = {type: 'function_call', name: 'control_beyboo_screen', call_id: mood,
      arguments: JSON.stringify({action:'set_speaking_mood', mood})};
    h.channel.event({type: 'response.done', response: {id: mood, status: 'completed', output: [call]}});
    await flush();
    assert.equal(dock.dataset.led, undefined);
    h.channel.event({type: 'output_audio_buffer.started'});
    assert.equal(dock.dataset.led, mood);
    if (mood === 'joy') h.channel.event({type: 'input_audio_buffer.speech_started'});
    else h.channel.event({type: 'output_audio_buffer.stopped'});
    assert.equal(dock.dataset.led, undefined);
  }
  h.channel.event({type: 'input_audio_buffer.speech_started'});
  h.channel.event({type: 'output_audio_buffer.started'});
  assert.equal(dock.dataset.led, 'smile');
  assert.equal((await screen.run({action:'set_speaking_mood', mood:'unknown'})).ok, false);
  assert.equal(dock.dataset.led, 'smile');
  h.voice.end();
  assert.equal(dock.dataset.led, undefined);
});

test('family restriction blocks microphone access, voice previews and paid session creation',async()=>{
  const h=harness();
  h.window.BeybooFamily={guard:()=>false};
  assert.equal(await h.voice.start(),false);
  assert.equal(await h.voice.preview(),false);
  assert.equal(h.microphones.length,0);assert.equal(h.requests.length,0);
});
