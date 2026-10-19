// Sons gerados na hora com Web Audio, sem arquivo nenhum.
// O navegador só libera áudio depois de um clique/tecla, por isso o init() é chamado no primeiro input.

const SR = 22050;
const MUTE_KEY = 'capivara-of-war:mudo';
let ac = null, master = null, sfxBus = null, musicBus = null;
const buffers = {}, playing = {};
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch {}

const sq = (p) => (p % 1 < 0.5 ? 1 : -1);
const tri = (p) => 4 * Math.abs((p % 1) - 0.5) - 1;
const noise = () => Math.random() * 2 - 1;

function make(dur, fn) {
  const b = ac.createBuffer(1, Math.ceil(dur * SR), SR), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = fn(i / d.length);
  return b;
}
// frequência indo de f0 até f1, volume caindo até zero
function sweep(dur, f0, f1, wave, vol) {
  let ph = 0;
  return make(dur, (k) => { ph += (f0 + (f1 - f0) * k) / SR; return wave(ph) * vol * (1 - k); });
}
// ruído abafado (a = quanto deixa passar de agudo)
function thump(dur, a, vol) {
  let y = 0;
  return make(dur, (k) => { y += (noise() - y) * a; return y * vol * (1 - k) * (1 - k); });
}
function notes(dur, freqs, wave, vol) {
  let ph = 0;
  return make(dur, (k) => {
    const n = Math.min(freqs.length - 1, Math.floor(k * freqs.length));
    ph += freqs[n] / SR;
    return wave(ph) * vol * (1 - ((k * freqs.length) % 1) * 0.5) * (1 - k * 0.5);
  });
}

function build() {
  buffers.hit = thump(0.08, 0.5, 0.5);
  buffers.shoot = sweep(0.12, 900, 300, sq, 0.18);
  buffers.boom = thump(0.45, 0.08, 1.2);
  buffers.thud = thump(0.2, 0.15, 0.9);
  buffers.die = sweep(0.3, 520, 140, tri, 0.35);
  buffers.coin = notes(0.16, [988, 1319], sq, 0.12);
  buffers.click = sweep(0.05, 600, 900, sq, 0.12);
  buffers.deny = notes(0.16, [196, 147], sq, 0.1);
  buffers.special = sweep(0.7, 180, 1400, tri, 0.3);
  buffers.evolve = notes(0.6, [523, 659, 784, 1047], sq, 0.16);
  buffers.win = notes(1.2, [523, 659, 784, 1047, 784, 1047], sq, 0.18);
  buffers.lose = notes(1.2, [392, 330, 262, 196], tri, 0.3);
  buffers.kick = sweep(0.12, 150, 40, (p) => Math.sin(p * 2 * Math.PI), 0.8);
  buffers.snare = thump(0.12, 0.7, 0.35);
  buffers.hat = thump(0.04, 0.95, 0.15);
}

export function init() {
  if (ac) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  ac = new Ctx();
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination);
  sfxBus = ac.createGain(); sfxBus.connect(master);
  musicBus = ac.createGain(); musicBus.gain.value = 0.35; musicBus.connect(master);
  build();
  startMusic();
}

// no máximo 3 do mesmo som tocando junto, senão 10 estilingues estouram o volume
export function play(name) {
  if (!ac || muted || !buffers[name] || (playing[name] || 0) >= 3) return; // evento sem som (ex.: moedinha do outro lado)
  const src = ac.createBufferSource();
  src.buffer = buffers[name];
  src.connect(sfxBus);
  playing[name] = (playing[name] || 0) + 1;
  src.onended = () => playing[name]--;
  src.start();
}

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch {}
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}
export const isMuted = () => muted;

// Música: 32 colcheias em loop. "." = pausa.
const SONG = {
  bpm: 112,
  lead: 'A4 . C5 . D5 . E5 D5 C5 . A4 . G4 . A4 . A4 . C5 . D5 . G5 E5 D5 . C5 . D5 . . .',
  bass: 'A2 . A2 . A2 . A2 . F2 . F2 . G2 . G2 . A2 . A2 . A2 . A2 . F2 . F2 . E2 . E2 .',
  drums: 'k . h . s . h . k k h . s . h h k . h . s . h . k k h . s . s s',
};
const freq = (n) => {
  const i = 'C C# D D# E F F# G G# A A# B'.split(' ').indexOf(n.slice(0, -1));
  return 440 * 2 ** ((i + (+n.at(-1) + 1) * 12 - 69) / 12);
};
const parse = (s) => s.split(' ').map((n) => (n === '.' ? 0 : freq(n)));
const LEAD = parse(SONG.lead), BASS = parse(SONG.bass), DRUMS = SONG.drums.split(' ');

function tone(f, at, dur, type, vol) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + dur);
  o.connect(g); g.connect(musicBus);
  o.start(at); o.stop(at + dur);
}
function hit(name, at) {
  const s = ac.createBufferSource();
  s.buffer = buffers[name]; s.connect(musicBus); s.start(at);
}

function startMusic() {
  const step = 60 / SONG.bpm / 2;
  let n = 0, next = ac.currentTime + 0.1;
  // agenda as notas um pouco à frente; o setInterval só precisa ser "mais ou menos" pontual
  setInterval(() => {
    while (next < ac.currentTime + 0.2) {
      const i = n % LEAD.length;
      if (LEAD[i]) tone(LEAD[i], next, step * 0.9, 'square', 0.06);
      if (BASS[i]) tone(BASS[i], next, step * 1.8, 'triangle', 0.18);
      if (DRUMS[i] === 'k') hit('kick', next);
      else if (DRUMS[i] === 's') hit('snare', next);
      else if (DRUMS[i] === 'h') hit('hat', next);
      next += step;
      n++;
    }
  }, 50);
}
