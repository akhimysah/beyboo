import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../public/clock-nightlight.js',import.meta.url),'utf8');
function harness(lang='fr', wakeLock) {
  const start=new Date(2026,10,5,23,59,58).getTime();
  let now=start, timer=0;
  const scheduled=new Map(), fields=new Map(), events=new Map(), notices=[];
  function el(id) {
    if (!fields.has(id)) fields.set(id,{
      dataset:{},style:{setProperty(){},removeProperty(){}},classList:{toggle(){},remove(){}},
      querySelector:key=>el(id+key),querySelectorAll:()=>[],setAttribute(key,value){this[key]=value;},
      addEventListener(key,callback){this[key]=callback;}
    });
    return fields.get(id);
  }
  class FakeDate extends Date {
    constructor(...args){super(...(args.length?args:[now]));}
    static now(){return now;}
  }
  const document={hidden:false,documentElement:{lang},getElementById:el,addEventListener:(name,fn)=>events.set(name,fn)};
  const window={addEventListener(){}};
  vm.runInNewContext(source,{window,document,location:{search:''},URLSearchParams,navigator:{wakeLock},Intl,Date:FakeDate,
    setTimeout(fn){const id=++timer;scheduled.set(id,fn);return id;},clearTimeout:id=>scheduled.delete(id)});
  const app=window.BeybooBedside;
  return {app,el,scheduled,notices,
    open(mode){app.mount(el('stage'),mode,n=>notices.push(n));app.controls(el('panel'));},
    jump(seconds){now+=seconds*1000;for(const fn of [...scheduled.values()])fn();},
    visible(value){document.hidden=!value;events.get('visibilitychange')();}
  };
}

test('clock follows device time past midnight with matching numeric and analogue displays',()=>{
  const h=harness();
  h.open('clock');
  assert.equal(h.app.state().localTime,'23:59');
  assert.equal(h.el('stage.hand-second').transform,'rotate(348 100 100)');
  h.jump(2);
  assert.equal(h.el('stage.hand-hour').transform,'rotate(0 100 100)');
  assert.equal(h.el('stagetime').textContent,'00:00');
  assert.equal(h.el('panel.bedside-time').textContent,'00:00');
  assert.equal(h.el('eye-time-shortcuttime').textContent,'00:00');
});
test('short trial switches off after real elapsed time even across a suspended tab, without replacing the chosen bedtime timer',()=>{
  const h=harness();
  h.open('nightlight');
  assert.equal(h.app.state().remainingSeconds,900);
  h.app.turn(true,1800);
  h.el('panel.lamp-test').onclick();
  h.jump(9);
  assert.equal(h.app.state().remainingSeconds,1);
  h.visible(false);
  h.jump(120);
  h.visible(true);
  assert.equal(h.app.state().light,'off');
  assert.equal(h.el('stage.night-lamp').dataset.on,'false');
  assert.match(h.notices.at(-1),/minuterie/);
  h.el('panel.lamp-toggle').onclick();
  assert.equal(h.app.state().remainingSeconds,1800);
  h.app.turn(true,0);h.jump(3600);assert.equal(h.app.state().light,'on');
  h.app.reset();assert.equal(h.app.isOpen(),false);
});
test('a wake lock granted after leaving the lamp is released immediately',async()=>{
  let grant, releases=0;
  const h=harness('en',{request:()=>new Promise(resolve=>{grant=resolve;})});
  h.open('nightlight');
  h.app.reset();
  grant({release(){releases++;return Promise.resolve();}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(releases,1);
});
