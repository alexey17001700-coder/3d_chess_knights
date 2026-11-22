/* ============================================================
   3D ШАХМАТЫ · РЫЦАРСКИЙ ТУРНИР — ИГРА
   ЭТАП 2: выбор фигуры, подсветка ходов, анимация перемещения,
   взятие, превращение, история, отмена, конец партии.
   ============================================================ */

import * as THREE from 'three';
import { buildPiece } from './pieces.js';
import * as CH from './chess.js';

const C = window.CHESS3D;
if (!C) throw new Error('CHESS3D не готов');

const scene = C.scene;
const camera = C.camera;

/* ---------- СОСТОЯНИЕ ---------- */
let engine = CH.initialState();
let undoStack = [];
let sanList = [];
let allGroups = [];
let objBySquare = new Array(64).fill(null);
let selected = -1;
let legal = [];
let lastMove = null;
let busy = false;
let gameOver = false;

/* ---------- МАРКЕРЫ ---------- */
const markerGroup = new THREE.Group();
scene.add(markerGroup);

const matSel  = new THREE.MeshBasicMaterial({ color: 0xffc24d, transparent: true, opacity: 0.26, depthWrite: false });
const matDot  = new THREE.MeshBasicMaterial({ color: 0x5ce4ff, transparent: true, opacity: 0.90, depthWrite: false, side: THREE.DoubleSide });
const matRing = new THREE.MeshBasicMaterial({ color: 0xff5f8f, transparent: true, opacity: 0.90, depthWrite: false, side: THREE.DoubleSide });
const matLast = new THREE.MeshBasicMaterial({ color: 0x2ea8ff, transparent: true, opacity: 0.18, depthWrite: false });

const geoSel  = new THREE.PlaneGeometry(0.94, 0.94);
const geoDot  = new THREE.RingGeometry(0.10, 0.165, 22);
const geoRing = new THREE.RingGeometry(0.33, 0.425, 34);
const geoLast = new THREE.PlaneGeometry(0.94, 0.94);
const geoBurst = new THREE.RingGeometry(0.20, 0.30, 34);

let pulse = [];

function flat(m, y){
  m.rotation.x = -Math.PI / 2;
  m.position.y = C.TILE_TOP + (y === undefined ? 0.014 : y);
  return m;
}

function clearMarkers(){
  while (markerGroup.children.length) markerGroup.remove(markerGroup.children[0]);
  pulse = [];
}

function drawMarkers(){
  clearMarkers();

  if (lastMove){
    for (const sq of [lastMove.from, lastMove.to]){
      const m = flat(new THREE.Mesh(geoLast, matLast));
      m.position.x = CH.fileOf(sq) - 3.5;
      m.position.z = CH.rankOf(sq) - 3.5;
      markerGroup.add(m);
    }
  }

  if (selected >= 0){
    const s = flat(new THREE.Mesh(geoSel, matSel), 0.012);
    s.position.x = CH.fileOf(selected) - 3.5;
    s.position.z = CH.rankOf(selected) - 3.5;
    markerGroup.add(s);
  }

  for (const m of legal){
    const isCap = !!engine.board[m.to] || (engine.board[selected] && engine.board[selected].t === 'p' && m.to === engine.ep);
    const mesh = flat(new THREE.Mesh(isCap ? geoRing : geoDot, isCap ? matRing : matDot));
    mesh.position.x = CH.fileOf(m.to) - 3.5;
    mesh.position.z = CH.rankOf(m.to) - 3.5;
    markerGroup.add(mesh);
    pulse.push(mesh);
  }
}

/* ---------- СИНХРОНИЗАЦИЯ 3D С ДВИЖКОМ ---------- */
function placeAt(g, i){
  g.position.copy(C.squareToWorld(CH.fileOf(i), CH.rankOf(i)));
  g.rotation.set(0, g.userData.side === 'b' ? Math.PI : 0, 0);
  g.scale.setScalar(1);
  g.visible = true;
}

function spawnPiece(type, side){
  const g = buildPiece(type, side, C.materials, C.seg);
  C.pieceGroup.add(g);
  allGroups.push(g);
  return g;
}

function syncFromEngine(){
  for (const g of allGroups){
    g.visible = false;
    g.scale.setScalar(1);
  }
  objBySquare = new Array(64).fill(null);

  const pool = {};
  for (const g of allGroups){
    const k = g.userData.type + g.userData.side;
    (pool[k] = pool[k] || []).push(g);
  }

  for (let i = 0; i < 64; i++){
    const p = engine.board[i];
    if (!p) continue;
    const k = p.t + p.s;
    let g = (pool[k] && pool[k].length) ? pool[k].pop() : null;
    if (!g) g = spawnPiece(p.t, p.s);
    placeAt(g, i);
    objBySquare[i] = g;
  }
}

/* ---------- АНИМАЦИИ ---------- */
const tweens = [];
const captures = [];
const bursts = [];

function easeInOut(k){
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

function tweenMove(obj, toV, arc){
  return new Promise(res => {
    tweens.push({
      obj, fromV: obj.position.clone(), toV,
      arc: arc ? 1.45 : 0,
      dur: arc ? 520 : 330,
      t0: performance.now(), done: res
    });
  });
}

function tweenCapture(obj){
  return new Promise(res => {
    captures.push({
      obj, p0: obj.position.clone(), rot0: obj.rotation.y,
      t0: performance.now(), dur: 430, done: res
    });
  });
}

function burst(x, z, color){
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
  const m = flat(new THREE.Mesh(geoBurst, mat), 0.02);
  m.position.x = x; m.position.z = z;
  markerGroup.add(m);
  bursts.push({ m, mat, t0: performance.now(), dur: 520 });
}

function stepAnim(now){
  for (let i = tweens.length - 1; i >= 0; i--){
    const t = tweens[i];
    let k = (now - t.t0) / t.dur;
    if (k > 1) k = 1;
    const e = easeInOut(k);
    t.obj.position.lerpVectors(t.fromV, t.toV, e);
    if (t.arc) t.obj.position.y += Math.sin(Math.PI * k) * t.arc;
    if (k >= 1){ tweens.splice(i, 1); if (t.done) t.done(); }
  }

  for (let i = captures.length - 1; i >= 0; i--){
    const c = captures[i];
    let k = (now - c.t0) / c.dur;
    if (k > 1) k = 1;
    const e = k * k;
    c.obj.scale.setScalar(Math.max(0.001, 1 - e * 0.98));
    c.obj.position.y = c.p0.y - e * 0.75;
    c.obj.rotation.y = c.rot0 + e * 2.4;
    if (k >= 1){
      c.obj.visible = false;
      c.obj.scale.setScalar(1);
      c.obj.rotation.y = c.rot0;
      c.obj.position.copy(c.p0);
      captures.splice(i, 1);
      if (c.done) c.done();
    }
  }

  for (let i = bursts.length - 1; i >= 0; i--){
    const b = bursts[i];
    let k = (now - b.t0) / b.dur;
    if (k > 1) k = 1;
    const s = 1 + k * 3.2;
    b.m.scale.set(s, s, s);
    b.mat.opacity = 0.95 * (1 - k);
    if (k >= 1){
      markerGroup.remove(b.m);
      b.mat.dispose();
      bursts.splice(i, 1);
    }
  }

  const ph = (now % 1400) / 1400;
  const sc = 1 + Math.sin(ph * Math.PI * 2) * 0.10;
  for (const m of pulse) m.scale.set(sc, sc, sc);
}

/* ---------- ВЫБОР И ХОД ---------- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -C.TILE_TOP);
const hitPt = new THREE.Vector3();

function setRay(clientX, clientY){
  const rect = C.renderer.domElement.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  ray.setFromCamera(ndc, camera);
}

function pickPiece(clientX, clientY){
  setRay(clientX, clientY);
  const live = allGroups.filter(g => g.visible);
  const hits = ray.intersectObjects(live, true);
  if (!hits.length) return -1;
  let o = hits[0].object;
  while (o && !o.userData.type) o = o.parent;
  if (!o) return -1;
  return objBySquare.indexOf(o);
}

function pickBoard(clientX, clientY){
  setRay(clientX, clientY);
  if (!ray.ray.intersectPlane(groundPlane, hitPt)) return -1;
  const f = Math.round(hitPt.x + 3.5);
  const r = Math.round(hitPt.z + 3.5);
  if (f < 0 || f > 7 || r < 0 || r > 7) return -1;
  return CH.idx(f, r);
}

function deselect(){
  selected = -1;
  legal = [];
  drawMarkers();
}

function selectSquare(i){
  const p = engine.board[i];
  if (!p || p.s !== engine.turn) return;
  selected = i;
  legal = CH.legalMoves(engine, i);
  drawMarkers();
}

function onTap(x, y){
  if (busy || gameOver) return;
  hideHint();

  const sq = pickPiece(x, y);
  if (sq >= 0){
    const p = engine.board[sq];
    if (p && p.s === engine.turn){
      if (selected === sq){ deselect(); return; }
      selectSquare(sq);
      return;
    }
    if (selected >= 0 && legal.some(m => m.to === sq)){ playMove(selected, sq); return; }
    deselect();
    return;
  }

  const target = pickBoard(x, y);
  if (target < 0){ deselect(); return; }

  if (selected >= 0 && legal.some(m => m.to === target)){ playMove(selected, target); return; }

  const p = engine.board[target];
  if (p && p.s === engine.turn) selectSquare(target);
  else deselect();
}

async function playMove(from, to){
  const cands = legal.filter(m => m.to === to);
  if (!cands.length) return;

  let move = cands[0];
  if (cands.length > 1 && cands[0].promo){
    const pick = await askPromotion(engine.turn);
    if (!pick) return;
    move = cands.find(m => m.promo === pick) || cands[0];
  }

  busy = true;
  clearMarkers();
  selected = -1;
  legal = [];

  const san = CH.toSAN(engine, move);
  const before = engine;
  const res = CH.makeMove(engine, move);

  const mover = objBySquare[from];
  let victim = null;
  if (res.captured){
    const capSq = res.epCapture ? CH.idx(CH.fileOf(to), CH.rankOf(from)) : to;
    victim = objBySquare[capSq];
  }

  const toV = C.squareToWorld(CH.fileOf(to), CH.rankOf(to));
  const isKnight = before.board[from].t === 'n';

  const jobs = [];
  if (mover) jobs.push(tweenMove(mover, toV, isKnight));
  if (victim){
    jobs.push(tweenCapture(victim));
    burst(toV.x, toV.z, res.captured.s === 'w' ? 0xffd27a : 0xff5f8f);
  }
  await Promise.all(jobs);

  undoStack.push({ state: before, lastMove });
  engine = res.state;
  sanList.push(san);
  lastMove = { from, to };

  syncFromEngine();
  drawMarkers();
  renderMoves();
  updateHUD();
  busy = false;

  checkEnd();
}

/* ---------- ПРЕВРАЩЕНИЕ ---------- */
function askPromotion(side){
  return new Promise(res => {
    const box = document.getElementById('promo');
    const row = document.getElementById('promoRow');
    row.innerHTML = '';
    const names = { q: 'ФЕРЗЬ', r: 'ЛАДЬЯ', b: 'СЛОН', n: 'КОНЬ' };
    for (const t of ['q', 'r', 'b', 'n']){
      const b = document.createElement('button');
      b.className = 'pbtn';
      b.textContent = names[t];
      b.addEventListener('click', () => { box.classList.remove('on'); res(t); }, { once: true });
      row.appendChild(b);
    }
    box.classList.add('on');
  });
}

/* ---------- КОНЕЦ ПАРТИИ ---------- */
function checkEnd(){
  const st = CH.status(engine);
  if (st.over){
    gameOver = true;
    const banner = document.getElementById('banner');
    const txt = document.getElementById('bannerTxt');
    if (st.result === 'draw') txt.textContent = 'НИЧЬЯ · ' + st.reason;
    else txt.textContent = (st.result === 'w' ? 'БЕЛЫЕ' : 'ЧЁРНЫЕ') + ' ПОБЕДИЛИ · ' + st.reason;
    banner.classList.add('on');
  } else if (st.check){
    burst(0, 0, 0x000000);
    const b = document.getElementById('banner');
    document.getElementById('bannerTxt').textContent = 'ШАХ!';
    b.classList.add('on');
    setTimeout(() => { if (!gameOver) b.classList.remove('on'); }, 1100);
  }
}

/* ---------- ИНТЕРФЕЙС ---------- */
const turnEl = document.getElementById('turn');
const statusEl = document.getElementById('status');
const movesEl = document.getElementById('moves');

function updateHUD(){
  const st = CH.status(engine);
  const w = engine.turn === 'w';
  turnEl.querySelector('span').textContent = w ? 'ХОД БЕЛЫХ' : 'ХОД ЧЁРНЫХ';
  turnEl.classList.toggle('black', !w);

  if (gameOver) statusEl.textContent = 'ПАРТИЯ ОКОНЧЕНА';
  else if (st.check) statusEl.textContent = 'ШАХ';
  else statusEl.textContent = 'ХОДОВ: ' + Math.ceil(sanList.length / 2);
  statusEl.classList.toggle('warn', !!st.check && !gameOver);
}

function renderMoves(){
  let html = '';
  for (let i = 0; i < sanList.length; i += 2){
    const n = i / 2 + 1;
    html += '<div class="mv"><b>' + n + '.</b><span>' + sanList[i] + '</span><span>' +
      (sanList[i + 1] || '') + '</span></div>';
  }
  movesEl.innerHTML = html;
  movesEl.scrollTop = movesEl.scrollHeight;
}

function hideHint(){
  const h = document.getElementById('hint');
  if (h) h.classList.add('gone');
}

function newGame(){
  engine = CH.initialState();
  undoStack = [];
  sanList = [];
  lastMove = null;
  selected = -1;
  legal = [];
  busy = false;
  gameOver = false;
  document.getElementById('banner').classList.remove('on');
  syncFromEngine();
  drawMarkers();
  renderMoves();
  updateHUD();
}

function undo(){
  if (busy || !undoStack.length) return;
  const prev = undoStack.pop();
  engine = prev.state;
  lastMove = prev.lastMove;
  sanList.pop();
  selected = -1;
  legal = [];
  gameOver = false;
  document.getElementById('banner').classList.remove('on');
  syncFromEngine();
  drawMarkers();
  renderMoves();
  updateHUD();
}

function flip(){
  const p = camera.position;
  camera.position.set(-p.x, p.y, -p.z);
  controls.update();
}

function wireUI(){
  document.getElementById('btnNew').addEventListener('click', newGame);
  document.getElementById('btnUndo').addEventListener('click', undo);
  document.getElementById('btnFlip').addEventListener('click', flip);
  document.getElementById('btnNew2').addEventListener('click', newGame);

  const list = document.getElementById('moveList');
  document.getElementById('btnList').addEventListener('click', () => list.classList.toggle('on'));
  document.getElementById('listClose').addEventListener('click', () => list.classList.remove('on'));

  let dx0 = 0, dy0 = 0, t0 = 0, armed = false;

  window.addEventListener('pointerdown', e => {
    if (!e.target || e.target.tagName !== 'CANVAS') return;
    armed = true; dx0 = e.clientX; dy0 = e.clientY; t0 = performance.now();
  }, { passive: true });

  window.addEventListener('pointerup', e => {
    if (!armed) return;
    armed = false;
    if (!e.target || e.target.tagName !== 'CANVAS') return;
    if (Math.hypot(e.clientX - dx0, e.clientY - dy0) > 11) return;
    if (performance.now() - t0 > 650) return;
    onTap(e.clientX, e.clientY);
  }, { passive: true });

  window.addEventListener('resize', () => { drawMarkers(); });
}

/* ---------- ХУКИ СЦЕНЫ ---------- */
C.onFrame = (now) => stepAnim(now);

C.onPiecesRebuilt = () => {
  allGroups = C.pieces.slice();
  syncFromEngine();
  drawMarkers();
};

/* ---------- СТАРТ ---------- */
allGroups = C.pieces.slice();
syncFromEngine();
renderMoves();
updateHUD();
wireUI();
