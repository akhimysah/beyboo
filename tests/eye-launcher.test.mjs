import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../public/eye-launcher.js',import.meta.url),'utf8');
const tools = JSON.parse(await readFile(new URL('../public/voice-tools.json',import.meta.url),'utf8'));
const screenSources = await Promise.all(['screen-actions.js','en/screen-actions.js'].map(name=>readFile(new URL('../public/'+name,import.meta.url),'utf8')));
const commands = await readFile(new URL('../public/eye-commands.js',import.meta.url),'utf8');

/* A tiny DOM: enough for the launcher markup, its buttons and the live status bar. */
function harness(lang='fr', {online=true, battery=null, unread=0}={}) {
  const runs=[], listeners={}, intervals=[], docListeners={};
  let now=new Date(2026,10,5,10,9,0).getTime();
  class FakeDate extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return now;} }
  function node(html){
    const buttons=[...html.matchAll(/<button[^>]*?(?:data-home-app="([^"]+)"|data-home-nav="([^"]+)"|data-home-go="([^"]+)")[^>]*>/g)].map(m=>({
      dataset:{homeApp:m[1],homeNav:m[2],homeGo:m[3]},closest(){return this;},tag:'button'
    }));
    const root={isConnected:true,html,buttons,handlers:{},
      querySelector(selector){
        if(selector==='.eye-home')return html.includes('class="eye-home')?root:null;
        if(selector==='.eye-home-time')return root.time;
        if(selector==='.eye-wifi')return root.wifi;
        if(selector==='.eye-battery-level')return root.level;
        if(selector==='[data-home-app="messages"]')return html.includes('data-home-app="messages"')?root.tile:null;
        if(selector==='.eye-app-badge')return html.includes('eye-app-badge')?root.badge:null;
        return null;
      },
      tile:{attrs:{},setAttribute(key,value){this.attrs[key]=value;}},
      badge:{hidden:!html.includes('class="eye-app-badge" aria-hidden="true">'),textContent:(html.match(/eye-app-badge"[^>]*>([^<]*)</)||[])[1]},
      addEventListener(name,fn){root.handlers[name]=fn;},
      contains(){return true;},
      time:{textContent:(html.match(/eye-home-time">([^<]+)</)||[])[1]},
      wifi:{classes:new Set(),classList:{toggle(name,value){value?root.wifi.classes.add(name):root.wifi.classes.delete(name);}}},
      level:{width:'13',setAttribute(key,value){this[key]=value;}}
    };
    return root;
  }
  const window={listeners,addEventListener(name,fn){listeners[name]=fn;},removeEventListener(name){delete listeners[name];}};
  const messages={count:unread};
  window.BeybooMessages={unread:()=>messages.count};
  const document={documentElement:{lang},addEventListener(name,fn){docListeners[name]=fn;},removeEventListener(name){delete docListeners[name];}};
  const navigator={onLine:online,...(battery?{getBattery:()=>Promise.resolve(battery)}:{})};
  vm.runInNewContext(source,{document,window,navigator,Intl,Date:FakeDate,
    setInterval(fn){intervals.push(fn);return intervals.length;},clearInterval(){}});
  const launcher=window.BeybooLauncher;
  const run=command=>{runs.push(command);return Promise.resolve({ok:true});};
  function open(value){
    const stage=node(launcher.markup(value));
    launcher.mount(stage,run);
    return {stage,click(match){const button=stage.buttons.find(b=>b.dataset.homeApp===match||b.dataset.homeNav===match||b.dataset.homeGo===match);assert.ok(button,match);return stage.handlers.click({target:button});}};
  }
  return {launcher,runs,window,open,intervals,messages,docListeners,tick(seconds){now+=seconds*1000;intervals.forEach(fn=>fn());}};
}

test('the home screen lists the six apps with a live status bar, in both languages; Messages is real, not a brand concept',()=>{
  for (const [lang,label,homeLabel] of [['fr','Appels','Revenir au regard'],['en','Calls','Back to the eye']]) {
    const h=harness(lang);
    const html=h.launcher.markup();
    for (const app of ['messages','youtube','spotify','calls','photo','assistant']) assert.ok(html.includes('data-home-app="'+app+'"'),app);
    assert.ok(html.includes('>'+label+'<'));
    assert.ok(html.includes('aria-label="'+homeLabel+'"'));
    assert.ok(html.includes('eye-home-time">10:09<'));
    assert.ok(html.includes('data-home-nav="mic"'));
    assert.match(html,/data-home-app="messages" aria-label="Messages"><span class="eye-app eye-app-messages">/);
    assert.match(html,/class="eye-app-badge" aria-hidden="true" hidden>/);
    assert.doesNotMatch(html,/whatsapp/i);
    assert.match(html,/data-home-app="spotify" data-concept="true"/);
    assert.equal(h.launcher.has(''),true);assert.equal(h.launcher.has('spotify'),true);assert.equal(h.launcher.has('whatsapp'),false);assert.equal(h.launcher.has('netflix'),false);
  }
});

test('the Messages tile carries the unread count and follows the beyboo-messages event while the home screen is live',()=>{
  const h=harness('fr',{unread:3});
  const html=h.launcher.markup();
  assert.match(html,/data-home-app="messages" aria-label="Messages · 3 non lus"/);
  assert.match(html,/class="eye-app-badge" aria-hidden="true">3</);
  const home=h.open();
  assert.equal(home.stage.badge.hidden,false);
  h.messages.count=0;h.docListeners['beyboo-messages']();
  assert.equal(home.stage.badge.hidden,true);assert.equal(home.stage.badge.textContent,'');
  assert.equal(home.stage.tile.attrs['aria-label'],'Messages');
  h.messages.count=120;h.docListeners['beyboo-messages']();
  assert.equal(home.stage.badge.textContent,'99+');
  home.stage.isConnected=false;h.docListeners['beyboo-messages']();
  assert.equal(h.docListeners['beyboo-messages'],undefined,'the listener leaves with the screen');
  assert.equal(harness('en',{unread:1}).launcher.markup().includes('aria-label="Messages · 1 unread"'),true);
});

test('tiles route to real activities; Spotify opens an honest concept screen with a working alternative',async()=>{
  const h=harness('fr');
  const calls=[];
  h.window.BeybooCompanion={speak(){calls.push('speak');},home(){calls.push('home');},refresh(){calls.push('refresh');}};
  const home=h.open();
  await home.click('youtube');await home.click('photo');await home.click('messages');await home.click('spotify');
  assert.equal(JSON.stringify(h.runs),JSON.stringify([{action:'open_youtube',value:'catalog'},{action:'open_camera'},{action:'open_messages'},{action:'open_home',value:'spotify'}]));
  await home.click('assistant');await home.click('mic');await home.click('home');
  assert.deepEqual(calls,['speak','speak','home']);
  const spotify=h.open('spotify');
  assert.match(spotify.stage.html,/Spotify n’est pas intégré/);
  await spotify.click('music');await spotify.click('back');
  assert.equal(JSON.stringify(h.runs.slice(-2)),JSON.stringify([{action:'play_music',value:'catalog'},{action:'open_home'}]));
  assert.match(h.launcher.message('spotify'),/concept, non intégré/);
  assert.match(h.launcher.message(),/sans partenariat/);
});

test('the status bar follows the device clock, the connection and the battery, and stops when the screen changes',async()=>{
  const battery={level:.5,listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},removeEventListener(name){delete this.listeners[name];}};
  const h=harness('en',{online:false,battery});
  const home=h.open();
  assert.ok(home.stage.wifi.classes.has('is-off'));
  await Promise.resolve();await Promise.resolve();
  assert.equal(home.stage.level.width,'7');
  h.tick(60);
  assert.equal(home.stage.time.textContent,'10:10');
  home.stage.isConnected=false;
  h.tick(60);
  assert.equal(home.stage.time.textContent,'10:10');
  assert.equal(h.window.listeners.online,undefined);
});

test('the AI tool, both screen controllers and the local commands all know the home and messages actions',()=>{
  assert.ok(tools[0].parameters.properties.action.enum.includes('open_home'));
  assert.ok(tools[0].parameters.properties.action.enum.includes('open_messages'));
  assert.match(tools[0].description,/open_home/);
  assert.match(tools[0].description,/open_messages[^.]*messages de la famille/);
  assert.match(tools[0].description,/jamais le texte/);
  assert.doesNotMatch(tools[0].description,/WhatsApp/);
  for (const screen of screenSources) {
    assert.match(screen,/'open_messages','get_state','open_home'\]/);
    assert.match(screen,/action==='open_home'/);
    assert.match(screen,/launcher\.mount\(stage,run\)/);
    assert.match(screen,/action==='open_messages'/);
    assert.match(screen,/open_messages:'messages'/);
    assert.match(screen,/messages\.open\(stage,say\)/);
    assert.match(screen,/unreadMessages:window\.BeybooMessages\.unread\(\)/);
  }
  const element=id=>({value:'',hidden:false,setAttribute(){},addEventListener(){}});
  const window={addEventListener(){},BeybooVoice:{isActive:()=>false,isMounted:()=>true},BeybooScreen:{run:async()=>({})}};
  vm.runInNewContext(commands,{document:{documentElement:{lang:'fr'},getElementById:element,addEventListener(){}},window});
  for (const phrase of ['ouvre le menu','retour à l’accueil','montre les applications','open the home screen']) assert.equal(window.BeybooDevice.command(phrase)?.action,'open_home',phrase);
  for (const phrase of ['messages','ouvre les messages','Montre la messagerie','open messages','Open my messages']) assert.equal(window.BeybooDevice.command(phrase)?.action,'open_messages',phrase);
  assert.equal(window.BeybooDevice.command('n’ouvre pas les messages'),null);
  assert.equal(window.BeybooDevice.command('mets en pause').action,'pause_media');
  assert.equal(window.BeybooDevice.command('appelle mamie').action,'open_call');
});
