import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/app-worker.js',import.meta.url),'utf8');
function harness(fetch){const handlers={};vm.runInNewContext(source,{self:{addEventListener:(name,handler)=>handlers[name]=handler},fetch,Response});return handlers.fetch;}
test('app worker forwards private navigation without caching or replacing its response',async()=>{const original=new Response('private content',{headers:{'Cache-Control':'no-store'}});let response;const handler=harness(async()=>original);handler({request:{mode:'navigate',method:'GET'},respondWith:p=>response=p});assert.equal(await response,original);});
test('offline navigation gets an honest network-required page, never cached private content',async()=>{let response;const handler=harness(async()=>{throw Error('offline');});handler({request:{mode:'navigate',method:'GET'},respondWith:p=>response=p});const actual=await response;assert.equal(actual.status,503);assert.equal(actual.headers.get('Cache-Control'),'no-store');assert.match(await actual.text(),/Connectez votre appareil à Internet/);});
test('voice API and media requests are left to the browser, including when offline',()=>{let intercepted=0;const handler=harness(()=>{throw Error('must not fetch');});for(const request of [{mode:'cors',method:'POST'},{mode:'same-origin',method:'GET'},{mode:'navigate',method:'POST'}])handler({request,respondWith:()=>intercepted++});assert.equal(intercepted,0);});
