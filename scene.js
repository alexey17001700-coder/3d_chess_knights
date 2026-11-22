/* ============================================================
   3D ШАХМАТЫ · РЫЦАРСКИЙ ТУРНИР — СЦЕНА
   ЭТАП 1: зал, доска, фигуры, свет, камера, настройки графики.
   ============================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildPiece, pieceMaterials } from './pieces.js';

/* ---------- ПРЕСЕТЫ КАЧЕСТВА ---------- */
const PRESETS = {
  low:    { dpr: 1.00, shadow: false, shadowSize: 512,  env: false, stars: 400,  seg: 14, floor: false },
  medium: { dpr: 1.30, shadow: true,  shadowSize: 1024, env: true,  stars: 900,  seg: 20, floor: true  },
  high:   { dpr: 1.70, shadow: true,  shadowSize: 2048, env: true,  stars: 1600, seg: 28, floor: true  },
  ultra:  { dpr: 2.00, shadow: true,  shadowSize: 4096, env: true,  stars: 2600, seg: 40, floor: true  }
};

const state = {
  mode: 'auto',
  level: 'high',
  opts: { shadow: true, env: true, stars: true, aa: true, adapt: true },
  dprScale: 1
};

const host = document.getElementById('app');
const fpsEl = document.getElementById('fps');
const qualEl = document.getElementById('qual');

/* ---------- СЦЕНА И КАМЕРА ---------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);
scene.fog = new THREE.FogExp2(0x05070d, 0.010);
const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(0, 10.5, 12.5);
/* ---------- АВТОПОДГОН ПОД ЛЮБОЙ ЭКРАН ---------- */
const FIT = {
  rx: 4.95,
  ry: 4.95,
  fill: 0.88,
  minFill: 0.40,
  minDist: 7.5,
  maxDist: 40
};

let fitDist = 20;
function hudInsets(){
  const h = window.innerHeight || 1;
  let top = 0, bottom = 0;
  const ids = ['ver', 'fps', 'turn', 'status', 'think'];
  for (const id of ids){
    const el = document.getElementById(id);
    if (!el) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.bottom > top) top = r.bottom;
  }
  const bar = document.getElementById('bar');
  if (bar){
    const r = bar.getBoundingClientRect();
    if (r.height > 0) bottom = Math.max(bottom, h - r.top);
  }
  return { top: Math.min(top + 12, h * 0.17), bottom: Math.min(bottom + 12, h * 0.17) };
}
/* FIT_END */

x

let renderer = null;
let controls = null;
let pmrem = null;
let envRT = null;

function createRenderer(){
  if (renderer){
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }
  if (controls) controls.dispose();
  if (envRT){ envRT.dispose(); envRT = null; }
  if (pmrem){ pmrem.dispose(); pmrem = null; }

  renderer = new THREE.WebGLRenderer({
    antialias: state.opts.aa,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.6, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.8;
  controls.minDistance = 7;
  controls.maxDistance = 30;
  controls.minPolarAngle = 0.18;
  controls.maxPolarAngle = 1.36;
  controls.update();

  pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
}

function buildEnv(){
  if (envRT || !pmrem) return;
  const room = new RoomEnvironment();
  envRT = pmrem.fromScene(room, 0.04);
  scene.environment = envRT.texture;
}

/* ---------- СВЕТ ---------- */
const hemi = new THREE.HemisphereLight(0x9fd8ff, 0x0a0f18, 0.60);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2dd, 2.60);
sun.position.set(6.5, 13, 8);
sun.castShadow = true;
sun.shadow.camera.left = -9;
sun.shadow.camera.right = 9;
sun.shadow.camera.top = 9;
sun.shadow.camera.bottom = -9;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 40;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const rimA = new THREE.PointLight(0x35c8ff, 90, 34, 2);
rimA.position.set(-8, 5.5, -7);
scene.add(rimA);

const rimB = new THREE.PointLight(0xff4fa3, 60, 34, 2);
rimB.position.set(8, 4.5, 7.5);
scene.add(rimB);

/* ---------- ДОСКА ---------- */
const boardGroup = new THREE.Group();
scene.add(boardGroup);

const matTileLight = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.34, metalness: 0.10, envMapIntensity: 0.90 });
const matTileDark  = new THREE.MeshStandardMaterial({ color: 0x1d2530, roughness: 0.30, metalness: 0.35, envMapIntensity: 1.00 });
const matFrame     = new THREE.MeshStandardMaterial({ color: 0x0d1219, roughness: 0.42, metalness: 0.55, envMapIntensity: 1.00 });
const matGlow      = new THREE.MeshStandardMaterial({ color: 0x0a1a24, emissive: 0x2ea8ff, emissiveIntensity: 1.8, roughness: 0.40, metalness: 0.20 });

const TILE_TOP = 0.14;

(function buildBoard(){
  const base = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.30, 9.0), matFrame);
  base.position.y = -0.15;
  base.receiveShadow = true;
  boardGroup.add(base);

  const tileGeo = new THREE.BoxGeometry(0.98, TILE_TOP, 0.98);
  for (let r = 0; r < 8; r++){
    for (let f = 0; f < 8; f++){
      const light = ((r + f) % 2) === 1;   /* a1 — тёмная */
      const t = new THREE.Mesh(tileGeo, light ? matTileLight : matTileDark);
      t.position.set(f - 3.5, TILE_TOP / 2, r - 3.5);
      t.receiveShadow = true;
      boardGroup.add(t);
    }
  }

  /* светящаяся кромка — «нексусовский» акцент */
  const rim = 4.62;
  const rims = [
    [0, 0.02, -rim, 9.3, 0.05, 0.09],
    [0, 0.02,  rim, 9.3, 0.05, 0.09],
    [-rim, 0.02, 0, 0.09, 0.05, 9.3],
    [ rim, 0.02, 0, 0.09, 0.05, 9.3]
  ];
  for (const [x, y, z, w, h, d] of rims){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matGlow);
    m.position.set(x, y, z);
    boardGroup.add(m);
  }
})();

/* ---------- ЗВЁЗДЫ ---------- */
let stars = null;
function buildStars(count){
  if (stars){
    stars.geometry.dispose();
    scene.remove(stars);
    stars = null;
  }
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++){
    const r = 45 + Math.random() * 90;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3]     = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = Math.abs(r * Math.cos(ph)) * 0.7 + 3;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xbfe4ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85 });
  stars = new THREE.Points(geo, mat);
  stars.frustumCulled = false;
  scene.add(stars);
}

/* ---------- ПОЛ ---------- */
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(240, 240),
  new THREE.MeshStandardMaterial({ color: 0x070b12, roughness: 0.26, metalness: 0.88, envMapIntensity: 1.15 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.31;
floor.receiveShadow = true;
scene.add(floor);

/* ---------- ФИГУРЫ ---------- */
const pieceGroup = new THREE.Group();
scene.add(pieceGroup);
let M = pieceMaterials();
let pieces = [];

const START = [
  ['r', 0, 0], ['n', 1, 0], ['b', 2, 0], ['q', 3, 0], ['k', 4, 0], ['b', 5, 0], ['n', 6, 0], ['r', 7, 0],
  ['p', 0, 1], ['p', 1, 1], ['p', 2, 1], ['p', 3, 1], ['p', 4, 1], ['p', 5, 1], ['p', 6, 1], ['p', 7, 1],
  ['p', 0, 6], ['p', 1, 6], ['p', 2, 6], ['p', 3, 6], ['p', 4, 6], ['p', 5, 6], ['p', 6, 6], ['p', 7, 6],
  ['r', 0, 7], ['n', 1, 7], ['b', 2, 7], ['q', 3, 7], ['k', 4, 7], ['b', 5, 7], ['n', 6, 7], ['r', 7, 7]
];

function squareToWorld(file, rank){
  return new THREE.Vector3(file - 3.5, TILE_TOP, rank - 3.5);
}

function buildPieces(seg){
  for (const p of pieces){
    pieceGroup.remove(p);
    p.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  pieces = [];
  for (const [type, file, rank] of START){
    const side = rank < 2 ? 'w' : 'b';
    const g = buildPiece(type, side, M, seg);
    const v = squareToWorld(file, rank);
    g.position.copy(v);
    if (side === 'b') g.rotation.y = Math.PI;   /* чёрные смотрят на белых */
    g.userData.file = file;
    g.userData.rank = rank;
    pieceGroup.add(g);
    pieces.push(g);
  }
  if (window.CHESS3D && window.CHESS3D.onPiecesRebuilt) window.CHESS3D.onPiecesRebuilt();
}

/* ---------- ПРИМЕНЕНИЕ КАЧЕСТВА ---------- */
function applyQuality(){
  const p = PRESETS[state.level];
  const o = state.opts;

  const useShadow = o.shadow && p.shadow;
  renderer.shadowMap.enabled = useShadow;
  sun.castShadow = useShadow;
  if (useShadow){
    if (sun.shadow.mapSize.x !== p.shadowSize){
      if (sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; }
      sun.shadow.mapSize.set(p.shadowSize, p.shadowSize);
    }
  }

  if (o.env && p.env){
    buildEnv();
    scene.environment = envRT ? envRT.texture : null;
  } else {
    scene.environment = null;
  }

  buildStars(o.stars ? p.stars : 0);
  if (stars) stars.visible = o.stars;

  floor.visible = p.floor;

  buildPieces(p.seg);
  applyDPR();

  qualEl.textContent = 'ГРАФИКА: ' + (state.mode === 'auto' ? 'АВТО · ' : '') + state.level.toUpperCase();
}

function applyDPR(){
  const p = PRESETS[state.level];
  const cap = Math.min(window.devicePixelRatio || 1, p.dpr);
  renderer.setPixelRatio(cap * state.dprScale);
}

/* ---------- АВТООПРЕДЕЛЕНИЕ УРОВНЯ ---------- */
function detectLevel(){
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;

  if (cores <= 4 && mem <= 3) return 'low';
  if (mobile && small) return (cores >= 8 && mem >= 6) ? 'medium' : 'low';
  if (cores >= 8 && mem >= 8) return 'ultra';
  if (cores >= 6) return 'high';
  return 'medium';
}

/* ---------- НАСТРОЙКИ (localStorage) ---------- */
const LS = 'chess3d_quality_v1';
function saveSettings(){
  try { localStorage.setItem(LS, JSON.stringify({ mode: state.mode, opts: state.opts })); } catch (e){}
}
function loadSettings(){
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.mode) state.mode = d.mode;
    if (d.opts) Object.assign(state.opts, d.opts);
  } catch (e){}
}

/* ---------- ЦИКЛ РЕНДЕРА + АДАПТИВНОЕ РАЗРЕШЕНИЕ ---------- */
let frames = 0, lastT = performance.now(), fps = 60;
let prevT = performance.now();

function adapt(){
  const p = PRESETS[state.level];
  if (fps < 42 && state.dprScale > 0.62){
    state.dprScale = Math.max(0.62, state.dprScale - 0.12);
    applyDPR();
  } else if (fps > 57 && state.dprScale < 1){
    state.dprScale = Math.min(1, state.dprScale + 0.06);
    applyDPR();
  }
}

function loop(){
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = now - prevT;
  prevT = now;

  controls.update();
  if (window.CHESS3D && window.CHESS3D.onFrame) window.CHESS3D.onFrame(now, dt);
  renderer.render(scene, camera);

  frames++;
  if (now - lastT >= 1000){
    fps = Math.round(frames * 1000 / (now - lastT));
    frames = 0; lastT = now;
    fpsEl.textContent = fps + ' FPS';
    if (state.opts.adapt) adapt();
  }
}

/* ---------- ИНТЕРФЕЙС НАСТРОЕК ---------- */
function syncUI(){
  document.querySelectorAll('.qbtn').forEach(b => {
    b.classList.toggle('act', b.dataset.q === state.mode);
  });
  document.getElementById('optShadow').checked = state.opts.shadow;
  document.getElementById('optEnv').checked = state.opts.env;
  document.getElementById('optStars').checked = state.opts.stars;
  document.getElementById('optAA').checked = state.opts.aa;
  document.getElementById('optAdapt').checked = state.opts.adapt;
}

function setMode(mode){
  state.mode = mode;
  state.level = (mode === 'auto') ? detectLevel() : mode;
  state.dprScale = 1;
  applyQuality();
  saveSettings();
  syncUI();
}

function wireUI(){
  const modal = document.getElementById('modal');
  document.getElementById('setBtn').addEventListener('click', () => modal.classList.add('on'));
  document.getElementById('winClose').addEventListener('click', () => modal.classList.remove('on'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('on'); });

  document.querySelectorAll('.qbtn').forEach(b => {
    b.addEventListener('click', () => setMode(b.dataset.q));
  });

  document.getElementById('optShadow').addEventListener('change', e => {
    state.opts.shadow = e.target.checked; applyQuality(); saveSettings();
  });
  document.getElementById('optEnv').addEventListener('change', e => {
    state.opts.env = e.target.checked; applyQuality(); saveSettings();
  });
  document.getElementById('optStars').addEventListener('change', e => {
    state.opts.stars = e.target.checked; applyQuality(); saveSettings();
  });
  document.getElementById('optAdapt').addEventListener('change', e => {
    state.opts.adapt = e.target.checked; saveSettings();
  });
  document.getElementById('optAA').addEventListener('change', e => {
    state.opts.aa = e.target.checked;
    saveSettings();
    createRenderer();          /* сглаживание задаётся при создании контекста */
    applyQuality();
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    applyDPR();
  });
}

/* ---------- СТАРТ ---------- */
function boot(){
  loadSettings();
  createRenderer();
  state.level = (state.mode === 'auto') ? detectLevel() : state.mode;
  applyQuality();
  wireUI();
  syncUI();
  loop();

  setTimeout(() => {
    const l = document.getElementById('load');
    if (l) l.classList.add('gone');
  }, 350);
}

boot();

/* ---------- ПУБЛИЧНЫЙ API (для ЭТАПА 2) ---------- */
window.CHESS3D = {
  THREE, scene, camera,
  get controls(){ return controls; },
  get renderer(){ return renderer; },
  boardGroup, pieceGroup,
  get pieces(){ return pieces; },
  squareToWorld, TILE_TOP,
  setMode, applyQuality,
  get state(){ return state; },
  get fps(){ return fps; },
  get materials(){ return M; },
  get seg(){ return PRESETS[state.level].seg; },
  onFrame: null,
  onPiecesRebuilt: null
};

/* ---------- ЭТАП 2: игровая логика ---------- */
import('./game.js').catch(e => console.error('game.js:', e));
