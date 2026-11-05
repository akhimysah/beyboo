import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={window:{}};vm.runInNewContext(readFileSync(new URL('../public/companion-preferences.js',import.meta.url),'utf8'),context);
const {create,createSwitch,key}=context.window.BeybooCompanionPreferences;
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};};
test('Alya and Aaron retain independent voices across reloads, without modifying profile or composition',()=>{
  const store=storage();store.setItem('beyboo-profile-v1','profile');store.setItem('beyboo-composition','composition');
  const first=create(()=>store,'elya','lili');first.setVoice('elya','plume');first.select('liam');first.setVoice('liam','cosmo');
  const reload=create(()=>store);assert.equal(reload.read().character,'liam');assert.equal(reload.voice('elya'),'plume');assert.equal(reload.voice('liam'),'cosmo');
  reload.select('elya');assert.equal(create(()=>store).read().character,'elya');assert.equal(store.getItem('beyboo-profile-v1'),'profile');assert.equal(store.getItem('beyboo-composition'),'composition');
});
test('corrupt, unknown-version and invalid character preferences fall back safely',()=>{
  for(const raw of ['{',JSON.stringify({version:2,character:'elya'}),JSON.stringify({version:1,character:'script'})]){
    const store=storage();store.setItem(key,raw);assert.equal(create(()=>store,'liam').read().character,'liam');
  }
});
test('unrecognized voices are removed and mutations reject invalid values',()=>{
  const store=storage();store.setItem(key,JSON.stringify({version:1,character:'elya',voices:{elya:'bad',liam:'cosmo',unknown:'bulle'}}));
  const model=create(()=>store);assert.equal(model.voice('elya'),'bulle');assert.equal(model.voice('liam'),'cosmo');
  assert.equal(model.setVoice('liam','bad').ok,false);assert.equal(model.select('bad').ok,false);
  const copy=model.read();copy.voices.liam='plume';assert.equal(model.voice('liam'),'cosmo');
});
test('storage failure preserves session selection without claiming persistence',()=>{
  const model=create(()=>{throw Error('disabled');});const result=model.select('elya');assert.equal(result.ok,true);assert.equal(result.persisted,false);assert.equal(model.read().character,'elya');
  assert.equal(model.setVoice('elya','lili').persisted,false);assert.equal(model.voice('elya'),'lili');
});
test('only the latest loaded portrait commits during rapid changes',async()=>{
  const pending=new Map(),commits=[];const control=createSwitch(id=>new Promise(resolve=>pending.set(id,resolve)),id=>commits.push(id));
  const slow=control.select('elya'),fast=control.select('liam');pending.get('liam')();assert.equal((await fast).ok,true);pending.get('elya')();assert.equal((await slow).stale,true);assert.deepEqual(commits,['liam']);
});
test('closing the picker or a failed image cannot commit a new character',async()=>{
  let finish,committed=false;const control=createSwitch(()=>new Promise(resolve=>{finish=resolve;}),()=>{committed=true;});
  const request=control.select('elya');control.cancel();finish();assert.equal((await request).stale,true);assert.equal(committed,false);
  const failure=createSwitch(async()=>{throw Error('offline');},()=>{committed=true;});assert.equal((await failure.select('liam')).ok,false);assert.equal(committed,false);
});
