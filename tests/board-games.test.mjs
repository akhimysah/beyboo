import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const window = {};
vm.runInNewContext(await readFile(new URL('../public/board-games.js',import.meta.url),'utf8'),{window});
const rules = window.BeybooBoardRules;
const empty=()=>Array(100).fill(0);

test('tic-tac-toe detects wins and draws and the companion blocks an immediate win',()=>{
  assert.equal(rules.ticResult(['X','','O','','X','O','','','X']),'X');
  assert.equal(rules.ticResult('XOXXOOOXX'.split('')),'draw');
  assert.equal(rules.ticChoice(['X','X','','','','O','','','']),2);
  assert.equal(rules.ticChoice(['X','X','','O','O','','','','']),5);
});
test('international board starts with twenty pieces on each side and nine opening moves',()=>{
  const board=rules.initial();
  assert.equal(board.filter(p=>p===1).length,20);
  assert.equal(board.filter(p=>p===-1).length,20);
  assert.equal(rules.moves(board,1).length,9);
});
test('captures may go backward and only the longest full sequence is legal',()=>{
  const board=empty();board[61]=board[49]=1;board[52]=board[54]=board[38]=-1;
  const before=[...board], moves=rules.moves(board,1);
  assert.deepEqual([...board],before);
  assert.equal(moves.length,1);assert.equal(moves[0].from,61);
  assert.deepEqual([...moves[0].path],[43,65]);
  assert.deepEqual([...moves[0].taken],[52,54]);
  const after=rules.after(board,moves[0]);assert.equal(after[65],1);assert.equal(after[52],0);assert.equal(after[54],0);
});
test('kings can land at a distance but cannot cross a previously captured piece again',()=>{
  const board=empty();board[54]=2;board[43]=board[65]=-1;
  const legal=rules.moves(board,1);
  assert.ok(legal.some(m=>m.path[0]===10));assert.ok(legal.some(m=>m.path[0]===98));
  assert.ok(legal.every(m=>m.taken.length===1));
});
test('crowning happens only when the move ends on the promotion line',()=>{
  const b=empty();b[23]=1;b[14]=b[16]=-1;
  const moves=rules.moves(b,1);
  assert.equal(moves.length,1);assert.deepEqual([...moves[0].path],[5,27]);assert.equal(rules.after(b,moves[0])[27],1);
  b[16]=0;const last=rules.moves(b,1)[0];assert.equal(rules.after(b,last)[5],2);
});
