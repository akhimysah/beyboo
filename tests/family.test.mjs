import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
const source=await readFile(new URL('../public/family.js',import.meta.url),'utf8');
function harness(saved){
  const nodes=new Map(),listeners={},data=new Map(saved);
  function el(name){
    if(!nodes.has(name))nodes.set(name,{dataset:{},addEventListener(k,fn){this[k]=fn;},setAttribute(){},querySelector:el,replaceChildren(){},showModal(){this.open=true;}});
    return nodes.get(name);
  }
  const dialog=el('dialog');
  const doc={getElementById:el,documentElement:{lang:'fr'},body:{append(){}},createElement:()=>dialog};
  const window={addEventListener:(k,fn)=>listeners[k]=fn};
  vm.runInNewContext(source,{window,document:doc,localStorage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},location:{search:''},URLSearchParams,crypto:webcrypto,TextEncoder});
  async function enter(pin,repeat){
    el('family-open').click();
    await el('form').onsubmit({preventDefault(){},target:{querySelector:el,elements:{pin:{value:pin},repeat:{value:repeat}}}});
  }
  function save(values){
    el('form').onsubmit({preventDefault(){},target:{elements:{namedItem:k=>({checked:values[k]})}}});
  }
  return {api:window.BeybooFamily,data,enter,save,el,window,listeners};
}
test('PIN-protected local preferences persist, reject a wrong PIN and can be restored with the correct code',async()=>{
  const h=harness();await h.enter('4832','4832');
  h.save({voice:false,camera:false,calls:true});
  assert.equal(h.api.allowed('voice'),false);assert.equal(h.api.allowed('camera'),false);assert.equal(h.api.allowed('calls'),true);
  const stored=h.data.get('beyboo.family.v1');assert.equal(JSON.parse(stored).hash.length,64);assert.equal(Object.hasOwn(JSON.parse(stored),'pin'),false);
  const reopened=harness(h.data);await reopened.enter('1111');
  assert.equal(reopened.el('[role=status]').textContent,'Code incorrect.');assert.equal(reopened.api.guard('voice'),false);
  await reopened.enter('4832');reopened.save({voice:true,camera:false,calls:false});
  assert.equal(reopened.api.allowed('voice'),true);assert.equal(reopened.api.allowed('calls'),false);
});
test('unconfigured devices retain the original demo, damaged records block restricted features',()=>{
  const h=harness();assert.equal(h.api.allowed('voice'),true);h.data.set('beyboo.family.v1','?');assert.equal(h.api.allowed('voice'),false);
});
test('family messages are a permission: enabled by default, also for records saved before it existed, and lockable',async()=>{
  const h=harness();await h.enter('2580','2580');
  assert.equal(h.api.allowed('messages'),true);
  h.save({voice:true,camera:true,calls:true,messages:false});
  assert.equal(h.api.allowed('messages'),false);assert.equal(h.api.guard('messages'),false);
  assert.match(h.el('.family-body').innerHTML,/Messages de famille/);
  const legacy=JSON.parse(h.data.get('beyboo.family.v1'));delete legacy.permissions.messages;legacy.permissions.calls=false;
  const older=harness([['beyboo.family.v1',JSON.stringify(legacy)]]);
  assert.equal(older.api.allowed('messages'),true);assert.equal(older.api.allowed('calls'),false);
});
