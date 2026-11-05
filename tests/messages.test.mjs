import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../public/messages.js',import.meta.url),'utf8');
const ME='a'.repeat(32), PAPA='b'.repeat(32), MAMIE='c'.repeat(32);

/* A minimal page: no screen is mounted, so only the background behaviour (unread count, notification event, AI state) runs. */
function harness(lang='fr',{saved=[]}={}) {
  const docListeners={}, events=[], sent=[], data=new Map(saved), roomListeners=new Map();
  class CustomEvent { constructor(type,init){this.type=type;this.detail=init?.detail;} }
  const document={documentElement:{lang},hidden:false,addEventListener(name,fn){docListeners[name]=fn;},dispatchEvent(event){events.push(event);}};
  const room={
    member:()=>ME, name:()=>'Moi', status:()=>'open', connected:0,
    on(type,fn){if(!roomListeners.has(type))roomListeners.set(type,new Set());roomListeners.get(type).add(fn);return ()=>roomListeners.get(type).delete(fn);},
    send(payload){sent.push(payload);return true;}, connect(){room.connected++;},
    api:async()=>({ok:true,offline:false,response:{status:200},data:{messages:[]}}), signedIn:async()=>({authenticated:false})
  };
  const window={BeybooRoom:room};
  vm.runInNewContext(source,{document,window,localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v))},CustomEvent,Intl,Date,Number,Math,Map,Set,JSON,String,Array,matchMedia:()=>({matches:false}),setTimeout,clearTimeout});
  return {api:window.BeybooMessages,events,sent,data,docListeners,room};
}

test('pure helpers: text limits, times, presence, typing and connection labels in both languages',()=>{
  const fr=harness('fr').api.helpers, en=harness('en').api.helpers;
  assert.equal(fr.validText('  Coucou \u0007 toi  '),'Coucou  toi');
  assert.equal(fr.validText(''),'');assert.equal(fr.validText('   '),'');assert.equal(fr.validText('x'.repeat(1001)),'');assert.equal(fr.validText('x'.repeat(1000)).length,1000);
  const noon=new Date(2026,10,5,12,34).getTime();
  assert.equal(fr.timeLabel(noon,noon+3600000),'12:34');
  assert.match(fr.timeLabel(noon,noon+3*86400000),/nov\. · 12:34$/);
  assert.match(en.timeLabel(noon,noon+3*86400000),/Nov · 12:34$/);
  assert.equal(fr.timeLabel('nope'),'');
  const peers=[{member:ME,name:'Moi'},{member:PAPA,name:'Papa'},{member:PAPA,name:'Papa'},{member:MAMIE,name:'Mamie'}];
  assert.equal(fr.presenceLabel(peers,ME),'En ligne : Papa, Mamie');
  assert.equal(en.presenceLabel([{member:ME,name:'Me'}],ME),'No one else online');
  assert.equal(fr.typingLabel([]),'');assert.equal(fr.typingLabel(['Papa']),'Papa écrit…');assert.equal(en.typingLabel(['Dad','Gran']),'Dad and Gran are typing…');
  assert.equal(fr.statusLabel('open'),'En direct');assert.equal(en.statusLabel('closed'),'Reconnecting…');assert.equal(fr.statusLabel('unauthorized'),'Code famille requis.');
});

test('messages that arrive while the Messages screen is closed count as unread, notify the home tile, and never expose their text to the AI',()=>{
  const h=harness('fr');
  const {ingest,markSeen}=h.api.helpers;
  assert.equal(ingest({id:1,member:ME,name:'Moi',kind:'text',body:'de moi',created:Date.now()}),true);
  assert.equal(h.api.unread(),0,'my own messages are never unread');
  assert.equal(ingest({id:2,member:PAPA,name:'Papa',kind:'text',body:'Secret de famille',created:Date.now()},{live:true}),true);
  assert.equal(ingest({id:2,member:PAPA,name:'Papa',kind:'text',body:'Secret de famille',created:Date.now()}),false,'duplicates are ignored');
  assert.equal(ingest({id:3,member:MAMIE,name:'Mamie',kind:'emoji',body:'❤️',created:Date.now()}),true);
  assert.equal(h.api.unread(),2);assert.equal(h.api.lastSender(),'Mamie');
  assert.deepEqual(h.events.map(e=>e.type),['beyboo-messages','beyboo-messages']);
  assert.equal(JSON.stringify(h.events.at(-1).detail),JSON.stringify({unread:2,lastSender:'Mamie'}));
  const state=h.api.state();
  assert.equal(state.screen,'messages');assert.equal(state.unreadMessages,2);assert.equal(state.lastSender,'Mamie');
  assert.doesNotMatch(JSON.stringify(state),/Secret de famille|❤️/,'get_state never carries message bodies');
  assert.equal(h.api.isOpen(),false);
  markSeen();
  assert.equal(h.api.unread(),0);assert.equal(h.data.get('beyboo.messages.seen.v1'),'3');
  assert.equal(JSON.stringify(h.events.at(-1).detail),JSON.stringify({unread:0,lastSender:'Mamie'}));
  assert.equal(ingest({id:3,member:PAPA,name:'Papa',kind:'text',body:'déjà vu',created:Date.now()}),false);
  assert.equal(h.api.unread(),0);
  assert.equal(ingest({id:2,member:PAPA,name:'Papa',kind:'text',body:'ancien',created:Date.now()}),false);
});

test('the last seen message survives reloads, so older history is not re-announced',()=>{
  const h=harness('fr',{saved:[['beyboo.messages.seen.v1','40']]});
  const {ingest}=h.api.helpers;
  ingest({id:39,member:PAPA,name:'Papa',kind:'text',body:'vu',created:Date.now()});
  ingest({id:40,member:PAPA,name:'Papa',kind:'text',body:'vu aussi',created:Date.now()});
  assert.equal(h.api.unread(),0);
  ingest({id:41,member:PAPA,name:'Papa',kind:'text',body:'nouveau',created:Date.now()});
  assert.equal(h.api.unread(),1);assert.equal(h.api.lastSender(),'Papa');
  assert.equal(h.room.connected,0,'no socket is opened until the family code is known');
  assert.equal(h.sent.length,0);
});

test('the eye markup and spoken status are bilingual and name the family, not a brand',()=>{
  for(const [lang,label,loading] of [['fr','Messages de la famille','Chargement des messages…'],['en','Family messages','Loading messages…']]){
    const h=harness(lang);
    assert.match(h.api.markup(),new RegExp('class="msg-screen" role="group" aria-label="'+label+'"'));
    assert.match(h.api.markup(),/class="msg-presence" aria-live="polite"/);
    assert.equal(h.api.message(),loading);
    assert.doesNotMatch(h.api.markup(),/whatsapp/i);
  }
});
