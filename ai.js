/* ============================================================
   3D ШАХМАТЫ · РЫЦАРСКИЙ ТУРНИР — СОПЕРНИК (ИИ)
   Негамакс + альфа-бета + сортировка ходов + форсированный
   добор взятий (quiescence). Четыре уровня силы.
   Работает и в Web Worker, и на главном потоке.

   ВАЖНО ПРО СКОРОСТЬ:
   — время проверяется не на каждом узле, а раз в 256 узлов;
   — на нулевой глубине сразу идёт добор, без генерации всех ходов;
   — лучший ход предыдущей итерации идёт первым (PV-порядок);
   — добор берёт только взятия (allLegalCaptures), а не все ходы;
   — жёсткий лимит по времени И по количеству узлов.
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

/* ---------- ОЦЕНКА (со стороны того, чей ход) ----------
   Один проход по доске вместо двух: король считается отдельно,
   потому что его таблица зависит от стадии партии. */
export function evaluate(s){
  const b = s.board;
  let npm = 0, sc = 0, wb = 0, bb = 0;
  let kIdx = -1, kSide = 'w';

  for (let i = 0; i < 64; i++){
    const p = b[i];
    if (!p) continue;
    const t = p.t, w = p.s === 'w';

    if (t === 'b'){ if (w) wb++; else bb++; }
    if (t === 'k'){ kIdx = i; kSide = p.s; continue; }

    const v = VAL[t] + PST[t][pstIndex(i, p.s)];
    sc += w ? v : -v;
    if (t !== 'p') npm += VAL[t];
  }

  if (kIdx >= 0){
    const kv = PST[npm < 1800 ? 'kE' : 'kM'][pstIndex(kIdx, kSide)];
    sc += kSide === 'w' ? kv : -kv;
  }

  if (wb >= 2) sc += 28;
  if (bb >= 2) sc -= 28;

  return s.turn === 'w' ? sc : -sc;
}

/* ---------- СОРТИРОВКА ХОДОВ ----------
   Без аллокаций: оценки в отдельном массиве, сортировка вставками.
   pv — ход из предыдущей итерации, он идёт первым. */
function orderMoves(s, moves, pv){
  const n = moves.length;
  if (n < 2) return moves;

  const sc = new Array(n);
  for (let i = 0; i < n; i++){
    const m = moves[i];
    const victim = s.board[m.to];
    const attacker = s.board[m.from];
    let v = 0;
    if (victim) v += 1000 + VAL[victim.t] - (attacker ? VAL[attacker.t] / 12 : 0);
    if (m.promo) v += 800 + VAL[m.promo];
    if (pv && m.from === pv.from && m.to === pv.to && (m.promo || null) === (pv.promo || null)) v += 100000;
    sc[i] = v;
  }

  for (let i = 1; i < n; i++){
    const m = moves[i], v = sc[i];
    let j = i - 1;
    while (j >= 0 && sc[j] < v){
      moves[j + 1] = moves[j];
      sc[j + 1] = sc[j];
      j--;
    }
    moves[j + 1] = m;
    sc[j + 1] = v;
  }
  return moves;
}

/* ---------- КОНТРОЛЬ ВРЕМЕНИ ----------
   performance.now() на каждом узле дорого для телефона, поэтому
   время смотрим раз в 256 узлов, а между ними считаем узлы. */
function tick(ctx){
  if ((++ctx.nodes & 255) === 0 && performance.now() > ctx.deadline) throw TIMEOUT;
  if (ctx.nodes > ctx.maxNodes) throw TIMEOUT;
}

/* ---------- ФОРСИРОВАННЫЙ ДОБОР ВЗЯТИЙ ---------- */
function qsearch(s, alpha, beta, qd, ctx){
  tick(ctx);

  const stand = evaluate(s);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (qd <= 0) return alpha;

  const moves = CH.allLegalCaptures(s);
  orderMoves(s, moves);

  for (let i = 0; i < moves.length; i++){
    const r = CH.makeMove(s, moves[i]);
    const sc = -qsearch(r.state, -beta, -alpha, qd - 1, ctx);
    if (sc >= beta) return beta;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}

/* ---------- НЕГАМАКС ---------- */
function negamax(s, depth, ply, alpha, beta, ctx){
  tick(ctx);

  /* сначала глубина: на нулевой сразу в добор, без генерации всех ходов */
  if (depth <= 0) return qsearch(s, alpha, beta, ctx.qd, ctx);

  const moves = CH.allLegal(s);
  if (!moves.length) return CH.inCheck(s, s.turn) ? -(MATE - ply) : 0;

  orderMoves(s, moves, ctx.pv[ply]);

  let best = -Infinity;
  for (let i = 0; i < moves.length; i++){
    const m = moves[i];
    const r = CH.makeMove(s, m);
    const sc = -negamax(r.state, depth - 1, ply + 1, -beta, -alpha, ctx);
    if (sc > best){
      best = sc;
      ctx.pv[ply] = m;
    }
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/* ---------- УРОВНИ ----------
   time  — жёсткий лимит раздумий в миллисекундах;
   nodes — страховка от затяжного счёта на слабом телефоне;
   qd    — глубина добора взятий;
   blunder — шанс «человеческой» ошибки. */
const LEVELS = {
  blitz:  { depth: 2, time: 180,  noise: 45, blunder: 0.20, qd: 1, nodes: 50000 },
  easy:   { depth: 2, time: 320,  noise: 55, blunder: 0.28, qd: 1, nodes: 80000 },
  medium: { depth: 3, time: 650,  noise: 14, blunder: 0.05, qd: 2, nodes: 160000 },
  hard:   { depth: 5, time: 1100, noise: 0,  blunder: 0.00, qd: 2, nodes: 300000 }
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

  const ctx = {
    deadline: performance.now() + cfg.time,
    maxNodes: cfg.nodes,
    nodes: 0,
    qd: cfg.qd,
    pv: new Array(64).fill(null)
  };
  const t0 = performance.now();

  orderMoves(state, moves);

  let bestMove = moves[0];
  let bestScore = -Infinity;
  let reached = 0;

  for (let d = 1; d <= cfg.depth; d++){
    let localBest = null;
    let localScore = -Infinity;
    let alpha = -Infinity;
    const scores = new Array(moves.length);

    try {
      for (let i = 0; i < moves.length; i++){
        const m = moves[i];
        const r = CH.makeMove(state, m);
        const raw = -negamax(r.state, d - 1, 1, -Infinity, -alpha, ctx);
        scores[i] = raw;
        const sc = raw + (Math.random() - 0.5) * cfg.noise;
        if (sc > localScore){ localScore = sc; localBest = m; }
        if (raw > alpha) alpha = raw;
      }
    } catch (e){
      if (e !== TIMEOUT) throw e;
      break;
    }

    if (localBest){
      bestMove = localBest;
      bestScore = localScore;
      reached = d;
      /* лучший ход — вперёд, остальные по убыванию оценки: следующий
         проход не тратит время на заведомо слабые ветки */
      const pair = moves.map((m, i) => ({ m, s: scores[i] === undefined ? -Infinity : scores[i] }));
      pair.sort((a, b) => b.s - a.s);
      for (let i = 0; i < moves.length; i++) moves[i] = pair[i].m;
    }

    if (bestScore > MATE - 200) break;
    if (performance.now() > ctx.deadline) break;
    if (ctx.nodes > ctx.maxNodes) break;
  }

  if (typeof globalThis.__aiProgress === 'function'){
    try {
      globalThis.__aiProgress({ depth: reached, nodes: ctx.nodes, ms: Math.round(performance.now() - t0) });
    } catch (e){}
  }

  return bestMove;
}

export const AI_LEVELS = LEVELS;
