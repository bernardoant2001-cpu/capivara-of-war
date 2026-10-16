import {
  W, H, RES, WORLD, GROUND, HUD_H, QUEUE_MAX, ERAS, XP_TO_EVOLVE, DROP_FALL, DIFFICULTIES,
  MAX_SLOTS, SLOT_COSTS, TURRET_W, TURRET_H, slotY,
} from './data.js';
import { ATTACK, WALK, canEvolve, DYING_TIME } from './battle.js';

// Sprites: um atlas por era que já tem arte + versão branca de cada um pro piscar de dano.
const atlases = [], whites = [], bgs = [];
let FRAMES = {};
// cada era com arte tem assets/eraN.png + eraN.json (quadros) e assets/bgN.webp (fundo)
export const ready = Promise.all(ERAS.map(async (era, k) => {
  if (!era.art) return;
  const img = new Image(), bg = new Image();
  img.src = `assets/era${k + 1}.png`;
  bg.src = `assets/bg${k + 1}.webp`;
  const [frames] = await Promise.all([fetch(`assets/era${k + 1}.json`).then((r) => r.json()), img.decode(), bg.decode()]);
  for (const n in frames) FRAMES[n] = [...frames[n], k];
  const w = document.createElement('canvas');
  w.width = img.width; w.height = img.height;
  const c = w.getContext('2d');
  c.drawImage(img, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = '#fff'; c.fillRect(0, 0, w.width, w.height);
  atlases[k] = img; whites[k] = w; bgs[k] = bg;
}));

// a era com arte mais recente que não passa de `era` (as que ainda não têm arte usam a anterior)
const artEra = (era, list) => { while (era > 0 && !list[era]) era--; return era; };

// Desenha o quadro com o pé em (cx, by); o x de referência (âncora) do quadro fica em cx. Retorna a altura, ou 0 se não existe.
function draw1(ctx, f, cx, by, flash) {
  if (!f) return 0;
  const w = f[2] / RES, h = f[3] / RES;
  const x = Math.round((cx - f[4] / RES) * RES) / RES, y = Math.round((by - h) * RES) / RES;
  ctx.drawImage(atlases[f[5]], f[0], f[1], f[2], f[3], x, y, w, h);
  if (flash) { // brilho branco por cima, sem apagar o desenho (flash = intensidade, 0 a 1)
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * flash;
    ctx.drawImage(whites[f[5]], f[0], f[1], f[2], f[3], x, y, w, h);
    ctx.globalAlpha = a;
  }
  return h;
}
const sprite = (ctx, name, s, cx, by, flash = 0) => draw1(ctx, name && FRAMES[s ? name + '_inimigo' : name], cx, by, flash);

// quadro de animação de um personagem (cache dos nomes pra não montar string todo frame)
const keys = {};
function frame(name, s, anim, i) {
  const k = keys[name] ||= [{}, {}];
  const a = k[s][anim] ||= [0, 1, 2, 3].map((n) => FRAMES[`${name}${s ? '_inimigo' : ''}_${anim}_${n}`]);
  return a[i];
}

const STRIDE = 4; // px andados por quadro do andar (o passo acompanha o chão, sem patinar)

// Cores dos quadrados das eras que ainda não têm arte.
const COLORS = [
  ['#e08a3c', '#f2c14e', '#c4652d', '#ff5a1a'], // Clã do Rio
  ['#4c7bd9', '#7fb2f0', '#4a4fae', '#8a4cff'], // Clã do Pântano
];
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

// fundo: a imagem cobre o campo inteiro (WORLD), por frame é só 1 drawImage
function drawBg(ctx, cam, era) {
  const bg = bgs[artEra(era, bgs)], k = bg.width / WORLD;
  ctx.drawImage(bg, cam * k, 0, W * k, bg.height, 0, 0, W, H);
}

const hpBar = (ctx, x, y, w, frac, color) => {
  ctx.fillStyle = '#300'; ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = color || (frac > 0.33 ? '#4c4' : '#e33');
  ctx.fillRect(x, y, Math.max(0, Math.round(w * Math.min(1, frac))), 3);
};

export function draw(ctx, g, ui) {
  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  const cam = Math.round(ui.cam);
  drawBg(ctx, cam, g.sides[0].era);

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
    for (const u of g.dying) if (u.z === z) drawSleeping(ctx, u, cam);
    for (let s = 0; s < 2; s++) {
      for (const u of g.sides[s].units) if (u.z === z) drawUnit(ctx, g, u, s, cam);
    }
  }

  for (const p of g.shots) {
    const total = Math.abs(p.t.x - p.x0) || 1;
    const k = Math.min(1, Math.abs(p.x - p.x0) / total);
    const y = p.y0 + (GROUND - 12 - p.y0) * k - Math.sin(k * Math.PI) * 18;
    ball(ctx, p.x - cam, y, p.splash ? 2.5 : 1.5, p.splash ? '#6b3f1f' : '#9a948a');
  }

  for (const p of g.drops) {
    if (p.t > DROP_FALL) continue;
    const y = GROUND - 4 - (p.t / DROP_FALL) * (GROUND - HUD_H);
    ball(ctx, p.x - cam, y, 3, '#6b3f1f');
  }

  drawHud(ctx, g, ui);
}

function ball(ctx, x, y, r, color) {
  ctx.fillStyle = '#22140e';
  ctx.beginPath(); ctx.arc(x, y, r + 1 / RES, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function drawUnit(ctx, g, u, s, cam) {
  const def = u.def, d = g.sides[s].dir;
  const cx = u.x - cam, by = GROUND + u.z * 1.5; // profundidade espalhada na largura da estradinha
  ctx.fillStyle = 'rgba(30,20,10,0.28)'; // sombra no chão
  ctx.beginPath(); ctx.ellipse(cx, by, def.w * 0.6, 2.2, 0, 0, Math.PI * 2); ctx.fill();

  // qual quadro: andando pelo passo; atacando pelo tempo até/desde o golpe (o impacto cai no quadro 2)
  let anim = 'walk', i = 0;
  if (u.state === WALK) i = Math.floor(Math.abs(u.x) / STRIDE) % 4;
  else if (u.state === ATTACK) {
    const since = def.cd - u.cd;
    if (since < 0.12) { anim = 'attack'; i = 2; }
    else if (since < 0.28) { anim = 'attack'; i = 3; }
    else if (u.cd < 0.12) { anim = 'attack'; i = 1; }
    else if (u.cd < 0.3) { anim = 'attack'; i = 0; }
  }
  let h = def.sprite ? draw1(ctx, frame(def.sprite, s, anim, i), cx, by, u.hitT > 0 ? 0.55 : 0) : 0;
  if (h) h = frame(def.sprite, s, 'walk', 0)[3] / RES; // barra de vida não pula junto com o quadro
  else {
    // era sem arte ainda: quadrado colorido
    const x = Math.round(cx - def.w / 2);
    h = def.h;
    ctx.fillStyle = u.hitT > 0 ? '#fff' : COLORS[s][def.type];
    ctx.fillRect(x, by - h, def.w, h);
    ctx.fillStyle = ERA_COLORS[def.era];
    ctx.fillRect(x, by - h, def.w, 3);
    ctx.fillStyle = '#222'; // olhinho pra mostrar pra onde olha
    ctx.fillRect(d > 0 ? x + def.w - 5 : x + 3, by - h + 5, 2, 2);
  }
  if (u.hp < def.hp) hpBar(ctx, Math.round(cx - def.w / 2), by - h - 4, def.w, u.hp / def.hp);
}

// capivara derrotada: fica tonta, cai, dorme (zZ) e some
function drawSleeping(ctx, u, cam) {
  const t = u.deadT, cx = u.x - cam, by = GROUND + u.z * 1.5;
  ctx.globalAlpha = Math.min(1, (DYING_TIME - t) / 0.4);
  const f = u.def.sprite && frame(u.def.sprite, u.s, 'ko', t < 0.2 ? 0 : t < 0.45 ? 1 : 2);
  const h = draw1(ctx, f, cx, by, false) || 6;
  if (t > 0.6) {
    ctx.fillStyle = '#fff';
    ctx.font = '7px monospace';
    const rise = (t - 0.6) * 12;
    ctx.fillText('z', cx + 4, by - h - 2 - rise);
    if (t > 0.9) ctx.fillText('Z', cx + 8, by - h - 8 - rise);
  }
  ctx.globalAlpha = 1;
}

function drawBase(ctx, g, s, cam, ui) {
  const side = g.sides[s], b = side.base, d = side.dir, cx = b.x - cam;
  const base = ERAS[artEra(side.era, atlases)].baseSprite;
  const h = sprite(ctx, base, s, cx, GROUND + 12, b.hitT > 0 ? 0.25 : 0);
  hpBar(ctx, Math.round(cx - b.w / 2), GROUND + 12 - h - 6, b.w, b.hp / b.maxHp);

  const fx = b.x + d * b.w / 2 - cam;
  for (let i = 0; i < side.slots.length; i++) {
    const t = side.slots[i], y = slotY(i) + TURRET_H;
    if (!t) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(Math.round(fx - TURRET_W / 2), y - TURRET_H, TURRET_W, TURRET_H);
      continue;
    }
    const kick = t.cd > t.def.cd - 0.1 ? -1.5 * d : 0; // coice do tiro
    if (!sprite(ctx, t.def.sprite, s, fx + kick, y)) {
      ctx.fillStyle = TURRET_COLORS[t.def.type];
      ctx.fillRect(Math.round(fx - TURRET_W / 2 + kick), y - TURRET_H, TURRET_W, TURRET_H);
      ctx.fillStyle = ERA_COLORS[t.def.era];
      ctx.fillRect(Math.round(fx - TURRET_W / 2 + kick), y - TURRET_H, TURRET_W, 2);
    }
    if (s === 0 && ui.selling) {
      ctx.fillStyle = 'rgba(230,50,50,0.45)';
      ctx.fillRect(Math.round(fx - 10), y - 18, 20, 18);
    }
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
  ctx.fillText(`${era.name} · ${fmt(g.time)}${ui.muted ? " · mudo (M)" : ""}`, W - 6, HUD_H + 4);
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
  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  drawBg(ctx, 0, 0);
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
