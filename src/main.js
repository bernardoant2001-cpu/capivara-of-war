import { W, H, RES, WORLD, HUD_H, TURRET_W, TURRET_H, slotY } from './data.js';
import { newGame, update, train, buyTurret, buySlot, sellTurret, evolve, special } from './battle.js';
import {
  draw, drawMenu, drawLangPick, drawAchievements, ready, effect, LANG_BTN, LANG_PICK, MODE_BTN, ACH_BTN, BACK_BTN, BUTTONS, SLOT_BTN, SELL_BTN, TOGGLE_BTN, SPECIAL_BTN, EVOLVE_BTN, MENU_BTNS,
} from './render.js';
import * as audio from './audio.js';
import { toggleLang, setLang } from './i18n.js';
import { check } from './achievements.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = W * RES; canvas.height = H * RES;
ctx.imageSmoothingEnabled = false;

// Escala inteira em pixels reais da tela quando cabe (pixel perfeito); se a tela for menor, reduz suavizando.
function fit() {
  const dpr = devicePixelRatio || 1;
  const s = Math.min(innerWidth * dpr / canvas.width, innerHeight * dpr / canvas.height);
  const k = s >= 1 ? Math.floor(s) : s;
  canvas.style.width = canvas.width * k / dpr + 'px';
  canvas.style.height = canvas.height * k / dpr + 'px';
  canvas.style.imageRendering = k >= 1 ? 'pixelated' : 'auto';
}
addEventListener('resize', fit);
fit();

const RECORDS_KEY = 'capivara-of-war:recordes', WAVES_KEY = 'capivara-of-war:ondas', ACH_KEY = 'capivara-of-war:conquistas';
function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    if (v && typeof v === 'object') return v;
  } catch {}
  return fallback;
}
const save = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };
const achSaved = load(ACH_KEY, { got: [], kills: 0 });

let g = null; // null = menu
const ui = {
  cam: 0, paused: false, showFps: false, fps: 0, towers: false, selling: false,
  hover: -1, hoverMenu: -1, mx: -1, my: -1, newRecord: false, saved: false, muted: audio.isMuted(),
  records: load(RECORDS_KEY, [null, null, null, null]), // vitória mais rápida (s) por dificuldade
  waves: load(WAVES_KEY, [null, null, null, null]), // melhor onda no infinito
  got: new Set(achSaved.got), kills: achSaved.kills || 0, toasts: [],
  mode: 'classic',
  screen: 'lang', // lang -> menu (ou conquistas) -> jogo
};
const keys = new Set();
let mouseX = -1, mouseY = -1, dragX = null;

const toGame = (e) => {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height];
};
const inside = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;

// atalhos de teste no endereço: ?era=N começa os dois lados na era N; ?ouro=N começa com esse ouro
const params = new URLSearchParams(location.search);
const startEra = Math.max(1, +params.get('era') || 1), startGold = +params.get('ouro') || 0;

function start(diff) {
  g = newGame(diff, true, ui.mode);
  for (let i = 1; i < startEra; i++) { evolve(g, 0, true); evolve(g, 1, true); }
  g.sides[0].gold = g.sides[1].gold = startGold || 175 * 3 ** (startEra - 1);
  Object.assign(ui, { cam: 0, paused: false, towers: false, selling: false, newRecord: false, saved: false });
}

// recorde = vitória mais rápida em cada dificuldade (clássico) ou onda mais longe (infinito)
function saveResult() {
  ui.saved = true;
  audio.play(g.winner === 0 ? 'win' : 'lose');
  ui.kills += g.sides[0].kills;
  achSave();
  if (g.mode === 'endless') {
    const best = ui.waves[g.diff];
    if (best && best >= g.wave) return;
    ui.waves[g.diff] = g.wave;
    ui.newRecord = true;
    return save(WAVES_KEY, ui.waves);
  }
  if (g.winner !== 0) return;
  const best = ui.records[g.diff];
  if (best && best <= g.time) return;
  ui.records[g.diff] = Math.round(g.time);
  ui.newRecord = true;
  save(RECORDS_KEY, ui.records);
}

const achSave = () => save(ACH_KEY, { got: [...ui.got], kills: ui.kills });
function achCheck() {
  const kills = ui.kills + (ui.saved ? 0 : g.sides[0].kills);
  for (const id of check(g, ui.got, kills)) {
    ui.got.add(id);
    ui.toasts.push({ id, t: 4 });
    audio.play('evolve');
    achSave();
  }
}
const toggleMode = () => { ui.mode = ui.mode === 'classic' ? 'endless' : 'classic'; audio.play('click'); };

const pick = (i) => { if (ui.towers ? buyTurret(g, 0, i) : train(g, 0, i)) audio.play('click'); };
const toggleTowers = () => { ui.towers = !ui.towers; ui.selling = false; };

// vaga de torre do jogador embaixo do ponto (x,y da tela), ou -1
function slotAt(x, y) {
  const b = g.sides[0].base, fx = b.x + b.w / 2 + 4, wx = x + ui.cam; // torre fica em cima da plataforma
  if (Math.abs(wx - fx) > TURRET_W / 2 + 4) return -1;
  for (let i = 0; i < g.sides[0].slots.length; i++) if (y >= slotY(i) - 2 && y < slotY(i) + TURRET_H + 2) return i;
  return -1;
}

canvas.addEventListener('pointerdown', (e) => {
  audio.init();
  const [x, y] = toGame(e);
  if (!g && ui.screen === 'lang') {
    const k = LANG_PICK.findIndex((b) => inside(b, x, y));
    if (k >= 0) { setLang(k ? 'en' : 'pt'); ui.screen = 'menu'; }
    return;
  }
  if (!g && ui.screen === 'ach') { if (inside(BACK_BTN, x, y)) ui.screen = 'menu'; return; }
  if (!g) {
    const i = MENU_BTNS.findIndex((b) => inside(b, x, y));
    if (i >= 0) start(i);
    else if (inside(LANG_BTN, x, y)) toggleLang();
    else if (inside(MODE_BTN, x, y)) toggleMode();
    else if (inside(ACH_BTN, x, y)) ui.screen = 'ach';
    return;
  }
  if (g.winner >= 0) { g = null; return; }
  if (ui.paused) return;
  if (inside(TOGGLE_BTN, x, y)) return toggleTowers();
  if (inside(SPECIAL_BTN, x, y)) return special(g, 0);
  if (inside(EVOLVE_BTN, x, y)) return evolve(g, 0);
  const i = BUTTONS.findIndex((b) => inside(b, x, y));
  if (i >= 0) return pick(i);
  if (ui.towers && inside(SLOT_BTN, x, y)) { if (buySlot(g, 0)) audio.play('click'); return; }
  if (ui.towers && inside(SELL_BTN, x, y)) { ui.selling = !ui.selling; return; }
  if (ui.selling) {
    const k = slotAt(x, y);
    if (k >= 0) sellTurret(g, 0, k);
    ui.selling = false;
    return;
  }
  if (y > HUD_H) { dragX = x; canvas.setPointerCapture(e.pointerId); }
});
canvas.addEventListener('pointermove', (e) => {
  [mouseX, mouseY] = toGame(e);
  ui.mx = mouseX; ui.my = mouseY;
  ui.hover = BUTTONS.findIndex((b) => inside(b, mouseX, mouseY));
  ui.hoverMenu = MENU_BTNS.findIndex((b) => inside(b, mouseX, mouseY));
  if (dragX !== null) { ui.cam -= mouseX - dragX; dragX = mouseX; }
});
canvas.addEventListener('pointerup', (e) => { dragX = null; if (e.pointerType !== 'mouse') mouseX = -1; });
canvas.addEventListener('pointerleave', () => { mouseX = ui.mx = -1; ui.hover = -1; ui.hoverMenu = -1; });

addEventListener('keydown', (e) => {
  keys.add(e.code);
  audio.init();
  if (e.code === 'KeyM') { ui.muted = audio.toggleMute(); return; }
  if (e.code === 'KeyL') { toggleLang(); return; }
  const n = e.code.startsWith('Digit') ? +e.code.at(-1) - 1 : -1;
  if (e.code === 'F3') { ui.showFps = !ui.showFps; e.preventDefault(); return; }
  if (!g && ui.screen === 'lang') { if (n === 0 || n === 1) { setLang(n ? 'en' : 'pt'); ui.screen = 'menu'; } return; }
  if (!g && ui.screen === 'ach') { if (e.code === 'Escape' || e.code === 'KeyC' || e.code === 'Enter') ui.screen = 'menu'; return; }
  if (!g) {
    if (n >= 0 && n < MENU_BTNS.length) start(n);
    else if (e.code === 'KeyI') toggleMode();
    else if (e.code === 'KeyC') ui.screen = 'ach';
    return;
  }
  if (g.winner >= 0) { if (e.code === 'Enter') g = null; return; }
  if (e.code === 'KeyP' || (e.code === 'Escape' && !ui.selling)) { ui.paused = !ui.paused; return; }
  if (ui.paused) return;
  if (e.code === 'Space') { special(g, 0); e.preventDefault(); }
  else if (e.code === 'KeyE') evolve(g, 0);
  else if (e.code === 'KeyT') toggleTowers();
  else if (e.code === 'Escape') ui.selling = false;
  else if (ui.towers && n === 3) { if (buySlot(g, 0)) audio.play('click'); }
  else if (n >= 0 && n < 4) pick(n);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => { if (document.hidden && g && g.winner < 0) ui.paused = true; });

function tick(dt) {
  let v = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) v--;
  if (keys.has('ArrowRight') || keys.has('KeyD')) v++;
  if (dragX === null && mouseX >= 0 && mouseY > HUD_H) {
    if (mouseX < 24) v--;
    else if (mouseX > W - 24) v++;
  }
  ui.cam += v * 400 * dt;
  update(g, dt);
}

// Lógica em passo fixo de 60 Hz, render a cada frame do monitor.
const STEP = 1 / 60;
let acc = 0, last = performance.now(), frames = 0, fpsT = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  if (g && !ui.paused) {
    acc += dt;
    while (acc >= STEP) { tick(STEP); acc -= STEP; }
    for (let i = 0; i < g.fx.length; i += 4) { // nome, x, y, direção
      const name = g.fx[i];
      audio.play(name === 'tshoot' ? 'shoot' : name);
      effect(name, g.fx[i + 1], g.fx[i + 2], g.fx[i + 3]);
    }
    g.fx.length = 0;
    achCheck();
    if (g.winner >= 0 && !ui.saved) saveResult();
  }
  for (const tt of ui.toasts) tt.t -= dt;
  while (ui.toasts.length && ui.toasts[0].t <= 0) ui.toasts.shift();
  ui.cam = Math.max(0, Math.min(WORLD - W, ui.cam));
  frames++;
  if ((fpsT += dt) >= 1) { ui.fps = frames; frames = 0; fpsT -= 1; }
  ui.dt = g && !ui.paused ? dt : 0;
  if (g) draw(ctx, g, ui);
  else if (ui.screen === 'lang') drawLangPick(ctx, ui);
  else if (ui.screen === 'ach') drawAchievements(ctx, ui);
  else drawMenu(ctx, ui);
  requestAnimationFrame(frame);
}
await ready; // só começa com a arte carregada
requestAnimationFrame(frame);
