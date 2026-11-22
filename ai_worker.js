/* ============================================================
   3D ШАХМАТЫ — ВОРКЕР СОПЕРНИКА
   Считает ход ИИ в отдельном потоке: сцена не подвисает,
   анимация и вращение камеры продолжают идти.
   Дополнительно отдаёт наружу прогресс счёта — глубину и узлы,
   чтобы индикатор «ИИ ДУМАЕТ…» показывал живую работу.
   ============================================================ */

import { chooseMove } from './ai.js';

/* прогресс уходит в главный поток отдельным сообщением */
globalThis.__aiProgress = (info) => {
  try { self.postMessage({ progress: true, info }); } catch (e){}
};

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
