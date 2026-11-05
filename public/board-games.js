// Pure game rules. Board indices run left to right from the black home rank.
(() => {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  function ticResult(board) {
    for (const [a,b,c] of lines) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    return board.every(Boolean) ? 'draw' : '';
  }
  function ticChoice(board) {
    const free = [4,0,8,2,6,1,3,5,7].filter(i => !board[i]);
    for (const player of ['O','X']) {
      for (const i of free) {
        const next = board.slice();
        next[i] = player;
        if (ticResult(next) === player) return i;
      }
    }
    return free[0];
  }
  const directions = [[-1,-1],[-1,1],[1,-1],[1,1]];
  const row = i => Math.floor(i / 10);
  const playable = i => (row(i) + i % 10) % 2 === 1;
  function initial() {
    return Array.from({length:100}, (_,i) => playable(i) && row(i) < 4 ? -1 : playable(i) && row(i) > 5 ? 1 : 0);
  }
  function step(i, dy, dx) {
    const y = row(i) + dy, x = i % 10 + dx;
    return y >= 0 && y < 10 && x >= 0 && x < 10 ? y * 10 + x : -1;
  }
  function moves(board, side) {
    const captures = [], quiet = [];
    // Captured pieces block their squares until the entire multiple jump ends.
    function jumps(from, at, piece, path, taken) {
      const king = Math.abs(piece) === 2;
      let extended = false;
      for (const [dy,dx] of directions) {
        let enemy = step(at,dy,dx);
        while (king && enemy >= 0 && !board[enemy]) enemy = step(enemy,dy,dx);
        if (enemy < 0 || Math.sign(board[enemy]) !== -side || taken.includes(enemy)) continue;
        let to = step(enemy,dy,dx);
        while (to >= 0 && !board[to]) {
          extended = true;
          jumps(from,to,piece,[...path,to],[...taken,enemy]);
          if (!king) break;
          to = step(to,dy,dx);
        }
      }
      if (!extended && taken.length) captures.push({from,path,taken});
    }
    for (let from=0; from<100; from++) {
      const piece = board[from];
      if (Math.sign(piece) !== side) continue;
      const king = Math.abs(piece) === 2;
      board[from] = 0;
      jumps(from,from,piece,[],[]);
      board[from] = piece;
      for (const [dy,dx] of directions) {
        if (!king && dy !== -side) continue;
        let to = step(from,dy,dx);
        while (to >= 0 && !board[to]) {
          quiet.push({from,path:[to],taken:[]});
          if (!king) break;
          to = step(to,dy,dx);
        }
      }
    }
    if (!captures.length) return quiet;
    const longest = captures.reduce((n,m) => Math.max(n,m.taken.length),0);
    return captures.filter(m => m.taken.length === longest);
  }
  function after(board, move) {
    const next = board.slice(), piece = board[move.from], to = move.path.at(-1);
    next[move.from] = 0;
    move.taken.forEach(i => {next[i]=0;});
    const crowns = piece === 1 && row(to) === 0 || piece === -1 && row(to) === 9;
    next[to] = crowns ? piece*2 : piece;
    return next;
  }
  function draughtsChoice(board, legal) {
    let best, highest = -Infinity;
    for (const move of legal) {
      const to = move.path.at(-1), next = after(board,move);
      const replies = moves(next,1);
      const lost = replies.length ? replies[0].taken.length : -100;
      const value = (Math.abs(next[to])-Math.abs(board[move.from]))*4 - lost*3
        + move.taken.filter(i=>Math.abs(board[i])===2).length + .09*row(to) - .06*Math.abs(to%10-4.5) + .15*Math.random();
      if (value > highest) {best=move;highest=value;}
    }
    return best;
  }
  window.BeybooBoardRules = {ticResult,ticChoice,initial,playable,moves,after,draughtsChoice};
})();
