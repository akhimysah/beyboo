import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {weatherRequest} from '../lib/weather.mjs';
const source = await readFile(new URL('../public/eye-commands.js',import.meta.url),'utf8');
function controls(lang) {
  const elements=new Map(), calls=[], network=[];
  const element=id=>{
    if(!elements.has(id))elements.set(id,{value:'',listeners:{},setAttribute(){},addEventListener(k,fn){this.listeners[k]=fn;}});
    return elements.get(id);
  };
  const document={documentElement:{lang},getElementById:element,addEventListener(){}};
  const window={addEventListener(){},BeybooVoice:{isActive:()=>false,isMounted:()=>true},BeybooScreen:{async run(cmd){calls.push(cmd);return {description:'OK'};}}};
  vm.runInNewContext(source,{document,window,fetch:url=>network.push(url)});
  return {element,calls,network,device:window.BeybooDevice};
}
test('device actions remain separate from paid AI, and dictation is optional',async()=>{
  for(const [locale,math,weather,moon] of [['fr','Ouvre un calcul','Météo à Londres','vidéo sur la Lune'],['en','Open maths','Weather in London','YouTube video about the Moon']]){
    const h=controls(locale);
    for(const text of [math,weather,moon]){
      h.element('device-command-input').value=text;h.element('device-command-form').listeners.submit({preventDefault(){}});
    }
    assert.equal(h.element('device-command-mic').hidden,true);
    assert.deepEqual(h.calls.map(c=>c.action),['open_math','open_weather','open_youtube']);
    assert.equal(h.calls[1].value,'london');
    assert.equal(h.calls[2].value.split('=').pop(),locale==='fr'?'HPFXqqe971I':'w4U_cuF-_hI');
    assert.equal(h.device.command('pause YouTube').action,'pause_media');
    assert.equal(h.device.command('ne lance pas YouTube'),null);assert.equal(h.network.length,0);
  }
});
const req=city=>new Request('https://beyboo.test/api/weather?city='+city);
test('weather uses city centres, shares pending lookups, honours expiry and reports failures',async()=>{
  let calls=0;
  const upstream=async(url,opts)=>{
    calls++;assert.match(url,/lat=48.86&lon=2.35$/);assert.ok(opts.headers['User-Agent'].includes('BOOZZO'));
    return Response.json({properties:{timeseries:[{time:new Date().toISOString(),data:{instant:{details:{air_temperature:10.6}},next_1_hours:{summary:{symbol_code:'cloudy'}}}}]}},{headers:{Expires:new Date(Date.now()+3600000).toUTCString()}});
  };
  const results=await Promise.all([weatherRequest(req('paris'),upstream),weatherRequest(req('paris'),upstream)]);
  assert.equal((await results[0].json()).temperature,11);assert.equal((await results[1].json()).symbol,'cloudy');
  await weatherRequest(req('paris'),upstream);assert.equal(calls,1);
  assert.equal((await weatherRequest(req('private-location'),upstream)).status,400);
  assert.equal((await weatherRequest(req('dakar'),async()=>new Response(null,{status:503}))).status,503);
  assert.equal((await weatherRequest(req('dakar'),async()=>Response.json({properties:{timeseries:[]}}))).status,503);
});
test('YouTube search works without a key as a curated shelf; configured searches require a site member',async()=>{
  const {searchVideos,resetVideoCache}=await import('../lib/video-search.mjs');
  const request=(user,origin='https://beyboo.test')=>new Request('https://beyboo.test/api/videos/search',{method:'POST',headers:{origin,...(user?{'oai-authenticated-user-id':user}:{})},body:JSON.stringify({query:'écureuil',lang:'fr'})});
  const env={YOUTUBE_DATA_API_KEY:'test-only'};
  assert.equal((await searchVideos(request(''),{})).status,401);
  assert.equal((await searchVideos(request(''),env)).status,401);
  assert.equal((await searchVideos(request('owner','https://other.test'),env)).status,403);
  const result=await searchVideos(request('owner'),env,async(url,options)=>{
    assert.equal(url.searchParams.get('safeSearch'),'strict');assert.equal(url.searchParams.get('videoEmbeddable'),'true');assert.equal(url.searchParams.has('key'),false);
    assert.equal(options.headers['X-Goog-Api-Key'],'test-only');
    return Response.json({items:[{id:{videoId:'shQJd3oGYn8'},snippet:{title:'Paxi',channelTitle:'ESA'}},{id:{videoId:'invalid'}}]});
  });
  assert.deepEqual(await result.json(),{enabled:true,items:[{id:'shQJd3oGYn8',title:'Paxi',channel:'ESA'}],source:'google'});
  assert.equal((await (await searchVideos(request('owner'),env,()=>assert.fail('cached'))).json()).cached,true);
  resetVideoCache();
  assert.equal((await searchVideos(request('owner'),env,async()=>new Response(null,{status:403}))).status,503);
});

test('local French and English requests open the specific board or music style without an AI session',()=>{
  for (const [lang,requests] of [
    ['fr',[['mets du rap','play_music','boom-bap'],['jouons au morpion','open_game','tic'],['ouvre le jeu de dames','open_game','draughts']]],
    ['en',[['play lo-fi','play_music','lo-fi'],['open checkers','open_game','draughts'],['play tic-tac-toe','open_game','tic']]]
  ]) {
    const h=controls(lang);
    for (const [phrase,action,value] of requests) {
      const command=h.device.command(phrase);
      assert.equal(command?.action,action);assert.equal(command?.value,value);
    }
    assert.equal(h.network.length,0);
  }
});

test('clock and night light also work as local device commands in both languages',()=>{
  for(const [lang,clock,on,off] of [
    ['fr','Quelle heure est-il ?','Allume la veilleuse','Éteins la veilleuse'],
    ['en','What time is it?','Switch on the night light','Switch the night light off']
  ]){
    const h=controls(lang);
    assert.equal(h.device.command(clock).action,'open_clock');
    assert.deepEqual({...h.device.command(on)},{action:'set_nightlight',value:'on'});
    assert.deepEqual({...h.device.command(off)},{action:'set_nightlight',value:'off'});
    assert.equal(h.network.length,0);
  }
});
