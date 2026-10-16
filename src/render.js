import {
  W, H, RES, WORLD, GROUND, HUD_H, QUEUE_MAX, ERAS, XP_TO_EVOLVE, DROP_FALL, DIFFICULTIES, SPECIAL_CD,
  MAX_SLOTS, SLOT_COSTS, TURRET_W, TURRET_H, slotY,
} from './data.js';
import { ATTACK, WALK, canEvolve, DYING_TIME } from './battle.js';

// Sprites: um atlas por era que já tem arte + versão branca de cada um pro piscar de dano.
const atlases = [], whites = [], bgs = [];
let FRAMES = {};
// cada era com arte tem assets/eraN.png + eraN.json (quadros) e assets/bgN.webp (fundo)
export const ready = Promise.all([document.fonts.load('8px "Jersey 10"'), ...ERAS.map(async (era, k) => {
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
})]);

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

// barra com borda escura; sem cor = verde/amarelo/vermelho pela vida que sobra
function hpBar(ctx, x, y, w, frac, color, h = 3) {
  frac = Math.max(0, Math.min(1, frac));
  ctx.fillStyle = '#1a0f08'; ctx.fillRect(x - 2 / RES, y - 2 / RES, w + 4 / RES, h + 4 / RES);
  ctx.fillStyle = '#4a1d1d'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color || (frac > 0.5 ? '#5bd15b' : frac > 0.25 ? '#e8c440' : '#e34b3b');
  ctx.fillRect(x, y, w * frac, h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y, w * frac, h / 3); // brilho
}

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

// viga de madeira com contorno e luz em cima
function beam(ctx, x, y, w, h) {
  ctx.fillStyle = '#3a2414'; ctx.fillRect(x - 0.6, y - 0.6, w + 1.2, h + 1.2);
  ctx.fillStyle = '#8a5a32'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#b98552'; ctx.fillRect(x, y, w, 0.7);
}

function drawBase(ctx, g, s, cam, ui) {
  const side = g.sides[s], b = side.base, d = side.dir, cx = b.x - cam;
  const base = ERAS[artEra(side.era, atlases)].baseSprite;
  const h = sprite(ctx, base, s, cx, GROUND + 12, b.hitT > 0 ? 0.25 : 0);
  hpBar(ctx, Math.round(cx - b.w / 2), GROUND + 12 - h - 8, b.w, b.hp / b.maxHp, null, 4);

  // sacada de madeira saindo da parede em cada vaga: plataforma + mão-francesa cravada na parede
  const wall = b.x + d * (b.w / 2 - 6) - cam, end = b.x + d * (b.w / 2 + 13) - cam;
  const fx = b.x + d * (b.w / 2 + 4) - cam; // onde a torre fica em cima da plataforma
  for (let i = 0; i < side.slots.length; i++) {
    const y = slotY(i) + TURRET_H;
    ctx.lineCap = 'round';
    for (const [color, lw] of [['#3a2414', 3.2], ['#8a5a32', 1.8]]) {
      ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(wall, y + 9); ctx.lineTo(end - d * 3, y + 2); ctx.stroke();
    }
    ctx.fillStyle = '#3a2414'; ctx.fillRect(Math.min(wall, wall - d * 2) - 0.5, y - 0.5, 3, 11); // peça presa na parede
    beam(ctx, Math.min(wall, end), y, Math.abs(end - wall), 3.5);
  }

  for (let i = 0; i < side.slots.length; i++) {
    const t = side.slots[i], y = slotY(i) + TURRET_H;
    if (!t) {
      if (s === 0 && ui.towers) { // vaga livre: contorno pra mostrar onde a torre vai
        ctx.strokeStyle = 'rgba(255,240,200,0.55)'; ctx.lineWidth = 0.7;
        ctx.strokeRect(Math.round(fx - TURRET_W / 2), y - TURRET_H - 2, TURRET_W, TURRET_H + 1);
      }
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

// ---------- interface ----------

const fonts = {};
// a Jersey 10 tem um peso só e desenha menor: os tamanhos da interface são multiplicados aqui
const font = (px) => (fonts[px] ||= `${Math.round(px * 1.4 * 10) / 10}px "Jersey 10", monospace`);

// texto com contorno, pra ler em cima de qualquer fundo
function text(ctx, str, x, y, px, color, align = 'left', bold = false, outline = null, maxW = undefined) {
  ctx.font = font(px);
  ctx.textAlign = align;
  if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y, maxW); }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y, maxW); // maxW aperta o texto se não couber
}

const inside = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;

function coin(ctx, x, y, r = 2.6) {
  ctx.fillStyle = '#5a3a08'; ctx.beginPath(); ctx.arc(x, y, r + 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff3b0'; ctx.fillRect(x - r * 0.5, y - r * 0.6, r * 0.5, r * 0.5);
}

// caixa com relevo: luz em cima, sombra embaixo
function box(ctx, x, y, w, h, fill, hi, lo) {
  ctx.fillStyle = '#22140b'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = hi; ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = lo; ctx.fillRect(x, y + h - 1, w, 1);
}

// retrato: o primeiro quadro do personagem (ou a torre) encaixado na caixa
function portrait(ctx, def, x, y, size, dim) {
  const f = def.sprite && (FRAMES[def.sprite] || frame(def.sprite, 0, 'walk', 0));
  ctx.globalAlpha = dim ? 0.45 : 1;
  if (!f) {
    ctx.fillStyle = (def.type !== undefined && COLORS[0][def.type]) || '#999';
    ctx.fillRect(x + 4, y + 4, size - 8, size - 8);
  } else {
    const w = f[2] / RES, h = f[3] / RES, k = Math.min(size / w, size / h), dw = w * k, dh = h * k;
    ctx.imageSmoothingEnabled = true; // retrato é o sprite reduzido; suavizar fica melhor que pular pixel
    ctx.drawImage(atlases[f[5]], f[0], f[1], f[2], f[3], x + (size - dw) / 2, y + size - dh, dw, dh);
    ctx.imageSmoothingEnabled = false;
  }
  ctx.globalAlpha = 1;
}

// carta de unidade/torre: retrato, tecla, nome e preço
function card(ctx, b, key, def, ok, canPay, hover) {
  box(ctx, b.x, b.y, b.w, b.h, ok ? (hover ? '#f8e8c2' : '#ecd9ae') : '#9a8a72', ok ? '#fff6dc' : '#b3a48c', ok ? '#c4a676' : '#7d6e58');
  ctx.fillStyle = ok ? '#d9bf8c' : '#8a7a62'; ctx.fillRect(b.x + 2, b.y + 2, 26, b.h - 4);
  portrait(ctx, def, b.x + 2, b.y + 2, 26, !ok);
  ctx.fillStyle = '#2a180c'; ctx.fillRect(b.x, b.y, 7, 8);
  text(ctx, key, b.x + 3.5, b.y + 0.5, 7, '#f2c14e', 'center', true);
  text(ctx, def.name, b.x + 31, b.y + 3.5, 8, ok ? '#2a180c' : '#4a3d2e', 'left', true, null, b.w - 33);
  coin(ctx, b.x + 34, b.y + 21);
  text(ctx, String(def.cost), b.x + 39, b.y + 16, 9, canPay ? '#2a180c' : '#b3261e', 'left', true);
}

// botão de madeira; fill (0 a 1) pinta a parte de baixo, pra mostrar carga/progresso
const TONES = {
  go: ['#5fae4a', '#9de07f', '#3d7a2f'],
  hot: ['#d4694f', '#ffa58c', '#9b3f2c'],
  off: ['#6d5a46', '#8c7660', '#4d3f30'],
  wood: ['#a8794a', '#d9a873', '#6e4a2a'],
};
function plank(ctx, b, l1, l2, tone, hover, fill = 0) {
  const c = TONES[tone];
  box(ctx, b.x, b.y, b.w, b.h, hover && tone !== 'off' ? c[1] : c[0], c[1], c[2]);
  if (fill > 0) { ctx.fillStyle = 'rgba(255,230,140,0.35)'; ctx.fillRect(b.x, b.y + b.h * (1 - fill), b.w, b.h * fill); }
  const dark = tone === 'off' ? '#e6d6bd' : '#1e120a';
  if (!l2) return text(ctx, l1, b.x + b.w / 2, b.y + (b.h - 8) / 2, 7.5, dark, 'center', true);
  text(ctx, l1, b.x + b.w / 2, b.y + 4, 7.5, dark, 'center', true);
  text(ctx, l2, b.x + b.w / 2, b.y + 16, 7, dark, 'center');
}

function drawHud(ctx, g, ui) {
  const me = g.sides[0], era = ERAS[me.era], mx = ui.mx, my = ui.my;
  ctx.textBaseline = 'top';

  // painel de madeira
  const grad = ctx.createLinearGradient(0, 0, 0, HUD_H);
  grad.addColorStop(0, '#6b4426'); grad.addColorStop(1, '#3f2716');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let x = 97; x < W; x += 113) ctx.fillRect(x, 0, 1, HUD_H); // emendas das tábuas
  ctx.fillStyle = '#9c6a3c'; ctx.fillRect(0, 0, W, 1);
  ctx.fillStyle = '#22140b'; ctx.fillRect(0, HUD_H - 2, W, 2);
  ctx.fillStyle = '#c08a4a'; ctx.fillRect(0, HUD_H, W, 1);

  if (ui.towers) {
    const free = me.slots.includes(null);
    era.turrets.forEach((def, i) => {
      const pay = me.gold >= def.cost;
      card(ctx, BUTTONS[i], String(i + 1), def, free && pay, pay, inside(BUTTONS[i], mx, my));
    });
    const full = me.slots.length >= MAX_SLOTS, cost = SLOT_COSTS[me.slots.length - 1];
    plank(ctx, SLOT_BTN, full ? 'Vagas 4/4' : `+Vaga ${cost}`, null, !full && me.gold >= cost ? 'go' : 'off', inside(SLOT_BTN, mx, my));
    plank(ctx, SELL_BTN, ui.selling ? 'Clica na torre' : 'Vender', null, ui.selling ? 'hot' : 'wood', inside(SELL_BTN, mx, my));
  } else {
    era.units.forEach((def, i) => {
      const pay = me.gold >= def.cost;
      card(ctx, BUTTONS[i], String(i + 1), def, pay && me.queue.length < QUEUE_MAX, pay, inside(BUTTONS[i], mx, my));
    });
  }

  // ouro e XP
  coin(ctx, 397, 12, 3.4);
  text(ctx, String(Math.floor(me.gold)), 403, 6.5, 10, '#f8d878', 'left', true, '#22140b');
  const next = XP_TO_EVOLVE[me.era];
  text(ctx, 'XP', 392, 20.5, 7, '#9fd4ff', 'left', true, '#22140b');
  hpBar(ctx, 404, 23, 46, next ? me.xp / next : 1, '#5fb4f0', 4);

  const ready = me.specialT <= 0;
  plank(ctx, SPECIAL_BTN, 'Especial', ready ? 'Espaço' : `${Math.ceil(me.specialT)}s`,
    ready ? 'hot' : 'off', inside(SPECIAL_BTN, mx, my), ready ? 0 : 1 - me.specialT / SPECIAL_CD);
  const can = canEvolve(me);
  plank(ctx, EVOLVE_BTN, 'Evoluir', !next ? 'era máx' : can ? 'E: pronto!' : `${Math.floor(100 * me.xp / next)}%`,
    can ? 'go' : 'off', inside(EVOLVE_BTN, mx, my), !next || can ? 0 : me.xp / next);
  plank(ctx, TOGGLE_BTN, ui.towers ? 'Unidades' : 'Torres', '(T)', 'wood', inside(TOGGLE_BTN, mx, my));

  // embaixo do painel: fila de treino com retrato, era e tempo
  for (let i = 0; i < QUEUE_MAX; i++) {
    const x = 6 + i * 19, y = HUD_H + 5;
    box(ctx, x, y, 16, 16, '#7a5432', '#a8794a', '#5b3a22');
    const def = me.queue[i];
    if (!def) continue;
    portrait(ctx, def, x + 1, y + 1, 14, false);
    if (i === 0) hpBar(ctx, x, y + 18, 16, 1 - Math.max(0, me.trainT) / def.train, '#f2c14e', 2);
  }
  text(ctx, `${era.name}  ${fmt(g.time)}`, W - 6, HUD_H + 5, 8, '#fff', 'right', true, '#22140b');
  if (ui.muted) text(ctx, 'som desligado (M)', W - 6, HUD_H + 16, 7, '#ffd0c0', 'right', false, '#22140b');
  if (ui.showFps) text(ctx, `${ui.fps} fps`, W - 6, HUD_H + 26, 7, '#fff', 'right', false, '#22140b');

  if (g.winner >= 0) {
    overlay(ctx, g.winner === 0 ? 'VITÓRIA!' : 'DERROTA...', g.winner === 0 ? '#f8d878' : '#ff8a7a', [
      `${DIFFICULTIES[g.diff].name}  ·  ${fmt(g.time)}  ·  ${me.kills} abates  ·  ${era.name}`,
      ui.newRecord ? 'NOVO RECORDE!' : '',
      'clique ou Enter pra voltar ao menu',
    ]);
  } else if (ui.paused) {
    overlay(ctx, 'PAUSADO', '#fff', ['P ou Esc pra continuar']);
  }
  ctx.textAlign = 'left';
}

function overlay(ctx, title, color, lines) {
  ctx.fillStyle = 'rgba(15,8,4,0.65)'; ctx.fillRect(0, 0, W, H);
  text(ctx, title, W / 2, H / 2 - 52, 30, color, 'center', true, '#22140b');
  lines.forEach((l, i) => text(ctx, l, W / 2, H / 2 - 6 + i * 15, 9, i === 1 ? '#f8d878' : '#f3e6cc', 'center', i === 1, '#22140b'));
}

export function drawMenu(ctx, ui) {
  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  ctx.textBaseline = 'top';
  drawBg(ctx, 0, 0);
  ctx.fillStyle = 'rgba(15,8,4,0.45)'; ctx.fillRect(0, 0, W, H);
  text(ctx, 'CAPIVARA OF WAR', W / 2, 42, 34, '#f8d878', 'center', true, '#3a1f0c');
  text(ctx, 'escolha a dificuldade', W / 2, 98, 9, '#f3e6cc', 'center', false, '#22140b');
  MENU_BTNS.forEach((b, i) => {
    const r = ui.records[i];
    plank(ctx, b, `${i + 1}  ${DIFFICULTIES[i].name}`, r ? `recorde ${fmt(r)}` : 'sem vitória ainda', 'wood', inside(b, ui.mx, ui.my));
  });
  text(ctx, 'M: som  ·  T: torres  ·  E: evoluir  ·  Espaço: especial  ·  F3: fps', W / 2, H - 18, 7, '#f3e6cc', 'center', false, '#22140b');
  if (ui.showFps) text(ctx, `${ui.fps} fps`, W - 6, 6, 7, '#fff', 'right', false, '#22140b');
  ctx.textAlign = 'left';
}
