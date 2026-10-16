import { W, H, WORLD, HUD_H, TURRET_W, TURRET_H, slotY } from './data.js';
import { newGame, update, train, buyTurret, buySlot, sellTurret } from './battle.js';
import { draw, BUTTONS, SLOT_BTN, SELL_BTN, TOGGLE_BTN } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = W; canvas.height = H;
ctx.imageSmoothingEnabled = false;

// Escala inteira quando cabe (pixel perfeito); fracionária só em tela menor que 640×360.
function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  const k = s >= 1 ? Math.floor(s) : s;
  canvas.style.width = W * k + 'px';
  canvas.style.height = H * k + 'px';
}
addEventListener('resize', fit);
fit();

let g = newGame();
const ui = { cam: 0, paused: false, showFps: false, fps: 0, towers: false, selling: false, hover: -1 };
const keys = new Set();
let mouseX = -1, mouseY = -1, dragX = null;

const toGame = (e) => {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height];
};
const inside = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
const restart = () => { g = newGame(); ui.cam = 0; ui.paused = false; ui.selling = false; };
const pick = (i) => (ui.towers ? buyTurret(g, 0, i) : train(g, 0, i));
const toggleTowers = () => { ui.towers = !ui.towers; ui.selling = false; };

// vaga de torre do jogador embaixo do ponto (x,y da tela), ou -1
function slotAt(x, y) {
  const b = g.sides[0].base, fx = b.x + b.w / 2, wx = x + ui.cam;
  if (Math.abs(wx - fx) > TURRET_W / 2 + 4) return -1;
  for (let i = 0; i < g.sides[0].slots.length; i++) if (y >= slotY(i) - 2 && y < slotY(i) + TURRET_H + 2) return i;
  return -1;
}

canvas.addEventListener('pointerdown', (e) => {
  const [x, y] = toGame(e);
  if (g.winner >= 0) return restart();
  if (inside(TOGGLE_BTN, x, y)) return toggleTowers();
  const i = BUTTONS.findIndex((b) => inside(b, x, y));
  if (i >= 0) return pick(i);
  if (ui.towers && inside(SLOT_BTN, x, y)) return buySlot(g, 0);
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
  ui.hover = BUTTONS.findIndex((b) => inside(b, mouseX, mouseY));
  if (dragX !== null) { ui.cam -= mouseX - dragX; dragX = mouseX; }
});
canvas.addEventListener('pointerup', (e) => { dragX = null; if (e.pointerType !== 'mouse') mouseX = -1; });
canvas.addEventListener('pointerleave', () => { mouseX = -1; ui.hover = -1; });

addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') pick(+e.code.at(-1) - 1);
  else if (e.code === 'Digit4' && ui.towers) buySlot(g, 0);
  else if (e.code === 'KeyT') toggleTowers();
  else if (e.code === 'Escape' && ui.selling) ui.selling = false;
  else if ((e.code === 'KeyP' || e.code === 'Escape') && g.winner < 0) ui.paused = !ui.paused;
  else if (e.code === 'Enter' && g.winner >= 0) restart();
  else if (e.code === 'F3') { ui.showFps = !ui.showFps; e.preventDefault(); }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => { if (document.hidden && g.winner < 0) ui.paused = true; });

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
  if (!ui.paused) {
    acc += dt;
    while (acc >= STEP) { tick(STEP); acc -= STEP; }
  }
  ui.cam = Math.max(0, Math.min(WORLD - W, ui.cam));
  frames++;
  if ((fpsT += dt) >= 1) { ui.fps = frames; frames = 0; fpsT -= 1; }
  draw(ctx, g, ui);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
