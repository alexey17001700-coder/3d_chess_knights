/* ============================================================
   3D ШАХМАТЫ — ЗВУК
   ЭТАП 3. Синтез через WebAudio: никаких mp3, ничего не грузится
   по сети и не отваливается. Контекст создаётся только после
   первого касания — браузеры иначе блокируют звук.
   ============================================================ */

let ctx = null;
let enabled = true;

function ac(){
  if (!enabled) return null;
  if (!ctx){
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e){ return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function setSound(on){
  enabled = !!on;
  if (enabled) ac();
}
export function isSoundOn(){ return enabled; }

function tone(freq, dur, type, gain, delay, slideTo){
  const c = ac();
  if (!c) return;
  const t = c.currentTime + (delay || 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain || 0.16, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.03);
}

function knock(dur, gain, freq, q, delay){
  const c = ac();
  if (!c) return;
  const t = c.currentTime + (delay || 0);
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++){
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq || 1200;
  bp.Q.value = q || 1.2;
  const g = c.createGain();
  g.gain.value = gain || 0.14;
  src.connect(bp);
  bp.connect(g);
  g.connect(c.destination);
  src.start(t);
}

export const S = {
  move(){
    knock(0.07, 0.13, 1500, 1.5);
    tone(190, 0.07, 'triangle', 0.09);
  },
  capture(){
    knock(0.17, 0.22, 720, 0.9);
    tone(130, 0.17, 'sawtooth', 0.11, 0, 68);
  },
  castle(){
    knock(0.07, 0.12, 1400, 1.5);
    tone(190, 0.07, 'triangle', 0.09);
    knock(0.07, 0.12, 1150, 1.5, 0.11);
    tone(160, 0.07, 'triangle', 0.09, 0.11);
  },
  promote(){
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.20, 'triangle', 0.12, i * 0.07));
  },
  check(){
    tone(880, 0.15, 'square', 0.09);
    tone(660, 0.24, 'square', 0.08, 0.13);
  },
  win(){
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.30, 'sine', 0.13, i * 0.09));
  },
  lose(){
    [440, 392, 330, 262].forEach((f, i) => tone(f, 0.32, 'sine', 0.12, i * 0.11));
  },
  draw(){
    tone(440, 0.30, 'sine', 0.10);
    tone(440, 0.30, 'sine', 0.10, 0.18);
  },
  tap(){
    tone(1250, 0.03, 'sine', 0.045);
  }
};
