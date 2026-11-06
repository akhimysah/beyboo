import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../public/shop.js',import.meta.url),'utf8');
function makeShop(pack, locale='fr') {
  const context = {document:{documentElement:{lang:locale}},characters:[{id:'rayan',name:'Rayan'}],
    worldEditions:[{id:'turquie',person:'Rayan',country:'Turquie'}], accessories:[
      {id:'keychains',name:'BOOZZO Mini'},{id:'bags',name:'BOOZZO Go'},{id:'watch',name:'BOOZZO Watch'}],
    selection:{pack,character:'rayan',edition:'',variants:{},accessories:[]}};
  const shop = vm.runInNewContext(source+'\nBeybooShop',context);
  return {shop, selection:context.selection};
}

test('a World edition and the chosen bag variant are included in the quote in both languages',()=>{
  for (const locale of ['fr','en']) {
    const {shop,selection}=makeShop('duo',locale);
    const saved={...selection,edition:'turquie',variants:{bags:'backpack'}};
    Object.assign(selection,shop.restore(saved),{accessories:['keychains','bags']});
    assert.equal(shop.quoteLines().at(-1)[1],shop.format(24380));
    assert.equal(shop.quoteLines()[0][1],shop.format(19900));
  }
});

test('a component without a launch price leaves the full total open',()=>{
  const {shop,selection}=makeShop('screen');
  selection.accessories=['keychains'];
  assert.equal(shop.quoteLines().at(-2)[1],shop.format(1490));
  assert.equal(shop.quoteLines().at(-1)[1],'Tarif à confirmer');
});

test('old saved compositions and mismatched editions resolve to the classic price',()=>{
  const {shop,selection}=makeShop('duo');
  for (const saved of [null, {character:'rayan',pack:'duo'}, {character:'noah',pack:'duo',edition:'turquie'}]) {
    Object.assign(selection,shop.restore(saved));
    assert.equal(selection.edition,'');
    assert.equal(shop.quoteLines()[0][1],shop.format(17900));
  }
});
