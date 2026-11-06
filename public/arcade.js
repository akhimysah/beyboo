(() => {
  const rules = window.BeybooBoardRules;
  const en = document.documentElement.lang === 'en';
  const t = (fr,eng) => en ? eng : fr;
  const names = {tic:t('Morpion','Tic-tac-toe'),draughts:t('Dames','Draughts'),stars:t('Attrape les étoiles','Catch the stars')};
  const hints = {tic:t('Aligne trois symboles.','Get three in a row.'),draughts:t('Avance, capture et couronne tes pions.','Move, capture and crown your pieces.'),stars:t('Touche les cinq étoiles.','Catch all five stars.')};
  let stage, game, board, side, result, legal, route, selected, botTimer;
  let solo = true, revision = 0, repetitions, quietTurns;
  const btn = (action,label,cls='') => '<button type="button" data-move="'+action+'" class="'+cls+'">'+label+'</button>';
  const title = () => names[game] || t('À quoi on joue ?','What shall we play?');
  function reset() {
    clearTimeout(botTimer);
    stage = null;
    game = '';
  }
  function start(root, value) {
    reset();
    stage = root;
    game = ['tic','draughts','stars'].includes(value) ? value : 'menu';
    board = game === 'draughts' ? rules.initial() : Array(9).fill('');
    side = 1;
    result = '';
    selected = null;
    route = [];
    quietTurns = 0;
    repetitions = new Map([[side+'|'+board.join(','),1]]);
    legal = game === 'draughts' ? rules.moves(board,side) : [];
    if (game !== 'stars') render();
    return state();
  }
  function state() { return {game:game||'menu', turn:side, opponent:solo?'beyboo':'local', result:result||null}; }
  function sideName(s) {
    if (game === 'tic') return s === 1 ? 'X' : 'O';
    return s === 1 ? t('Blancs','White') : t('Noirs','Black');
  }
  function status() {
    if (result === 'draw') return t('Match nul !','It’s a draw!');
    if (result) return (result === 'bot' ? 'BOOZZO' : result) + t(' gagne !',' wins!');
    if (solo && side === -1) return t('BOOZZO réfléchit…','BOOZZO is thinking…');
    if (route.length) return t('Continue la prise.','Keep jumping.');
    if (game === 'draughts' && legal[0]?.taken.length) return t('Prise obligatoire','Capture required')+' · '+sideName(side);
    return (solo ? t('À toi','Your turn') : t('Au tour de','To play'))+' · '+sideName(side);
  }
  function queueBot() {
    if (!solo || side !== -1 || result) return;
    botTimer = setTimeout(() => {
      if (game === 'tic') ticTurn(rules.ticChoice(board));
      if (game === 'draughts') finishMove(rules.draughtsChoice(board,legal));
    },450);
  }
  function ticTurn(i) {
    if (board[i] || result) return;
    board[i] = sideName(side);
    const outcome = rules.ticResult(board);
    if (outcome) result = outcome === 'draw' ? 'draw' : solo && side === -1 ? 'bot' : sideName(side);
    side *= -1;
    render();
    queueBot();
  }
  function finishMove(move) {
    quietTurns = Math.abs(board[move.from]) === 2 && !move.taken.length ? quietTurns+1 : 0;
    board = rules.after(board,move);
    const winner = solo && side === -1 ? 'bot' : sideName(side);
    side *= -1;
    selected = null;
    route = [];
    legal = rules.moves(board,side);
    const key = side+'|'+board.join(',');
    repetitions.set(key,(repetitions.get(key)||0)+1);
    if (!legal.length) result = winner;
    else if (repetitions.get(key) >= 3 || quietTurns >= 50) result = 'draw';
    render();
    queueBot();
  }
  function branches() {
    return legal.filter(m => m.from === selected && route.every((square,i)=>m.path[i]===square));
  }
  function playSquare(i) {
    if (result || solo && side === -1) return;
    if (game === 'tic') return ticTurn(i);
    const matches = branches().filter(m=>m.path[route.length]===i);
    if (matches.length) {
      route.push(i);
      if (matches[0].path.length === route.length) return finishMove(matches[0]);
    } else if (!route.length && legal.some(m=>m.from===i)) {
      selected = i === selected ? null : i;
    } else return;
    render();
  }
  function boardHTML() {
    const tic = game === 'tic', cells = board.slice(), active = !result && (!solo || side === 1);
    const candidates = branches(), next = new Set(candidates.map(m=>m.path[route.length]));
    const jumped = new Set((candidates[0]?.taken||[]).slice(0,route.length));
    const current = route.length ? route.at(-1) : selected;
    if (route.length) {cells[selected]=0;cells[current]=board[selected];}
    const squares = cells.map((piece,i)=>{
      if (!tic && !rules.playable(i)) return '<span class="board-light"></span>';
      const enabled = active && (tic ? !piece : next.has(i) || !route.length && legal.some(m=>m.from===i));
      const coord = String.fromCharCode(65+i%(tic?3:10))+(tic?3-Math.floor(i/3):10-Math.floor(i/10));
      const token = tic ? piece || '' : piece ? '<i class="disc '+(piece>0?'ivory':'slate')+(jumped.has(i)?' captured':'')+'">'+(Math.abs(piece)===2?'♛':'')+'</i>' : '';
      const label = tic ? piece : piece ? sideName(Math.sign(piece))+(Math.abs(piece)===2?t(' · dame',' · king'):'') : '';
      return '<button type="button" class="board-cell'+(current===i?' selected':'')+(next.has(i)?' possible':'')+'" data-move="s'+i+'" aria-label="'+coord+(label?' · '+label:'')+'"'+(enabled?'':' disabled')+'>'+token+'</button>';
    }).join('');
    return '<div class="bey-board '+(tic?'tic':'draughts')+'" role="group" aria-label="'+title()+'">'+squares+'</div>';
  }
  function menu(big) {
    return '<div class="arcade-menu">'+Object.keys(names).map((key,i)=>btn(key,'<i aria-hidden="true">'+['×○','◉','✦'][i]+'</i><span><b>'+names[key]+'</b>'+(big?'<small>'+hints[key]+'</small>':'')+'</span>','arcade-option option-'+key)).join('')+'</div>';
  }
  function draw(root,big) {
    if (game === 'menu') {
      root.innerHTML = '<div class="arcade-content"><h4>'+title()+'</h4>'+menu(big)+'</div>';
    } else {
      const modes = big ? '<div class="arcade-opponent">'+['solo','duo'].map((key,i)=>
        '<button type="button" data-move="'+key+'" aria-pressed="'+(solo===(i===0))+'">'+[t('Contre BOOZZO','Play BOOZZO'),t('À deux','Two players')][i]+'</button>').join('')+'</div>' : '';
      const instructions = game==='draughts' ? t('Touche un pion puis une case marquée. Une dame porte une couronne.','Tap a piece, then a marked square. Kings wear a crown.') : hints.tic;
      root.innerHTML = '<div class="arcade-content"><h4>'+title()+'</h4>'+modes+(big?'<p>'+instructions+'</p>':'')+boardHTML()+'<p class="board-status" role="status">'+status()+'</p>'+(big?'<div class="board-nav">'+btn('zoom',t('Agrandir l’œil','Magnify the eye'))+btn('again',t('Recommencer','New game'))+btn('menu',t('Tous les jeux','All games'))+'</div>':'')+'</div>';
    }
    root.querySelectorAll('[data-move]').forEach(button=>button.addEventListener('click',()=>{
      const key=button.dataset.move;
      if (key==='zoom') return window.BeybooCompanion.setDetail(true,{reveal:true});
      if (/^s\d+$/.test(key)) return playSquare(Number(key.slice(1)));
      if (key==='solo'||key==='duo') {
        if (solo===(key==='solo')) return;
        solo=key==='solo';
        start(stage,game);
      } else if (key==='again') start(stage,game);
      else window.BeybooScreen.run({action:'open_game',value:key});
    }));
  }
  function render() {
    if (!stage) return;
    stage.dataset.activityRevision = String(++revision);
    draw(stage,false);
  }
  window.BeybooArcade = {start,reset,state,controls(panel){draw(panel,true);},title};
})();
