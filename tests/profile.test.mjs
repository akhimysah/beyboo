import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/profile-model.js',import.meta.url),'utf8');
function setup(){
  const window={};vm.runInNewContext(source,{window});
  const values=new Map();
  const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  return {api:window.BeybooProfileModel,storage,values};
}
test('local profile survives a fresh session and keeps only its intended fields',()=>{
  const {api,storage,values}=setup();const a=api.create(()=>storage);
  const saved=a.save({name:'  Le\u0301a  ',handle:' @LEA.beyboo ',password:'must not persist'});
  assert.equal(saved.persisted,true);
  const profile=api.create(()=>storage).read();
  assert.equal(profile.name,'Léa');assert.equal(profile.handle,'lea.beyboo');
  assert.deepEqual(Object.keys(profile).sort(),['handle','name','version']);
  assert.equal(values.get(api.key).includes('password'),false);
});
test('invalid edits do not overwrite a previously saved profile',()=>{
  const {api,storage}=setup();const model=api.create(()=>storage);
  model.save({name:'Hicham',handle:'hicham.beyboo'});
  for(const handle of ['ab','space name','<script>','x'.repeat(25)])assert.equal(model.save({name:'Hicham',handle}).ok,false);
  for(const name of ['','   ','<img onerror=alert(1)>','a'.repeat(41)])assert.equal(model.save({name,handle:'valid.name'}).ok,false);
  assert.equal(api.create(()=>storage).read().handle,'hicham.beyboo');
});
test('malformed or unknown-version storage is ignored without executing content',()=>{
  const {api,storage,values}=setup();
  for(const raw of ['not-json','null',JSON.stringify({version:2,name:'Hicham',handle:'hicham'}),JSON.stringify({version:1,name:'<script>',handle:'hicham'})]){
    values.set(api.key,raw);assert.equal(api.create(()=>storage).read(),null);
  }
});
test('blocked storage keeps the current session and never reports persistence',()=>{
  const {api,storage}=setup();const model=api.create(()=>storage);
  model.save({name:'Hicham',handle:'hicham'});
  storage.setItem=()=>{throw Error('quota');};
  const result=model.save({name:'Léa',handle:'lea.demo'});
  assert.equal(result.ok,true);assert.equal(result.persisted,false);assert.equal(model.read().name,'Léa');
  assert.equal(api.create(()=>storage).read().name,'Hicham');
  const privateModel=api.create(()=>{throw Error('blocked');});
  assert.equal(privateModel.read(),null);assert.equal(privateModel.save({name:'Hicham',handle:'demo'}).persisted,false);
});
test('erasing a profile survives reload and failures do not claim successful deletion',()=>{
  const {api,storage}=setup();const model=api.create(()=>storage);
  model.save({name:'Hicham',handle:'hicham'});const remove=storage.removeItem;
  storage.removeItem=()=>{throw Error('blocked');};
  assert.equal(model.remove().ok,false);assert.equal(model.read().name,'Hicham');
  storage.removeItem=remove;assert.equal(model.remove().ok,true);assert.equal(api.create(()=>storage).read(),null);
});
