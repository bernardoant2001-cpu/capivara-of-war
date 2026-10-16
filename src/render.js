import {
  W, H, WORLD, GROUND, HUD_H, BASE_H, QUEUE_MAX, UNITS,
  TURRETS, MAX_SLOTS, SLOT_COSTS, TURRET_W, TURRET_H, slotY,
} from './data.js';
import { ATTACK, WALK } from './battle.js';

// Cores por lado e por tipo (no M2 vira sprite com troca de paleta).
const COLORS = [
  ['#e08a3c', '#f2c14e', '#a8552d'], // Clã do Rio
  ['#4c7bd9', '#7fb2f0', '#3a3f9e'], // Clã do Pântano
];
const TURRET_COLORS = ['#a89a7c', '#c9a14a', '#77706a'];

export const BUTTONS = UNITS.map((_, i) => ({ x: 6 + i * 77, y: 6, w: 75, h: 28 }));
export const SLOT_BTN = { x: 324, y: 6, w: 70, h: 13 };
export const SELL_BTN = { x: 324, y: 21, w: 70, h: 13 };
export const TOGGLE_BTN = { x: 560, y: 6, w: 74, h: 28 };

// Fundo pré-renderizado uma vez; por frame é só 1 drawImage.
const bg = document.createElement('canvas');
bg.width = WORLD; bg.height = H;
{
  const b = bg.getContext('2d');
  b.fillStyle = '#7ec8e3'; b.fillRect(0, 0, WORLD, H);
  b.fillStyle = '#5a9a5a';
  for (let x = 0; x < WORLD; x += 4) b.fillRect(x, GROUND - 40 - Math.round(20 * Math.sin(x / 90) + 10 * Math.sin(x / 37)), 4, 80);
  b.fillStyle = '#6b4f2a'; b.fillRect(0, GROUND, WORLD, H - GROUND);
  b.fillStyle = '#8a6a3a';
  for (let x = 0; x < WORLD; x += 16) b.fillRect(x + ((x * 7) % 11), GROUND + 4 + ((x * 13) % 40), 3, 2);
}

const hpBar = (ctx, x, y, w, frac) => {
  ctx.fillStyle = '#300'; ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = frac > 0.33 ? '#4c4' : '#e33'; ctx.fillRect(x, y, Math.max(0, Math.round(w * frac)), 3);
};

export function draw(ctx, g, ui) {
  const cam = Math.round(ui.cam);
  ctx.drawImage(bg, cam, 0, W, H, 0, 0, W, H);

  for (let s = 0; s < 2; s++) drawBase(ctx, g, s, cam, ui);

  // alcance da torre com o mouse em cima do botão
  if (ui.towers && ui.hover >= 0) {
    const b = g.sides[0].base, fx = Math.round(b.x + b.w / 2) - cam;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(fx, GROUND - 2, TURRETS[ui.hover].range, 4);
  }

  // desenha por profundidade: quem tá mais "pra frente" no chão fica por cima
  for (let z = 0; z < 9; z++) {
    for (let s = 0; s < 2; s++) {
      const d = g.sides[s].dir;
      for (const u of g.sides[s].units) {
        if (u.z !== z) continue;
        const def = u.def;
        const lunge = u.state === ATTACK && u.cd > def.cd - 0.12 ? 3 * d : 0;
        const bob = u.state === WALK ? Math.round(Math.sin(g.time * 12 + u.x) * 0.8) : 0;
        const x = Math.round(u.x - def.w / 2) - cam + lunge, y = GROUND - def.h + bob + z;
        ctx.fillStyle = u.hitT > 0 ? '#fff' : COLORS[s][u.type];
        ctx.fillRect(x, y, def.w, def.h);
        ctx.fillStyle = '#222'; // olhinho pra mostrar pra onde olha
        ctx.fillRect(d > 0 ? x + def.w - 5 : x + 3, y + 4, 2, 2);
        if (u.hp < def.hp) hpBar(ctx, x, y - 5, def.w, u.hp / def.hp);
      }
    }
  }

  ctx.fillStyle = '#222';
  for (const p of g.shots) {
    const total = Math.abs(p.t.x - p.x0) || 1;
    const k = Math.min(1, Math.abs(p.x - p.x0) / total);
    const y = p.y0 + (GROUND - 12 - p.y0) * k - Math.sin(k * Math.PI) * 18;
    const r = p.splash ? 5 : 3;
    ctx.fillRect(Math.round(p.x) - cam - (r >> 1), Math.round(y), r, r);
  }

  drawHud(ctx, g, ui);
}

function drawBase(ctx, g, s, cam, ui) {
  const side = g.sides[s], b = side.base, d = side.dir;
  const bx = Math.round(b.x - b.w / 2) - cam;
  ctx.fillStyle = b.hitT > 0 ? '#fff' : COLORS[s][2];
  ctx.fillRect(bx, GROUND - BASE_H, b.w, BASE_H);
  hpBar(ctx, bx, GROUND - BASE_H - 6, b.w, b.hp / b.maxHp);

  const tx = Math.round(b.x + d * b.w / 2 - TURRET_W / 2) - cam;
  for (let i = 0; i < side.slots.length; i++) {
    const t = side.slots[i], y = slotY(i);
    if (!t) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(tx, y, TURRET_W, TURRET_H);
      continue;
    }
    const kick = t.cd > t.def.cd - 0.1 ? -2 * d : 0; // coice do tiro
    ctx.fillStyle = s === 0 && ui.selling ? '#e33' : TURRET_COLORS[TURRETS.indexOf(t.def)];
    ctx.fillRect(tx, y, TURRET_W, TURRET_H);
    ctx.fillStyle = '#222';
    ctx.fillRect(d > 0 ? tx + TURRET_W + kick : tx - 6 + kick, y + 3, 6, 3);
  }
}

function button(ctx, b, color, l1, l2) {
  ctx.fillStyle = color; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#111';
  ctx.fillText(l1, b.x + 3, b.y + (l2 ? 3 : 2));
  if (l2) ctx.fillText(l2, b.x + 3, b.y + 15);
}

function drawHud(ctx, g, ui) {
  const me = g.sides[0];
  ctx.fillStyle = 'rgba(20,16,12,0.85)'; ctx.fillRect(0, 0, W, HUD_H);
  ctx.font = '10px monospace'; ctx.textBaseline = 'top';

  if (ui.towers) {
    const free = me.slots.includes(null);
    BUTTONS.forEach((bt, i) => {
      const def = TURRETS[i];
      button(ctx, bt, free && me.gold >= def.cost ? TURRET_COLORS[i] : '#555', `${i + 1} ${def.name}`, `$${def.cost}`);
    });
    const full = me.slots.length >= MAX_SLOTS, cost = SLOT_COSTS[me.slots.length - 1];
    button(ctx, SLOT_BTN, !full && me.gold >= cost ? '#8fbf6f' : '#555', full ? 'Vagas: 4/4' : `+Vaga $${cost}`);
    button(ctx, SELL_BTN, ui.selling ? '#e33' : '#b07a6a', ui.selling ? 'Clica torre' : 'Vender');
  } else {
    BUTTONS.forEach((bt, i) => {
      const def = UNITS[i], ok = me.gold >= def.cost && me.queue.length < QUEUE_MAX;
      button(ctx, bt, ok ? COLORS[0][i] : '#555', `${i + 1} ${def.name}`, `$${def.cost}`);
    });
  }
  button(ctx, TOGGLE_BTN, '#ddd', ui.towers ? 'T Unidades' : 'T Torres', ui.towers ? 'voltar' : 'da base');

  for (let i = 0; i < QUEUE_MAX; i++) {
    const x = 240 + i * 16, y = 12;
    ctx.fillStyle = '#333'; ctx.fillRect(x, y, 14, 14);
    const t = me.queue[i];
    if (t === undefined) continue;
    ctx.fillStyle = COLORS[0][t]; ctx.fillRect(x + 2, y + 2, 10, 10);
    if (i === 0) hpBar(ctx, x, y + 16, 14, 1 - Math.max(0, me.trainT) / UNITS[t].train);
  }

  ctx.fillStyle = '#f2c14e'; ctx.fillText(`Ouro ${Math.floor(me.gold)}`, 402, 8);
  ctx.fillStyle = '#9cf';    ctx.fillText(`XP ${Math.floor(me.xp)}`, 402, 22);
  ctx.fillStyle = '#ccc';    ctx.fillText(`${Math.floor(g.time / 60)}:${String(Math.floor(g.time % 60)).padStart(2, '0')}`, 490, 8);
  if (ui.showFps) ctx.fillText(`${ui.fps} fps`, 490, 22);

  const msg = g.winner === 0 ? 'VITÓRIA!' : g.winner === 1 ? 'DERROTA...' : ui.paused ? 'PAUSADO' : '';
  if (msg) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.font = '24px monospace'; ctx.fillText(msg, W / 2, H / 2 - 20);
    ctx.font = '10px monospace';
    ctx.fillText(g.winner >= 0 ? 'clique ou Enter pra jogar de novo' : 'P / Esc pra continuar', W / 2, H / 2 + 12);
    ctx.textAlign = 'left';
  }
}
