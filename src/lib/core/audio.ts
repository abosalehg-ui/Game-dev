// مؤثرات صوتية مولّدة بـ Web Audio — سياق واحد، بلا ملفات خارجية.

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean): void {
  enabled = v;
}

function ac(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, dur: number, delay = 0, type: OscillatorType = 'sine', vol = 0.12): void {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur);
}

const SOUNDS: Record<string, () => void> = {
  tap: () => tone(700, 0.06, 0, 'square', 0.05),
  start: () => { tone(440, 0.1); tone(660, 0.1, 0.09); },
  coin: () => { tone(880, 0.07, 0, 'square', 0.08); tone(1320, 0.1, 0.06, 'square', 0.08); },
  event: () => { tone(520, 0.12, 0, 'triangle'); tone(390, 0.15, 0.1, 'triangle'); },
  release: () => { tone(523, 0.1); tone(659, 0.1, 0.1); tone(784, 0.18, 0.2); },
  fanfare: () => { tone(523, 0.12); tone(659, 0.12, 0.1); tone(784, 0.12, 0.2); tone(1047, 0.3, 0.3); },
  research: () => { tone(600, 0.08, 0, 'triangle'); tone(900, 0.12, 0.08, 'triangle'); },
  achievement: () => { tone(784, 0.1); tone(988, 0.1, 0.09); tone(1175, 0.2, 0.18); },
  fail: () => { tone(330, 0.2, 0, 'sawtooth', 0.08); tone(247, 0.3, 0.18, 'sawtooth', 0.08); },
};

export function sfx(name: keyof typeof SOUNDS | string): void {
  if (!enabled) return;
  try { SOUNDS[name]?.(); } catch { /* ignore */ }
}

export function haptic(ms = 15): void {
  try { navigator.vibrate?.(ms); } catch { /* ignore */ }
}
