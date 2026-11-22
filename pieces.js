/* ============================================================
   3D ШАХМАТЫ · РЫЦАРСКИЙ ТУРНИР — ФИГУРЫ
   Всё строится кодом, без внешних моделей (быстро грузится,
   ничего не «отваливается» по 404).
   Тело точим на «станке» — LatheGeometry (тело вращения).
   Голову коня вырезаем из силуэта — ExtrudeGeometry.
   ============================================================ */

import * as THREE from 'three';

/* ---------- вспомогательное ---------- */

function lathe(pts, seg, phiStart, phiLength){
  const v = pts.map(p => new THREE.Vector2(p[0], p[1]));
  const g = (phiStart === undefined)
    ? new THREE.LatheGeometry(v, seg)
    : new THREE.LatheGeometry(v, seg, phiStart, phiLength);
  g.computeVertexNormals();
  return g;
}

function mesh(geo, mat){
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* Ножка: от базы к верху, вогнутый профиль (как у настоящих фигур) */
function stemPts(topY, rTop, rBase, yBase){
  rBase = (rBase === undefined) ? 0.25 : rBase;
  yBase = (yBase === undefined) ? 0.185 : yBase;
  const pts = [[rBase, yBase]];
  const steps = 7;
  for (let i = 1; i <= steps; i++){
    const t = i / steps;
    const y = yBase + (topY - yBase) * t;
    const r = rTop + (rBase - rTop) * Math.pow(1 - t, 1.9);
    pts.push([r, y]);
  }
  return pts;
}

/* Общая база — ступенчатый «пьедестал» */
const BASE = [
  [0.000, 0.000], [0.300, 0.000], [0.440, 0.000], [0.470, 0.026],
  [0.462, 0.060], [0.400, 0.094], [0.330, 0.126], [0.280, 0.156], [0.250, 0.185]
];

/* ---------- материалы ---------- */

export function pieceMaterials(){
  const white = new THREE.MeshStandardMaterial({
    color: 0xf2e8d2, roughness: 0.40, metalness: 0.05, envMapIntensity: 0.95
  });
  const black = new THREE.MeshStandardMaterial({
    color: 0x1a1f27, roughness: 0.28, metalness: 0.42, envMapIntensity: 1.15
  });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xd9a94b, roughness: 0.26, metalness: 0.92, envMapIntensity: 1.35
  });
  const steel = new THREE.MeshStandardMaterial({
    color: 0x8d99a8, roughness: 0.30, metalness: 0.85, envMapIntensity: 1.25
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x090c11, roughness: 0.55, metalness: 0.25, envMapIntensity: 0.70
  });
  return { white, black, gold, steel, dark };
}

/* ---------- силуэт головы коня ---------- */

function knightShape(){
  const s = new THREE.Shape();
  s.moveTo(0.00, 0.00);
  s.bezierCurveTo(0.16, 0.00, 0.28, 0.03, 0.32, 0.10);
  s.bezierCurveTo(0.35, 0.16, 0.33, 0.22, 0.36, 0.27);
  s.bezierCurveTo(0.42, 0.31, 0.50, 0.33, 0.53, 0.39);
  s.bezierCurveTo(0.55, 0.44, 0.50, 0.48, 0.44, 0.50);
  s.bezierCurveTo(0.38, 0.52, 0.32, 0.51, 0.28, 0.55);
  s.bezierCurveTo(0.24, 0.62, 0.23, 0.72, 0.24, 0.84);
  s.bezierCurveTo(0.25, 0.94, 0.20, 1.02, 0.10, 1.06);
  s.bezierCurveTo(0.04, 1.08, 0.00, 1.06, -0.02, 1.14);
  s.bezierCurveTo(-0.06, 1.18, -0.10, 1.10, -0.12, 1.02);
  s.bezierCurveTo(-0.18, 0.96, -0.24, 0.86, -0.26, 0.72);
  s.bezierCurveTo(-0.28, 0.56, -0.26, 0.40, -0.20, 0.24);
  s.bezierCurveTo(-0.14, 0.10, -0.08, 0.02, 0.00, 0.00);
  return s;
}

/* ---------- сборка фигуры ----------
   type: p r n b q k
   side: 'w' | 'b'
   seg : сегментов сглаживания (зависит от уровня графики)
--------------------------------- */
export function buildPiece(type, side, M, seg){
  const g = new THREE.Group();
  const body = (side === 'w') ? M.white : M.black;
  const trim = (side === 'w') ? M.gold : M.steel;
  const lowSeg = Math.max(8, seg >> 1);

  g.add(mesh(lathe(BASE, seg), body));

  switch (type){

    /* ---- ПЕШКА ---- */
    case 'p': {
      g.add(mesh(lathe(stemPts(0.60, 0.13), seg), body));
      const collar = mesh(new THREE.TorusGeometry(0.145, 0.032, 10, seg), trim);
      collar.rotation.x = Math.PI / 2; collar.position.y = 0.615; g.add(collar);
      g.add(mesh(lathe([[0.10, 0.63], [0.118, 0.70], [0.10, 0.745]], seg), body));
      const head = mesh(new THREE.SphereGeometry(0.185, seg, lowSeg), body);
      head.position.y = 0.885; g.add(head);
      break;
    }

    /* ---- ЛАДЬЯ ---- */
    case 'r': {
      g.add(mesh(lathe(stemPts(0.72, 0.17), seg), body));
      const collar = mesh(new THREE.TorusGeometry(0.195, 0.038, 10, seg), trim);
      collar.rotation.x = Math.PI / 2; collar.position.y = 0.735; g.add(collar);
      const tower = mesh(new THREE.CylinderGeometry(0.255, 0.275, 0.28, seg), body);
      tower.position.y = 0.90; g.add(tower);
      const ring = mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.07, seg), trim);
      ring.position.y = 1.065; g.add(ring);
      for (let i = 0; i < 8; i++){
        const a = i / 8 * Math.PI * 2;
        const c = mesh(new THREE.BoxGeometry(0.11, 0.13, 0.11), body);
        c.position.set(Math.cos(a) * 0.215, 1.16, Math.sin(a) * 0.215);
        c.rotation.y = -a;
        g.add(c);
      }
      break;
    }

    /* ---- СЛОН ---- */
    case 'b': {
      g.add(mesh(lathe(stemPts(0.70, 0.15), seg), body));
      const collar = mesh(new THREE.TorusGeometry(0.175, 0.036, 10, seg), trim);
      collar.rotation.x = Math.PI / 2; collar.position.y = 0.715; g.add(collar);

      /* митра из двух половин — между ними настоящая прорезь */
      const MITRE = [
        [0.000, 0.735], [0.155, 0.735], [0.185, 0.780], [0.215, 0.860],
        [0.225, 0.950], [0.205, 1.030], [0.155, 1.100], [0.085, 1.150],
        [0.030, 1.180], [0.000, 1.190]
      ];
      const gap = 0.055;
      g.add(mesh(lathe(MITRE, seg, gap, Math.PI - gap * 2), body));
      g.add(mesh(lathe(MITRE, seg, Math.PI + gap, Math.PI - gap * 2), body));

      const finial = mesh(new THREE.SphereGeometry(0.062, seg, lowSeg), trim);
      finial.position.y = 1.235; g.add(finial);
      break;
    }

    /* ---- КОНЬ ---- */
    case 'n': {
      g.add(mesh(lathe(stemPts(0.42, 0.20), seg), body));
      const collar = mesh(new THREE.TorusGeometry(0.215, 0.045, 10, seg), trim);
      collar.rotation.x = Math.PI / 2; collar.position.y = 0.435; g.add(collar);

      const head = new THREE.Group();

      const geo = new THREE.ExtrudeGeometry(knightShape(), {
        depth: 0.30,
        bevelEnabled: true,
        bevelThickness: 0.035,
        bevelSize: 0.035,
        bevelSegments: 3,
        curveSegments: Math.max(6, seg >> 2)
      });
      geo.translate(0, 0, -0.15);

      const hm = mesh(geo, body);
      hm.rotation.y = -Math.PI / 2;   /* морда смотрит вперёд, грива назад */
      head.add(hm);

      /* грива */
      for (let i = 0; i < 6; i++){
        const t = i / 5;
        const b = mesh(new THREE.BoxGeometry(0.20, 0.11, 0.11), M.dark);
        b.position.set(0, 0.50 + t * 0.50, -0.19 - Math.sin(t * Math.PI) * 0.05 - t * 0.05);
        b.rotation.x = -0.45 - t * 0.55;
        head.add(b);
      }
      /* глаза */
      for (const sx of [-1, 1]){
        const e = mesh(new THREE.SphereGeometry(0.028, 10, 8), M.dark);
        e.position.set(sx * 0.135, 0.855, 0.20);
        head.add(e);
      }

      head.scale.setScalar(0.78);
      head.position.y = 0.44;
      g.add(head);
      break;
    }

    /* ---- ФЕРЗЬ ---- */
    case 'q': {
      g.add(mesh(lathe(stemPts(0.86, 0.18), seg), body));
      const collar = mesh(new THREE.TorusGeometry(0.205, 0.040, 10, seg), trim);
      collar.rotation.x = Math.PI / 2; collar.position.y = 0.875; g.add(collar);

      g.add(mesh(lathe([
        [0.000, 0.895], [0.240, 0.895], [0.265, 0.940], [0.275, 1.020],
        [0.255, 1.090], [0.215, 1.130], [0.200, 1.150]
      ], seg), body));

      for (let i = 0; i < 8; i++){
        const a = i / 8 * Math.PI * 2;
        const p = mesh(new THREE.SphereGeometry(0.058, seg, lowSeg), trim);
        p.position.set(Math.cos(a) * 0.215, 1.190, Math.sin(a) * 0.215);
        g.add(p);
      }
      const orb = mesh(new THREE.SphereGeometry(0.078, seg, lowSeg), trim);
      orb.position.y = 1.270; g.add(orb);
      break;
    }

    /* ---- КОРОЛЬ ---- */
    case 'k': {
      g.add(mesh(lathe(stemPts(0.92, 0.19), seg), body));
      const collar = mesh(new THREE.TorusGeometry(0.215, 0.042, 10, seg), trim);
      collar.rotation.x = Math.PI / 2; collar.position.y = 0.935; g.add(collar);

      g.add(mesh(lathe([
        [0.000, 0.955], [0.250, 0.955], [0.275, 1.000], [0.285, 1.080],
        [0.265, 1.160], [0.225, 1.200], [0.210, 1.220]
      ], seg), body));

      const v = mesh(new THREE.BoxGeometry(0.075, 0.30, 0.075), trim);
      v.position.y = 1.370; g.add(v);
      const h = mesh(new THREE.BoxGeometry(0.22, 0.075, 0.075), trim);
      h.position.y = 1.400; g.add(h);
      break;
    }
  }

  g.userData.type = type;
  g.userData.side = side;
  return g;
}
