/* ============================================================
   3D ШАХМАТЫ — ВОРКЕР СОПЕРНИКА
   Считает ход ИИ в отдельном потоке: сцена не подвисает,
   анимация и вращение камеры продолжают идти.
   ============================================================ */

import { chooseMove } from './ai.js';

self.onmessage = (e) => {
  const { id, state, level } = e.data || {};
  let move = null;
  try {
    move = chooseMove(state, level);
  } catch (err){
    move = null;
  }
  self.postMessage({ id, move });
};
