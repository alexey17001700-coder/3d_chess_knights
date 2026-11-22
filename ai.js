/* ============================================================
   3D ШАХМАТЫ · РЫЦАРСКИЙ ТУРНИР — СОПЕРНИК (ИИ)
   ЭТАП 3. Негамакс + альфа-бета + сортировка ходов + форсированный
   добор взятий (quiescence). Три уровня силы.
   Работает и в Web Worker, и на главном потоке.
   ============================================================ */

import * as CH from './chess.js';

const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 100000;
const TIMEOUT = { timeout: true };

/* ---------- ТАБЛИЦЫ ПОЛЕЙ (взгляд белых, строка 0 = 8-я горизонталь) ---------- */
const PST = {
  p: [
      0,  0,  0,  0,  0,  0,  0,  0,
     50, 50, 50, 50, 50, 50, 50, 50,
     10, 10, 20, 30, 30, 20, 10, 10,
      5,  5, 10, 25, 25, 10,  5,  5,
      0,  0,  0, 20, 20,  0,  0,  0,
      5, -5,-10,  0,  0,-10, -5,  5,
      5, 10, 10,-20,-20, 10, 10,  5,
      0,  0,  0,  0,  0,  0,  0,  0
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
  ],
  r: [
      0,  0,  0,  0,  0,  0,  0,  0,
      5, 10, 10, 10, 10, 10, 10,  5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
      0,  0,  0,  5,  5,  0,  0,  0
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20
  ],
  kM: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20
  ],
  kE: [
    -50,-40,-30,-20,-20,-30,-40,-50,
    -30,-20,-10,  0,  0,-10,-20,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-30,  0,  0,  0,  0,-30,-30,
    -50,-30,-30,-30,-30,-30,-30,-50
  ]
};

function pstIndex(i, side){
  const r = i >> 3, f = i & 7;
  return side === 'w' ? (7 - r) * 8 + f : r * 8 + f;
}

/* ---------- ОЦЕНКА (со стороны того, чей ход) ---------- */
export function evaluate(s){
  let npm = 0;
  for (let i = 0; i < 64; i++){
    const p = s.board[i];
    if (p && p.t !== 'p' && p.t !== 'k') npm += VAL[p.t];
  }
  const end = npm < 1800;

  let sc = 0;
  let wb = 0, bb = 0;
  for (let i = 0; i < 64; i++){
    const p = s.board[i];
    if (!p) continue;
    if (p.t === 'b'){ if (p.s === 'w') wb++; else bb++; }
    const key = p.t === 'k' ? (end ? 'kE' : 'kM') : p.t;
    const v = VAL[p.t] + PST[key][pstIndex(i, p.s)];
    sc += p.s === 'w' ? v : -v;
  }
  if (wb >= 2) sc += 28;
  if (bb >= 2) sc -= 28;

  return s.turn === 'w' ? sc : -sc;
}

/* ---------- СОРТИРОВКА ХОДОВ ---------- */
function orderMoves(s, moves){
  const scored = moves.map(m => {
    const victim = s.board[m.to];
    const attacker = s.board[m.from];
    let sc = 0;
    if (victim) sc += 1000 + VAL[victim.t] - (attacker ? VAL[attacker.t] / 12 : 0);
    if (m.promo) sc += 800 + VAL[m.promo];
    return { m, sc };
  });
  scored.sort((a, b) => b.sc - a.sc);
  for (let i = 0; i < moves.length; i++) moves[i] = scored[i].m;
  return moves;
}

/* ---------- ФОРСИРОВАННЫЙ ДОБОР ВЗЯТИЙ ---------- */
function qsearch(s, alpha, beta, qd, deadline){
  if (performance.now() > deadline) throw TIMEOUT;

  const stand = evaluate(s);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (qd <= 0) return alpha;

  const moves = CH.allLegal(s).filter(m => s.board[m.to] || m.promo);
  orderMoves(s, moves);

  for (const m of moves){
    const r = CH.makeMove(s, m);
    const sc = -qsearch(r.state, -beta, -alpha, qd - 1, deadline);
    if (sc >= beta) return beta;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}

/* ---------- НЕГАМАКС ---------- */
function negamax(s, depth, ply, alpha, beta, deadline){
  if (performance.now() > deadline) throw TIMEOUT;

  const moves = CH.allLegal(s);
  if (!moves.length) return CH.inCheck(s, s.turn) ? -(MATE - ply) : 0;
  if (depth <= 0) return qsearch(s, alpha, beta, 2, deadline);

  orderMoves(s, moves);

  let best = -Infinity;
  for (const m of moves){
    const r = CH.makeMove(s, m);
    const sc = -negamax(r.state, depth - 1, ply + 1, -beta, -alpha, deadline);
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/* ---------- УРОВНИ ---------- */
const LEVELS = {
  easy:   { depth: 1, time: 260,  noise: 60, blunder: 0.30 },
  medium: { depth: 3, time: 900,  noise: 16, blunder: 0.05 },
  hard:   { depth: 5, time: 1900, noise: 0,  blunder: 0.00 }
};

/* ---------- ВЫБОР ХОДА ---------- */
export function chooseMove(state, level){
  const cfg = LEVELS[level] || LEVELS.medium;

  const moves = CH.allLegal(state);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];

  /* лёгкий уровень иногда просто ошибается по-человечески */
  if (cfg.blunder > 0 && Math.random() < cfg.blunder){
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const deadline = performance.now() + cfg.time;
  orderMoves(state, moves);

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (let d = 1; d <= cfg.depth; d++){
    let localBest = null;
    let localScore = -Infinity;
    let alpha = -Infinity;

    try {
      for (const m of moves){
        const r = CH.makeMove(state, m);
        const raw = -negamax(r.state, d - 1, 1, -Infinity, -alpha, deadline);
        const sc = raw + (Math.random() - 0.5) * cfg.noise;
        if (sc > localScore){ localScore = sc; localBest = m; }
        if (raw > alpha) alpha = raw;
      }
    } catch (e){
      if (e !== TIMEOUT) throw e;
      break;
    }

    if (localBest){ bestMove = localBest; bestScore = localScore; }
    if (bestScore > MATE - 200) break;
    if (performance.now() > deadline) break;
  }

  return bestMove;
}

export const AI_LEVELS = LEVELS;
