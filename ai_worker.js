/* ============================================================
   3D ШАХМАТЫ — ВОРКЕР СОПЕРНИКА
   Считает ход ИИ в отдельном потоке: сцена не подвисает,
   анимация и вращение камеры продолжают идти.
   Дополнительно отдаёт наружу прогресс счёта — глубину и узлы,
   чтобы индикатор «ИИ ДУМАЕТ…» показывал живую работу.

   ВАЖНО: модуль ai.js грузится с той же меткой версии, что и сам
   воркер, иначе браузер отдал бы старый ai.js из кэша.
   ============================================================ */

const V = self.location.search || '';
let chooseMove = null;
let aiErr = null;

const ready = import('./ai.js' + V)
  .then(m => { chooseMove = m.chooseMove; })
  .catch(e => { aiErr = e; });

/* прогресс уходит в главный поток отдельным сообщением */
globalThis.__aiProgress = (info) => {
  try { self.postMessage({ progress: true, info }); } catch (e){}
};

self.onmessage = async (e) => {
  const { id, state, level } = e.data || {};
  let move = null;
  try {
    await ready;
    if (!chooseMove && !aiErr){
      const m = await import('./ai.js' + V);
      chooseMove = m.chooseMove;
    }
    if (chooseMove) move = chooseMove(state, level);
  } catch (err){
    move = null;
  }
  self.postMessage({ id, move });
};