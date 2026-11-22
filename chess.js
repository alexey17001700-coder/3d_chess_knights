/* ============================================================
   3D ШАХМАТЫ · РЫЦАРСКИЙ ТУРНИР — ДВИЖОК ПРАВИЛ
   ЭТАП 2. Чистая логика, без графики.
   Поле — массив 64. Индекс = rank * 8 + file.
   file 0..7 = a..h,  rank 0..7 = 1..8.
   Белые стоят на rank 0-1, чёрные на rank 6-7.
   ============================================================ */

export const FILES = 'abcdefgh';

export const idx = (f, r) => r * 8 + f;
export const fileOf = i => i & 7;
export const rankOf = i => i >> 3;
export const sqName = i => FILES[fileOf(i)] + (rankOf(i) + 1);
export const other = s => (s === 'w' ? 'b' : 'w');

const KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const ALL8 = DIAG.concat(ORTH);

const onBoard = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;

/* ---------- начальная позиция ---------- */
export function initialState(){
  const board = new Array(64).fill(null);
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let f = 0; f < 8; f++){
    board[idx(f, 0)] = { t: back[f], s: 'w' };
    board[idx(f, 1)] = { t: 'p', s: 'w' };
    board[idx(f, 6)] = { t: 'p', s: 'b' };
    board[idx(f, 7)] = { t: back[f], s: 'b' };
  }
  return {
    board, turn: 'w',
    castling: { wk: true, wq: true, bk: true, bq: true },
    ep: -1, half: 0, full: 1
  };
}

export function cloneState(s){
  return {
    board: s.board.map(p => (p ? { t: p.t, s: p.s } : null)),
    turn: s.turn,
    castling: { wk: s.castling.wk, wq: s.castling.wq, bk: s.castling.bk, bq: s.castling.bq },
    ep: s.ep, half: s.half, full: s.full
  };
}

/* ---------- атака поля ---------- */
export function isAttacked(board, target, by){
  const tf = fileOf(target), tr = rankOf(target);

  /* пешки */
  const pr = by === 'w' ? tr - 1 : tr + 1;
  for (const df of [-1, 1]){
    const f = tf + df;
    if (!onBoard(f, pr)) continue;
    const p = board[idx(f, pr)];
    if (p && p.s === by && p.t === 'p') return true;
  }

  /* кони */
  for (const [df, dr] of KN){
    const f = tf + df, r = tr + dr;
    if (!onBoard(f, r)) continue;
    const p = board[idx(f, r)];
    if (p && p.s === by && p.t === 'n') return true;
  }

  /* король */
  for (const [df, dr] of ALL8){
    const f = tf + df, r = tr + dr;
    if (!onBoard(f, r)) continue;
    const p = board[idx(f, r)];
    if (p && p.s === by && p.t === 'k') return true;
  }

  /* дальнобойные */
  const slide = (dirs, types) => {
    for (const [df, dr] of dirs){
      let f = tf + df, r = tr + dr;
      while (onBoard(f, r)){
        const p = board[idx(f, r)];
        if (p){
          if (p.s === by && types.indexOf(p.t) >= 0) return true;
          break;
        }
        f += df; r += dr;
      }
    }
    return false;
  };
  if (slide(DIAG, ['b', 'q'])) return true;
  if (slide(ORTH, ['r', 'q'])) return true;

  return false;
}

export function kingSquare(board, side){
  for (let i = 0; i < 64; i++){
    const p = board[i];
    if (p && p.t === 'k' && p.s === side) return i;
  }
  return -1;
}

export function inCheck(s, side){
  const k = kingSquare(s.board, side);
  if (k < 0) return false;
  return isAttacked(s.board, k, other(side));
}

/* ---------- псевдоходы (без проверки на шах) ---------- */
function pseudo(s, from){
  const p = s.board[from];
  if (!p) return [];
  const f = fileOf(from), r = rankOf(from);
  const out = [];
  const push = (tf, tr, promo) => {
    if (!onBoard(tf, tr)) return;
    out.push({ from, to: idx(tf, tr), promo: promo || null });
  };

  if (p.t === 'p'){
    const dir = p.s === 'w' ? 1 : -1;
    const startRank = p.s === 'w' ? 1 : 6;
    const lastRank = p.s === 'w' ? 7 : 0;

    /* вперёд */
    if (onBoard(f, r + dir) && !s.board[idx(f, r + dir)]){
      if (r + dir === lastRank){
        for (const q of ['q', 'r', 'b', 'n']) push(f, r + dir, q);
      } else {
        push(f, r + dir);
        if (r === startRank && !s.board[idx(f, r + dir * 2)]) push(f, r + dir * 2);
      }
    }
    /* взятие */
    for (const df of [-1, 1]){
      const tf = f + df, tr = r + dir;
      if (!onBoard(tf, tr)) continue;
      const t = s.board[idx(tf, tr)];
      if (t && t.s !== p.s){
        if (tr === lastRank){
          for (const q of ['q', 'r', 'b', 'n']) push(tf, tr, q);
        } else push(tf, tr);
      } else if (!t && s.ep === idx(tf, tr)){
        push(tf, tr);   /* взятие на проходе */
      }
    }
    return out;
  }

  if (p.t === 'n'){
    for (const [df, dr] of KN){
      const tf = f + df, tr = r + dr;
      if (!onBoard(tf, tr)) continue;
      const t = s.board[idx(tf, tr)];
      if (!t || t.s !== p.s) push(tf, tr);
    }
    return out;
  }

  if (p.t === 'k'){
    for (const [df, dr] of ALL8){
      const tf = f + df, tr = r + dr;
      if (!onBoard(tf, tr)) continue;
      const t = s.board[idx(tf, tr)];
      if (!t || t.s !== p.s) push(tf, tr);
    }
    /* рокировка */
    const home = p.s === 'w' ? 0 : 7;
    const rights = p.s === 'w'
      ? { k: s.castling.wk, q: s.castling.wq }
      : { k: s.castling.bk, q: s.castling.bq };
    if (r === home && f === 4 && !isAttacked(s.board, from, other(p.s))){
      if (rights.k
        && !s.board[idx(5, home)] && !s.board[idx(6, home)]
        && s.board[idx(7, home)] && s.board[idx(7, home)].t === 'r'
        && !isAttacked(s.board, idx(5, home), other(p.s))
        && !isAttacked(s.board, idx(6, home), other(p.s))){
        push(6, home);
      }
      if (rights.q
        && !s.board[idx(3, home)] && !s.board[idx(2, home)] && !s.board[idx(1, home)]
        && s.board[idx(0, home)] && s.board[idx(0, home)].t === 'r'
        && !isAttacked(s.board, idx(3, home), other(p.s))
        && !isAttacked(s.board, idx(2, home), other(p.s))){
        push(2, home);
      }
    }
    return out;
  }

  const dirs = p.t === 'b' ? DIAG : p.t === 'r' ? ORTH : ALL8;
  for (const [df, dr] of dirs){
    let tf = f + df, tr = r + dr;
    while (onBoard(tf, tr)){
      const t = s.board[idx(tf, tr)];
      if (!t) push(tf, tr);
      else {
        if (t.s !== p.s) push(tf, tr);
        break;
      }
      tf += df; tr += dr;
    }
  }
  return out;
}

/* ---------- ход ---------- */
export function makeMove(s, m){
  const n = cloneState(s);
  const p = n.board[m.from];
  const f = fileOf(m.from), r = rankOf(m.from);
  const tf = fileOf(m.to), tr = rankOf(m.to);

  let captured = n.board[m.to];
  let epCapture = false;

  if (p.t === 'p' && m.to === s.ep && !captured){
    const capIdx = idx(tf, r);
    captured = n.board[capIdx];
    n.board[capIdx] = null;
    epCapture = true;
  }

  n.board[m.to] = p;
  n.board[m.from] = null;
  if (m.promo) p.t = m.promo;

  /* ладья при рокировке */
  const castle = (p.t === 'k' && Math.abs(tf - f) === 2);
  if (castle){
    const rFrom = idx(tf > f ? 7 : 0, r);
    const rTo = idx(tf > f ? 5 : 3, r);
    n.board[rTo] = n.board[rFrom];
    n.board[rFrom] = null;
  }

  /* права на рокировку */
  if (p.t === 'k'){
    if (p.s === 'w'){ n.castling.wk = false; n.castling.wq = false; }
    else { n.castling.bk = false; n.castling.bq = false; }
  }
  if (p.t === 'r'){
    if (m.from === idx(0, 0)) n.castling.wq = false;
    if (m.from === idx(7, 0)) n.castling.wk = false;
    if (m.from === idx(0, 7)) n.castling.bq = false;
    if (m.from === idx(7, 7)) n.castling.bk = false;
  }
  if (m.to === idx(0, 0)) n.castling.wq = false;
  if (m.to === idx(7, 0)) n.castling.wk = false;
  if (m.to === idx(0, 7)) n.castling.bq = false;
  if (m.to === idx(7, 7)) n.castling.bk = false;

  /* поле для взятия на проходе */
  n.ep = -1;
  if (p.t === 'p' && Math.abs(tr - r) === 2) n.ep = idx(f, (r + tr) / 2);

  n.half = (p.t === 'p' || captured) ? 0 : s.half + 1;
  if (s.turn === 'b') n.full = s.full + 1;
  n.turn = other(s.turn);

  return { state: n, captured, epCapture, castle };
}

/* ---------- легальные ходы ---------- */
export function legalMoves(s, from){
  const res = [];
  for (const m of pseudo(s, from)){
    const r = makeMove(s, m);
    if (!inCheck(r.state, s.turn)) res.push(m);
  }
  return res;
}

export function allLegal(s){
  const res = [];
  for (let i = 0; i < 64; i++){
    const p = s.board[i];
    if (!p || p.s !== s.turn) continue;
    for (const m of legalMoves(s, i)) res.push(m);
  }
  return res;
}

/* Только взятия, взятия на проходе и превращения — для форсированного
   добора. Тихие ходы не проверяются на легальность, поэтому генерация
   в разы дешевле allLegal. */
export function allLegalCaptures(s){
  const res = [];
  for (let i = 0; i < 64; i++){
    const p = s.board[i];
    if (!p || p.s !== s.turn) continue;
    for (const m of pseudo(s, i)){
      if (!s.board[m.to] && !m.promo && m.to !== s.ep) continue;
      const r = makeMove(s, m);
      if (!inCheck(r.state, s.turn)) res.push(m);
    }
  }
  return res;
}

/* ---------- состояние партии ---------- */
export function insufficientMaterial(s){
  const list = [];
  for (let i = 0; i < 64; i++){
    const p = s.board[i];
    if (p && p.t !== 'k') list.push(p.t);
  }
  if (list.length === 0) return true;
  if (list.length === 1 && (list[0] === 'n' || list[0] === 'b')) return true;
  return false;
}

export function status(s){
  const moves = allLegal(s);
  const check = inCheck(s, s.turn);
  if (moves.length === 0){
    return check
      ? { over: true, result: other(s.turn), reason: 'мат' }
      : { over: true, result: 'draw', reason: 'пат' };
  }
  if (s.half >= 100) return { over: true, result: 'draw', reason: 'правило 50 ходов' };
  if (insufficientMaterial(s)) return { over: true, result: 'draw', reason: 'недостаточно материала' };
  return { over: false, check, moves };
}

/* ---------- нотация ---------- */
const LET = { p: '', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };

export function toSAN(s, m){
  const p = s.board[m.from];
  const after = makeMove(s, m);
  const st = status(after.state);

  let txt;
  if (after.castle){
    txt = (fileOf(m.to) > fileOf(m.from)) ? 'O-O' : 'O-O-O';
  } else {
    const cap = after.captured ? 'x' : '';
    txt = LET[p.t] + (p.t === 'p' && cap ? FILES[fileOf(m.from)] : '') + cap + sqName(m.to);
    if (m.promo) txt += '=' + LET[m.promo];
  }
  if (st.over && st.result !== 'draw') txt += '#';
  else if (st.check) txt += '+';
  return txt;
}
