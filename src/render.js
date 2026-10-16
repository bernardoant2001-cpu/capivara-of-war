import {
  W, H, WORLD, GROUND, HUD_H, BASE_H, QUEUE_MAX, ERAS, XP_TO_EVOLVE, DROP_FALL, DIFFICULTIES,
  MAX_SLOTS, SLOT_COSTS, TURRET_W, TURRET_H, slotY,
} from './data.js';
import { ATTACK, WALK, canEvolve } from './battle.js';

// Cores por lado e por tipo (no M2 vira sprite com troca de paleta).
const COLORS = [
  ['#e08a3c', '#f2c14e', '#c4652d', '#ff5a1a'], // Clã do Rio
  ['#4c7bd9', '#7fb2f0', '#4a4fae', '#8a4cff'], // Clã do Pântano
];
const BASE_COLORS = ['#8a4a2a', '#2f3580'];
const TURRET_COLORS = ['#a89a7c', '#c9a14a', '#77706a'];
const ERA_COLORS = ['#5a3d1e', '#b8bec8', '#2f6e3a', '#6b7a2f', '#3ff0ff']; // faixa na cabeça

export const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export const BUTTONS = [0, 1, 2, 3].map((i) => ({ x: 6 + i * 77, y: 6, w: 75, h: 28 }));
export const SLOT_BTN = { x: 316, y: 6, w: 70, h: 13 };
export const SELL_BTN = { x: 316, y: 21, w: 70, h: 13 };
export const SPECIAL_BTN = { x: 456, y: 6, w: 60, h: 28 };
export const EVOLVE_BTN = { x: 520, y: 6, w: 60, h: 28 };
export const TOGGLE_BTN = { x: 584, y: 6, w: 52, h: 28 };
export const MENU_BTNS = DIFFICULTIES.map((_, i) => ({ x: W / 2 - 80, y: 130 + i * 36, w: 160, h: 28 }));

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

const hpBar = (ctx, x, y, w, frac, color) => {
  ctx.fillStyle = '#300'; ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = color || (frac > 0.33 ? '#4c4' : '#e33');
  ctx.fillRect(x, y, Math.max(0, Math.round(w * Math.min(1, frac))), 3);
};

export function draw(ctx, g, ui) {
  const cam = Math.round(ui.cam);
  ctx.drawImage(bg, cam, 0, W, H, 0, 0, W, H);

  for (let s = 0; s < 2; s++) drawBase(ctx, g, s, cam, ui);

  // alcance da torre com o mouse em cima do botão
  const hoverTurret = ui.towers && ERAS[g.sides[0].era].turrets[ui.hover];
  if (hoverTurret) {
    const b = g.sides[0].base, fx = Math.round(b.x + b.w / 2) - cam;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(fx, GROUND - 2, hoverTurret.range, 4);
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
        ctx.fillStyle = u.hitT > 0 ? '#fff' : COLORS[s][def.type];
        ctx.fillRect(x, y, def.w, def.h);
        ctx.fillStyle = ERA_COLORS[def.era];
        ctx.fillRect(x, y, def.w, 3);
        ctx.fillStyle = '#222'; // olhinho pra mostrar pra onde olha
        ctx.fillRect(d > 0 ? x + def.w - 5 : x + 3, y + 5, 2, 2);
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

  for (const p of g.drops) {
    if (p.t > DROP_FALL) continue;
    const y = GROUND - 6 - (p.t / DROP_FALL) * (GROUND - HUD_H);
    ctx.fillStyle = p.s === 0 ? '#7a4a1a' : '#2a2a6a';
    ctx.fillRect(Math.round(p.x) - cam - 3, Math.round(y), 6, 6);
  }

  drawHud(ctx, g, ui);
}

function drawBase(ctx, g, s, cam, ui) {
  const side = g.sides[s], b = side.base, d = side.dir;
  const bx = Math.round(b.x - b.w / 2) - cam;
  ctx.fillStyle = b.hitT > 0 ? '#fff' : BASE_COLORS[s];
  ctx.fillRect(bx, GROUND - BASE_H, b.w, BASE_H);
  ctx.fillStyle = ERA_COLORS[side.era];
  ctx.fillRect(bx, GROUND - BASE_H, b.w, 4);
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
    ctx.fillStyle = s === 0 && ui.selling ? '#e33' : TURRET_COLORS[t.def.type];
    ctx.fillRect(tx, y, TURRET_W, TURRET_H);
    ctx.fillStyle = ERA_COLORS[t.def.era];
    ctx.fillRect(tx, y, TURRET_W, 2);
    ctx.fillStyle = '#222';
    ctx.fillRect(d > 0 ? tx + TURRET_W + kick : tx - 6 + kick, y + 3, 6, 3);
  }
}

function button(ctx, b, color, l1, l2) {
  ctx.fillStyle = color; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#111';
  if (!l2) return ctx.fillText(l1, b.x + 3, b.y + (b.h - 10) / 2);
  ctx.fillText(l1, b.x + 3, b.y + 3);
  ctx.fillText(l2, b.x + 3, b.y + 15);
}

function drawHud(ctx, g, ui) {
  const me = g.sides[0], era = ERAS[me.era];
  ctx.fillStyle = 'rgba(20,16,12,0.85)'; ctx.fillRect(0, 0, W, HUD_H);
  ctx.font = '10px monospace'; ctx.textBaseline = 'top';

  if (ui.towers) {
    const free = me.slots.includes(null);
    era.turrets.forEach((def, i) => {
      button(ctx, BUTTONS[i], free && me.gold >= def.cost ? TURRET_COLORS[i] : '#555', `${i + 1} ${def.name}`, `$${def.cost}`);
    });
    const full = me.slots.length >= MAX_SLOTS, cost = SLOT_COSTS[me.slots.length - 1];
    button(ctx, SLOT_BTN, !full && me.gold >= cost ? '#8fbf6f' : '#555', full ? 'Vagas: 4/4' : `+Vaga $${cost}`);
    button(ctx, SELL_BTN, ui.selling ? '#e33' : '#b07a6a', ui.selling ? 'Clica torre' : 'Vender');
  } else {
    era.units.forEach((def, i) => {
      const ok = me.gold >= def.cost && me.queue.length < QUEUE_MAX;
      button(ctx, BUTTONS[i], ok ? COLORS[0][i] : '#555', `${i + 1} ${def.name}`, `$${def.cost}`);
    });
  }

  ctx.fillStyle = '#f2c14e'; ctx.fillText(`$${Math.floor(me.gold)}`, 392, 8);
  const next = XP_TO_EVOLVE[me.era];
  ctx.fillStyle = '#9cf'; ctx.fillText('XP', 392, 21);
  hpBar(ctx, 408, 24, 44, next ? me.xp / next : 1, '#9cf');

  const ready = me.specialT <= 0;
  button(ctx, SPECIAL_BTN, ready ? '#e86a5a' : '#555', 'Especial', ready ? 'Espaço' : `${Math.ceil(me.specialT)}s`);
  const can = canEvolve(me);
  button(ctx, EVOLVE_BTN, can ? '#6fd96f' : '#555', 'E Evoluir',
    !next ? 'máx' : can ? 'pronto!' : `${Math.floor(100 * me.xp / next)}%`);
  button(ctx, TOGGLE_BTN, '#ddd', ui.towers ? 'T Unid.' : 'T Torres');

  // embaixo da barra: fila de treino, era e tempo
  for (let i = 0; i < QUEUE_MAX; i++) {
    const x = 6 + i * 16, y = HUD_H + 4;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x, y, 14, 14);
    const def = me.queue[i];
    if (!def) continue;
    ctx.fillStyle = COLORS[0][def.type]; ctx.fillRect(x + 2, y + 2, 10, 10);
    if (i === 0) hpBar(ctx, x, y + 16, 14, 1 - Math.max(0, me.trainT) / def.train);
  }
  ctx.textAlign = 'right'; ctx.fillStyle = '#123';
  ctx.fillText(`${era.name} · ${fmt(g.time)}`, W - 6, HUD_H + 4);
  if (ui.showFps) ctx.fillText(`${ui.fps} fps`, W - 6, HUD_H + 16);
  ctx.textAlign = 'left';

  if (g.winner >= 0) {
    overlay(ctx, g.winner === 0 ? 'VITÓRIA!' : 'DERROTA...', [
      `${DIFFICULTIES[g.diff].name} · ${fmt(g.time)} · ${me.kills} abates · ${era.name}`,
      ui.newRecord ? 'NOVO RECORDE!' : '',
      'clique ou Enter pra voltar ao menu',
    ]);
  } else if (ui.paused) {
    overlay(ctx, 'PAUSADO', ['P / Esc pra continuar']);
  }
}

function overlay(ctx, title, lines) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.font = '24px monospace'; ctx.fillText(title, W / 2, H / 2 - 40);
  ctx.font = '10px monospace';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + i * 14));
  ctx.textAlign = 'left';
}

export function drawMenu(ctx, ui) {
  ctx.drawImage(bg, 0, 0, W, H, 0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#f2c14e'; ctx.font = '28px monospace';
  ctx.fillText('CAPIVARA OF WAR', W / 2, 50);
  ctx.fillStyle = '#ddd'; ctx.font = '10px monospace';
  ctx.fillText('escolha a dificuldade', W / 2, 100);
  MENU_BTNS.forEach((b, i) => {
    ctx.fillStyle = ui.hoverMenu === i ? '#f2c14e' : '#e08a3c';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#111';
    ctx.fillText(`${i + 1} ${DIFFICULTIES[i].name}`, b.x + b.w / 2, b.y + 3);
    const r = ui.records[i];
    ctx.fillText(r ? `recorde ${fmt(r)}` : 'sem vitória ainda', b.x + b.w / 2, b.y + 15);
  });
  if (ui.showFps) ctx.fillText(`${ui.fps} fps`, W / 2, H - 16);
  ctx.textAlign = 'left';
}
