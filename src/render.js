import {
  W, H, RES, WORLD, GROUND, DEPTH, HUD_H, QUEUE_MAX, ERAS, XP_TO_EVOLVE, DROP_FALL, DIFFICULTIES, SPECIAL_CD, SECRET_ERA,
  MAX_SLOTS, SLOT_COSTS, TURRET_W, TURRET_H, slotY,
} from './data.js';
import { ATTACK, WALK, canEvolve, DYING_TIME } from './battle.js';
import { t, nm, getLang, achText } from './i18n.js';
import { ACHIEVEMENTS } from './achievements.js';

// Sprites: um atlas por era que já tem arte + versão branca de cada um pro piscar de dano.
const atlases = [], whites = [], bgs = [];
let FRAMES = {};
// cada era com arte tem assets/eraN.png + eraN.json (quadros) e assets/bgN.webp (fundo)
async function loadEra(k) {
  if (!ERAS[k].art) return;
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
}
// eras 1 e 2 seguram o começo; as outras baixam em segundo plano (até lá aparecem como quadrados)
const uiAtlas = new Image();
uiAtlas.src = 'assets/ui.png';
let UI = {};
const loadUi = Promise.all([fetch('assets/ui.json').then((r) => r.json()).then((f) => { UI = f; }), uiAtlas.decode()]);
export const ready = Promise.all([document.fonts.load('8px "Jersey 10"'), loadUi, loadEra(0), loadEra(1)])
  .then(() => { for (let k = 2; k < ERAS.length; k++) loadEra(k).catch(() => {}); });

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
  let a = k[s][anim];
  if (!a || !a[0]) a = k[s][anim] = [0, 1, 2, 3].map((n) => FRAMES[`${name}${s ? '_inimigo' : ''}_${anim}_${n}`]); // era ainda baixando: tenta de novo depois
  return a[i];
}

const STRIDE = 4; // px andados por quadro do andar (o passo acompanha o chão, sem patinar)

// Cores dos quadrados das eras que ainda não têm arte.
const COLORS = [
  ['#e08a3c', '#f2c14e', '#c4652d', '#ff5a1a'], // Clã do Rio
  ['#4c7bd9', '#7fb2f0', '#4a4fae', '#8a4cff'], // Clã do Pântano
];
const TURRET_COLORS = ['#a89a7c', '#c9a14a', '#77706a'];
const ERA_COLORS = ['#5a3d1e', '#b8bec8', '#2f6e3a', '#6b7a2f', '#3ff0ff', '#c04cff']; // faixa na cabeça

export const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// posições da interface (em pixels lógicos); o main.js usa as mesmas pra saber onde clicou
export const BUTTONS = [0, 1, 2, 3].map((i) => ({ x: 7 + i * 78, y: 5, w: 74, h: 30 }));
export const SLOT_BTN = { x: 241, y: 5, w: 74, h: 13 };
export const SELL_BTN = { x: 241, y: 22, w: 74, h: 13 };
const RES_BOX = { x: 324, y: 5, w: 104, h: 30 };
export const SPECIAL_BTN = { x: 434, y: 5, w: 66, h: 30 };
export const EVOLVE_BTN = { x: 503, y: 5, w: 66, h: 30 };
export const TOGGLE_BTN = { x: 572, y: 5, w: 63, h: 30 };
export const MENU_BTNS = DIFFICULTIES.map((_, i) => ({ x: W / 2 - 85, y: 122 + i * 33, w: 170, h: 27 }));
export const MODE_BTN = { x: 132, y: 263, w: 120, h: 15 };
export const ACH_BTN = { x: 260, y: 263, w: 120, h: 15 };
export const LANG_BTN = { x: 388, y: 263, w: 120, h: 15 };
export const BACK_BTN = { x: W / 2 - 55, y: 338, w: 110, h: 14 };
const ACH_CELL = (i) => ({ x: 18 + (i % 3) * 204, y: 40 + Math.floor(i / 3) * 59, w: 196, h: 52 });
export const LANG_PICK = [{ x: W / 2 - 150, y: 140, w: 140, h: 46 }, { x: W / 2 + 10, y: 140, w: 140, h: 46 }];

// fundo: a imagem cobre o campo inteiro (WORLD), por frame é só 1 drawImage
function drawBg(ctx, cam, era) {
  const bg = bgs[artEra(era, bgs)], k = bg.width / WORLD;
  ctx.drawImage(bg, cam * k, 0, W * k, bg.height, 0, 0, W, H);
}

export function draw(ctx, g, ui) {
  // tremor: só o campo de batalha mexe, o painel fica parado
  const dt = ui.dt || 0;
  shake *= Math.exp(-dt * 9);
  const sx = shake > 0.05 ? Math.round(rnd(-shake, shake) * RES) : 0, sy = shake > 0.05 ? Math.round(rnd(-shake, shake) * RES) : 0;
  ctx.setTransform(RES, 0, 0, RES, sx, sy);
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
    const k = Math.min(1, Math.abs(p.x - p.x0) / total), arc = ARC[p.era];
    const y = p.y0 + (GROUND - 12 - p.y0) * k - Math.sin(k * Math.PI) * arc;
    // inclinação da trajetória, pra flecha e laser apontarem pra onde vão
    const dir = Math.sign(p.t.x - p.x) || 1, slope = ((GROUND - 12 - p.y0) - Math.cos(k * Math.PI) * Math.PI * arc) / total;
    projectile(ctx, p.x - cam, y, p.era, p.splash, dir, slope);
  }

  for (const p of g.drops) {
    if (p.t > DROP_FALL) continue;
    const y = GROUND - 4 - (p.t / DROP_FALL) * (GROUND - HUD_H);
    drop(ctx, p.x - cam, y, p.era);
  }

  drawParticles(ctx, dt, cam);
  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  drawHud(ctx, g, ui);
}

// altura do arco do tiro por era: pedra/flecha/bala de canhão sobem, bala e laser vão quase retos
const ARC = [18, 22, 16, 4, 0, 0];

// projétil de unidade ou torre, com cara de cada era
function projectile(ctx, x, y, era, splash, dir, slope) {
  if (era === 0) return ball(ctx, x, y, splash ? 2.5 : 1.5, splash ? '#6b4a2a' : '#9a948a'); // pedra / coco
  if (era === 2) return ball(ctx, x, y, splash ? 2.8 : 1.6, '#2b2b2b'); // bala de canhão / chumbo
  const len = era === 1 ? 7 : era === 3 ? 4 : 9, ang = Math.atan2(slope * dir, dir);
  const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
  ctx.lineCap = 'round';
  if (era === 1) { // flecha
    ctx.strokeStyle = '#3a2414'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#d8d8d8'; ctx.fillRect(x - 1, y - 1, 2, 2);
    return;
  }
  if (splash) return ball(ctx, x, y, 2.6, era === 3 ? '#4a5a2a' : era === 4 ? '#7ff6ff' : '#ff9cf0'); // foguete / bola de energia / plasma
  ctx.strokeStyle = era === 3 ? '#ffd84a' : era === 4 ? '#5ff0ff' : '#ff6ad5'; // bala tracejante / laser / plasma
  ctx.lineWidth = era === 3 ? 1.4 : 2.2;
  ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x, y); ctx.stroke();
  if (era >= 4) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8; ctx.stroke(); }
}

// o que cai do céu no especial de cada era
function drop(ctx, x, y, era) {
  if (era === 0) return ball(ctx, x, y, 3, '#6b3f1f'); // coco
  if (era === 2) return ball(ctx, x, y, 3, '#2b2b2b'); // bala de canhão
  ctx.lineCap = 'round';
  if (era === 1) { // flecha caindo de ponta
    ctx.strokeStyle = '#3a2414'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#d8d8d8'; ctx.fillRect(x - 1, y - 1, 2, 2.5);
    return;
  }
  if (era === 3) { // bomba
    ball(ctx, x, y, 3, '#4a5a2a');
    ctx.fillStyle = '#2a3018'; ctx.fillRect(x - 2.5, y - 6, 5, 2);
    return;
  }
  if (era === 5) { // meteoro com rastro de fogo
    ctx.fillStyle = 'rgba(255,140,40,0.45)'; ctx.fillRect(x - 2, y - 16, 4, 14);
    ctx.fillStyle = 'rgba(255,220,120,0.7)'; ctx.fillRect(x - 1, y - 10, 2, 9);
    return ball(ctx, x, y, 3.2, '#7a4a3a');
  }
  // raio da laranja sagrada: coluna de luz descendo
  ctx.fillStyle = 'rgba(255,190,80,0.35)'; ctx.fillRect(x - 3, HUD_H, 6, y - HUD_H);
  ctx.fillStyle = '#ffe6a0'; ctx.fillRect(x - 1, HUD_H, 2, y - HUD_H);
  ball(ctx, x, y, 2.5, '#ffb347');
}

function ball(ctx, x, y, r, color) {
  ctx.fillStyle = '#22140e';
  ctx.beginPath(); ctx.arc(x, y, r + 1 / RES, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function drawUnit(ctx, g, u, s, cam) {
  const def = u.def, d = g.sides[s].dir;
  const cx = u.x - cam, by = GROUND + u.z * DEPTH; // profundidade espalhada na largura da estradinha
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
  const t = u.deadT, cx = u.x - cam, by = GROUND + u.z * DEPTH;
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

// ---------- efeitos (só visual) ----------

// pool fixo: nada é criado durante o jogo; se lotar, recicla a partícula mais velha
const PMAX = 400, parts = [];
for (let i = 0; i < PMAX; i++) parts.push({ t: 1, life: 0, x: 0, y: 0, vx: 0, vy: 0, g: 0, size: 1, grow: 0, color: '', kind: 0 });
let pi = 0, shake = 0;
const rnd = (a, b) => a + Math.random() * (b - a);

// kind: 0 quadradinho, 1 anel, 2 clarão redondo
function emit(x, y, vx, vy, life, size, color, grav = 0, grow = 0, kind = 0) {
  const p = parts[pi];
  pi = (pi + 1) % PMAX;
  p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.t = 0; p.life = life;
  p.size = size; p.color = color; p.g = grav; p.grow = grow; p.kind = kind;
}

// x, y no mundo; dir = pra onde quem causou estava virado
export function effect(name, x, y, dir) {
  switch (name) {
    case 'hit': // faíscas + um clarãozinho
      emit(x, y, 0, 0, 0.12, 2, '#fffbe6', 0, 3, 2);
      for (let i = 0; i < 7; i++) emit(x, y, rnd(-40, 40) + dir * 35, rnd(-70, -15), rnd(0.25, 0.4), rnd(1.5, 2.5), i % 2 ? '#fff6c8' : '#ffd25a', 160);
      break;
    case 'die': // nuvem de poeira no chão
      for (let i = 0; i < 14; i++) emit(x + rnd(-10, 10), y - rnd(0, 4), rnd(-30, 30), rnd(-22, -4), rnd(0.7, 1.1), rnd(1.5, 2.5), i % 2 ? '#d9b98f' : '#b8946c', -4, 3, 2);
      break;
    case 'shoot':
      for (let i = 0; i < 3; i++) emit(x + dir * 6, y, dir * rnd(10, 25), rnd(-10, 0), 0.35, 1, '#efe8dc', 0, 1.5, 2);
      break;
    case 'tshoot': // fumaça na boca da torre
      emit(x + dir * 2, y, 0, 0, 0.1, 2.5, '#fff3c0', 0, 3, 2);
      for (let i = 0; i < 6; i++) emit(x + dir * 2, y, dir * rnd(20, 45), rnd(-15, 5), rnd(0.35, 0.6), rnd(1, 1.5), '#efe8dc', -10, 2.5, 2);
      break;
    case 'boom': // explosão: clarão, anel, destroços e fumaça
      emit(x, y - 6, 0, 0, 0.3, 6, '#ffe27a', 0, 16, 2);
      emit(x, y - 6, 0, 0, 0.35, 8, '#fff3c0', 0, 22, 1);
      for (let i = 0; i < 16; i++) emit(x, y - 3, rnd(-80, 80), rnd(-140, -50), rnd(0.6, 0.9), rnd(2, 3.5), i % 3 ? '#6b4a2a' : '#8a8a8a', 300);
      for (let i = 0; i < 10; i++) emit(x + rnd(-8, 8), y - rnd(3, 12), rnd(-18, 18), rnd(-24, -8), rnd(0.8, 1.3), rnd(2, 3), i % 2 ? '#a9a39a' : '#8e887f', -6, 5, 2);
      shake = Math.max(shake, 3);
      break;
    case 'thud': // coco do especial batendo no chão
      for (let i = 0; i < 10; i++) emit(x, y - 1, rnd(-50, 50), rnd(-100, -35), rnd(0.45, 0.7), rnd(2, 3), '#7a5332', 260);
      for (let i = 0; i < 4; i++) emit(x + rnd(-5, 5), y - 2, rnd(-12, 12), rnd(-12, -3), rnd(0.6, 0.9), 2, '#d9b98f', -4, 3, 2);
      shake = Math.max(shake, 1.4);
      break;
    case 'special':
      shake = Math.max(shake, 1.5);
      break;
    case 'evolve': // brilhos dourados subindo em volta da base
      for (let i = 0; i < 50; i++) emit(x + rnd(-40, 40), y + rnd(-45, 45), rnd(-10, 10), rnd(-45, -15), rnd(0.9, 1.6), rnd(1.5, 2.5), i % 2 ? '#fff3b0' : '#f2c14e', -10);
      break;
  }
}

function drawParticles(ctx, dt, cam) {
  for (let i = 0; i < PMAX; i++) {
    const p = parts[i];
    if (p.t >= p.life) continue;
    p.t += dt;
    p.vy += p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 1 - 1.5 * dt;
    const k = 1 - p.t / p.life;
    if (k <= 0) continue;
    const sz = p.size + p.grow * (1 - k);
    ctx.globalAlpha = Math.min(1, k * 1.6);
    if (p.kind === 1) { // anel
      ctx.strokeStyle = p.color; ctx.lineWidth = 2.5 * k;
      ctx.beginPath(); ctx.arc(p.x - cam, p.y, sz, 0, Math.PI * 2); ctx.stroke();
    } else if (p.kind === 2) { // clarão redondo
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x - cam, p.y, sz, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - cam - sz / 2, p.y - sz / 2, sz, sz);
    }
  }
  ctx.globalAlpha = 1;
}

// ---------- interface ----------

const P = 1 / RES; // 1 pixel de verdade da tela (os sprites também são desenhados nessa escala)
const OUT = '#1c0f07'; // contorno escuro, o mesmo tom do contorno dos sprites

const fonts = {};
// a Jersey 10 tem um peso só e desenha menor: os tamanhos da interface são multiplicados aqui
const font = (px) => (fonts[px] ||= `${Math.round(px * 1.4 * 10) / 10}px "Jersey 10", monospace`);

// texto com contorno, pra ler em cima de qualquer fundo
function text(ctx, str, x, y, px, color, align = 'left', bold = false, outline = null, maxW = undefined) {
  ctx.font = font(px);
  ctx.textAlign = align;
  if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = px >= 14 ? 2.4 : 1.5; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y, maxW); }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y, maxW); // maxW aperta o texto se não couber
}

const inside = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;

// veio da madeira: um ladrilho com riscos claros e escuros, gerado uma vez em pixels de tela
const grains = new WeakMap(); // o padrão fica preso à tela onde foi criado
function grainPattern(ctx) {
  if (grains.has(ctx)) return grains.get(ctx);
  const c = document.createElement('canvas');
  c.width = 192; c.height = 96;
  const g = c.getContext('2d');
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < c.height; y += 2) {
    for (let x = 0; x < c.width;) {
      const len = 6 + rnd() * 40;
      const v = rnd();
      g.fillStyle = v < 0.35 ? 'rgba(20,8,0,0.16)' : v < 0.5 ? 'rgba(255,235,190,0.08)' : 'rgba(0,0,0,0)';
      g.fillRect(x, y, len, 1);
      x += len;
    }
  }
  for (let k = 0; k < 3; k++) { // nós da madeira
    const x = rnd() * c.width, y = rnd() * c.height;
    g.fillStyle = 'rgba(20,8,0,0.22)';
    g.beginPath(); g.ellipse(x, y, 5, 2, 0, 0, Math.PI * 2); g.fill();
  }
  const pat = ctx.createPattern(c, 'repeat');
  pat.setTransform(new DOMMatrix([P, 0, 0, P, 0, 0]));
  grains.set(ctx, pat);
  return pat;
}

// placa com contorno de 2px, luz em cima/esquerda e sombra embaixo/direita (como os sprites)
function panel(ctx, x, y, w, h, fill, light, dark, wood = true) {
  ctx.fillStyle = OUT; ctx.fillRect(x - 2 * P, y - 2 * P, w + 4 * P, h + 4 * P);
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  if (wood) { ctx.fillStyle = grainPattern(ctx); ctx.fillRect(x, y, w, h); }
  ctx.fillStyle = light; ctx.fillRect(x, y, w, 2 * P); ctx.fillRect(x, y, 2 * P, h);
  ctx.fillStyle = dark; ctx.fillRect(x, y + h - 2 * P, w, 2 * P); ctx.fillRect(x + w - 2 * P, y, 2 * P, h);
}

// buraco escavado na madeira (onde ficam retrato, ícone, barra)
function inset(ctx, x, y, w, h, fill = '#2a170b') {
  ctx.fillStyle = OUT; ctx.fillRect(x - P, y - P, w + 2 * P, h + 2 * P);
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x, y, w, 2 * P); ctx.fillRect(x, y, 2 * P, h);
  ctx.fillStyle = 'rgba(255,220,170,0.18)'; ctx.fillRect(x, y + h - P, w, P);
}

function nail(ctx, x, y) {
  ctx.fillStyle = OUT; ctx.fillRect(x - 1, y - 1, 2, 2);
  ctx.fillStyle = '#9aa0a6'; ctx.fillRect(x - 1 + P, y - 1 + P, 2 - 2 * P, 2 - 2 * P);
  ctx.fillStyle = '#e4e8ec'; ctx.fillRect(x - 1 + P, y - 1 + P, P, P);
}

// ícone do atlas da interface, com o lado maior = size; 20 = 1:1 com a arte
function icon(ctx, name, cx, cy, size, alpha = 1) {
  const f = UI[name];
  if (!f) return;
  const k = size / Math.max(f[2], f[3]), w = f[2] * k, h = f[3] * k;
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = size * RES < Math.max(f[2], f[3]); // reduzindo, suaviza; no tamanho certo, pixel puro
  ctx.drawImage(uiAtlas, f[0], f[1], f[2], f[3], cx - w / 2, cy - h / 2, w, h);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
}

// barra com borda escura; sem cor = verde/amarelo/vermelho pela vida que sobra
function hpBar(ctx, x, y, w, frac, color, h = 3) {
  frac = Math.max(0, Math.min(1, frac));
  ctx.fillStyle = OUT; ctx.fillRect(x - 2 * P, y - 2 * P, w + 4 * P, h + 4 * P);
  ctx.fillStyle = '#4a1d1d'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color || (frac > 0.5 ? '#5bd15b' : frac > 0.25 ? '#e8c440' : '#e34b3b');
  ctx.fillRect(x, y, w * frac, h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y, w * frac, Math.max(P, h / 3)); // brilho
}

// retrato: o primeiro quadro do personagem (ou a torre) encaixado na caixa
function portrait(ctx, def, x, y, size, dim) {
  const f = def.sprite && (FRAMES[def.sprite] || frame(def.sprite, 0, 'walk', 0));
  ctx.globalAlpha = dim ? 0.4 : 1;
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

const PAPER = ['#ecd7a6', '#fff2cf', '#b38d55'], PAPER_HOVER = ['#f7e6bd', '#fffaea', '#c29c62'], PAPER_OFF = ['#a99472', '#c3b08c', '#7f6c4f'];

// carta de unidade/torre: retrato no buraco, etiqueta da tecla, nome e preço
function card(ctx, b, key, def, ok, canPay, hover) {
  const lift = ok && hover ? -1 : 0, y = b.y + lift, c = !ok ? PAPER_OFF : hover ? PAPER_HOVER : PAPER;
  panel(ctx, b.x, y, b.w, b.h, c[0], c[1], c[2], false);
  inset(ctx, b.x + 3, y + 3, 26, b.h - 6, ok ? '#5b3a1f' : '#4a3a2a');
  portrait(ctx, def, b.x + 3, y + 3, 26, !ok);
  // etiqueta da tecla, pregada no canto
  ctx.fillStyle = OUT; ctx.fillRect(b.x - 3, y - 3, 9, 9);
  ctx.fillStyle = '#3a2212'; ctx.fillRect(b.x - 3 + P, y - 3 + P, 9 - 2 * P, 9 - 2 * P);
  text(ctx, key, b.x + 1.5, y - 2.5, 6.5, '#f8d878', 'center');
  text(ctx, nm(def), b.x + 32, y + 3.5, 8, ok ? '#2a160a' : '#4a3a2a', 'left', true, null, b.w - 35);
  icon(ctx, 'coin', b.x + 37, y + 23, 9, ok ? 1 : 0.6);
  text(ctx, String(def.cost), b.x + 43, y + 17, 9, canPay ? (ok ? '#2a160a' : '#4a3a2a') : '#b3261e');
}

const TONES = {
  go: ['#4e9a3a', '#93dc72', '#2f6a22'],
  hot: ['#c9573c', '#ff9e7f', '#8d3622'],
  off: ['#6a5442', '#8b725c', '#46362a'],
  wood: ['#9d6c3e', '#d7a46c', '#64401f'],
};

// botão de madeira simples (texto no meio, ícone opcional à esquerda)
function plank(ctx, b, label, tone, hover, ico = null) {
  const c = TONES[tone];
  panel(ctx, b.x, b.y, b.w, b.h, hover && tone !== 'off' ? c[1] : c[0], c[1], c[2]);
  const tx = ico ? b.x + b.h + (b.w - b.h) / 2 : b.x + b.w / 2;
  if (ico) icon(ctx, ico, b.x + b.h / 2 + 1, b.y + b.h / 2, b.h - 3);
  text(ctx, label, tx, b.y + (b.h - 9) / 2, 7.5, tone === 'off' ? '#e6d6bd' : '#fff4dc', 'center', true, OUT, b.w - (ico ? b.h + 4 : 6));
}

// botão de ação: soquete redondo com ícone (e a carga girando por cima), título e linha de status
function action(ctx, b, ico, label, sub, tone, hover, charge, glow) {
  const c = TONES[tone];
  panel(ctx, b.x, b.y, b.w, b.h, hover && tone !== 'off' ? c[1] : c[0], c[1], c[2]);
  const cx = b.x + 14, cy = b.y + b.h / 2, r = 11;
  if (glow) { // pulsando quando está pronto
    ctx.fillStyle = `rgba(255,230,120,${0.25 + 0.2 * Math.sin(performance.now() / 160)})`;
    ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(cx, cy, r + 2 * P, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a170b'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  icon(ctx, ico, cx, cy, 17, charge < 1 ? 0.55 : 1);
  if (charge < 1) { // a parte que falta carregar fica escura, girando no sentido do relógio
    ctx.fillStyle = 'rgba(15,8,4,0.6)';
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI / 2 + charge * Math.PI * 2, Math.PI * 1.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#f8d878'; ctx.lineWidth = 2 * P;
    ctx.beginPath(); ctx.arc(cx, cy, r - P, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2); ctx.stroke();
  }
  const ink = tone === 'off' ? '#e6d6bd' : '#fff4dc';
  text(ctx, label, b.x + 27, b.y + 5, 7.5, ink, 'left', true, OUT, b.w - 29);
  text(ctx, sub, b.x + 27, b.y + 17, 7, tone === 'off' ? '#cdb89c' : '#ffe9a8', 'left', false, OUT, b.w - 29);
}

// fundo do painel de cima: desenhado uma vez numa tela à parte, depois é um drawImage por quadro
let hudBg = null;
function drawHudBg(ctx) {
  if (!hudBg) {
    hudBg = document.createElement('canvas');
    hudBg.width = W * RES; hudBg.height = (HUD_H + 3) * RES;
    const c = hudBg.getContext('2d');
    c.setTransform(RES, 0, 0, RES, 0, 0);
    const grad = c.createLinearGradient(0, 0, 0, HUD_H);
    grad.addColorStop(0, '#74492a'); grad.addColorStop(1, '#4a2c17');
    c.fillStyle = grad; c.fillRect(0, 0, W, HUD_H);
    c.fillStyle = grainPattern(c); c.fillRect(0, 0, W, HUD_H);
    c.fillStyle = 'rgba(20,8,0,0.35)'; c.fillRect(0, HUD_H / 2, W, 2 * P); // emenda entre as duas tábuas
    c.fillStyle = 'rgba(255,220,170,0.12)'; c.fillRect(0, HUD_H / 2 + 2 * P, W, P);
    c.fillStyle = '#a7743f'; c.fillRect(0, 0, W, 2 * P);
    // moldura de baixo: viga escura + filete claro
    c.fillStyle = OUT; c.fillRect(0, HUD_H - 2, W, 2);
    c.fillStyle = '#3a2212'; c.fillRect(0, HUD_H, W, 2);
    c.fillStyle = '#b07a44'; c.fillRect(0, HUD_H, W, P);
    for (let x = 4; x < W; x += 80) { nail(c, x, 3); nail(c, x, HUD_H - 4); }
  }
  ctx.drawImage(hudBg, 0, 0, W, HUD_H + 3);
}

function drawHud(ctx, g, ui) {
  const me = g.sides[0], era = ERAS[me.era], mx = ui.mx, my = ui.my;
  ctx.textBaseline = 'top';
  drawHudBg(ctx);

  if (ui.towers) {
    const free = me.slots.includes(null);
    era.turrets.forEach((def, i) => {
      const pay = me.gold >= def.cost;
      card(ctx, BUTTONS[i], String(i + 1), def, free && pay, pay, inside(BUTTONS[i], mx, my));
    });
    const full = me.slots.length >= MAX_SLOTS, cost = SLOT_COSTS[me.slots.length - 1];
    plank(ctx, SLOT_BTN, full ? t('slotsFull') : `${t('slot')} ${cost}`, !full && me.gold >= cost ? 'go' : 'off', inside(SLOT_BTN, mx, my), 'slot');
    plank(ctx, SELL_BTN, ui.selling ? t('sellPick') : t('sell'), ui.selling ? 'hot' : 'wood', inside(SELL_BTN, mx, my), 'sell');
  } else {
    era.units.forEach((def, i) => {
      const pay = me.gold >= def.cost;
      card(ctx, BUTTONS[i], String(i + 1), def, pay && me.queue.length < QUEUE_MAX, pay, inside(BUTTONS[i], mx, my));
    });
  }

  // ouro e XP num buraco escavado no painel
  const R = RES_BOX;
  inset(ctx, R.x, R.y, R.w, R.h);
  icon(ctx, 'coin', R.x + 9, R.y + 8, 12);
  text(ctx, String(Math.floor(me.gold)), R.x + 17, R.y + 1, 11, '#f8d878', 'left', true, OUT);
  const next = XP_TO_EVOLVE[me.era], frac = next ? Math.min(1, me.xp / next) : 1;
  icon(ctx, 'xp', R.x + 9, R.y + 21, 11);
  const bx = R.x + 17, bw = R.w - 21;
  hpBar(ctx, bx, R.y + 18, bw, frac, frac >= 1 ? '#8fe6ff' : '#4aa8ea', 5);
  ctx.fillStyle = 'rgba(15,8,4,0.45)';
  for (let k = 1; k < 10; k++) ctx.fillRect(bx + (bw * k) / 10, R.y + 18, P, 5); // marquinhas de 10%

  const ready = me.specialT <= 0, can = canEvolve(me);
  action(ctx, SPECIAL_BTN, 'special', t('special'), ready ? t('spaceKey') : `${Math.ceil(me.specialT)}s`,
    ready ? 'hot' : 'off', inside(SPECIAL_BTN, mx, my), ready ? 1 : 1 - me.specialT / SPECIAL_CD, ready);
  const hidden = me.era + 1 === SECRET_ERA; // do Futuro em diante ninguém sabe o que vem
  action(ctx, EVOLVE_BTN, 'evolve', t('evolve'), !next ? t('maxEra') : can ? (hidden ? 'E: ???' : t('ready')) : hidden ? t('secret') : `${Math.floor(100 * frac)}%`,
    can ? 'go' : 'off', inside(EVOLVE_BTN, mx, my), !next || can ? 1 : frac, can);
  action(ctx, TOGGLE_BTN, ui.towers ? 'unit' : 'turret', ui.towers ? t('units') : t('turrets'), 'T', 'wood', inside(TOGGLE_BTN, mx, my), 1, false);

  // plaquinha pendurada embaixo do painel: fila de treino
  const qx = 5, qy = HUD_H + 1;
  panel(ctx, qx, qy, QUEUE_MAX * 19 + 18, 22, '#5a3820', '#83562f', '#3a2212');
  icon(ctx, 'time', qx + 8, qy + 11, 13);
  for (let i = 0; i < QUEUE_MAX; i++) {
    const x = qx + 17 + i * 19, y = qy + 3;
    inset(ctx, x, y, 16, 16, '#3a2414');
    const def = me.queue[i];
    if (!def) continue;
    portrait(ctx, def, x + 1, y + 1, 14, false);
    if (i === 0) {
      const k = 1 - Math.max(0, me.trainT) / def.train;
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(x, y + 16 - 2, 16 * k, 2);
    }
  }

  // plaquinha da era e do tempo, no canto direito
  ctx.font = font(8);
  const label = g.mode === 'endless' ? `${t('wave')} ${g.wave}  ·  ${nm(era)}` : `${nm(era)}  ·  ${fmt(g.time)}`, lw = ctx.measureText(label).width + 12;
  const ex = W - 5 - lw, ey = HUD_H + 1;
  panel(ctx, ex, ey, lw, 14, '#5a3820', '#83562f', '#3a2212');
  text(ctx, label, ex + lw / 2, ey + 2, 8, '#fff4dc', 'center', true, OUT);
  if (ui.muted) icon(ctx, 'mute', ex - 11, ey + 7, 13);
  if (ui.showFps) text(ctx, `${ui.fps} fps`, W - 6, ey + 18, 7, '#fff', 'right', false, OUT);
  if (g.mode === 'endless' && !g.waveOn && g.winner < 0) {
    text(ctx, `${t('nextWave')} ${Math.max(0, Math.ceil(g.waveT))}s`, W - 6, ey + 18, 8, '#ffe9a8', 'right', false, OUT);
  }
  if (g.mode === 'endless' && g.bannerT > 0 && g.winner < 0) { // aviso grande de onda
    ctx.globalAlpha = Math.min(1, g.bannerT / 0.4);
    const title = g.bannerDone ? t('waveDone') : `${t('wave')} ${g.wave}`;
    text(ctx, title, W / 2, 112, 20, g.bannerDone ? '#a8f07a' : '#f8d878', 'center', true, OUT);
    if (g.bannerDone) { icon(ctx, 'coin', W / 2 - 20, 150, 12); text(ctx, `+${g.bonus}`, W / 2 - 12, 143, 11, '#f8d878', 'left', true, OUT); }
    ctx.globalAlpha = 1;
  }

  if (g.winner >= 0 && g.mode === 'endless') {
    board(ctx, t('gameOver'), '#ff8a7a', 270, 128, (x, y, w) => {
      const row = y + 46;
      statLine(ctx, x + w / 2, row, [['time', fmt(g.time)], ['kills', `${me.kills} ${t('kills')}`], ['evolve', `${t('wave')} ${g.wave}`]]);
      text(ctx, nm(DIFFICULTIES[g.diff]), x + w / 2, y + 30, 8, '#e8d2ad', 'center', false, OUT);
      if (ui.newRecord) text(ctx, t('record'), x + w / 2, row + 20, 10, '#f8d878', 'center', true, OUT);
      text(ctx, t('backMenu'), x + w / 2, y + 128 - 20, 7.5, '#e8d2ad', 'center', false, OUT);
    });
  } else if (g.winner >= 0) {
    const win = g.winner === 0;
    board(ctx, win ? t('win') : t('lose'), win ? '#f8d878' : '#ff8a7a', 270, 128, (x, y, w) => {
      const row = y + 46;
      statLine(ctx, x + w / 2, row, [['time', fmt(g.time)], ['kills', `${me.kills} ${t('kills')}`], ['evolve', nm(era)]]);
      text(ctx, nm(DIFFICULTIES[g.diff]), x + w / 2, y + 30, 8, '#e8d2ad', 'center', false, OUT);
      if (ui.newRecord) text(ctx, t('record'), x + w / 2, row + 20, 10, '#f8d878', 'center', true, OUT);
      text(ctx, t('backMenu'), x + w / 2, y + 128 - 20, 7.5, '#e8d2ad', 'center', false, OUT);
    });
  } else if (ui.paused) {
    board(ctx, t('paused'), '#fff4dc', 220, 76, (x, y, w) => {
      text(ctx, t('resume'), x + w / 2, y + 46, 8, '#e8d2ad', 'center', false, OUT);
    });
  }
  drawToasts(ctx, ui);
  ctx.textAlign = 'left';
}

// linha de ícone + valor, centralizada
function statLine(ctx, cx, y, items) {
  ctx.font = font(9);
  const widths = items.map(([, v]) => ctx.measureText(v).width + 16), total = widths.reduce((a, b) => a + b, 0) + (items.length - 1) * 10;
  let x = cx - total / 2;
  items.forEach(([ico, v], i) => {
    icon(ctx, ico, x + 6, y + 6, 12);
    text(ctx, v, x + 14, y + 0.5, 9, '#fff4dc', 'left', false, OUT);
    x += widths[i] + 10;
  });
}

// quadro de madeira no meio da tela (pausa, vitória, derrota)
function board(ctx, title, color, w, h, body) {
  ctx.fillStyle = 'rgba(15,8,4,0.6)'; ctx.fillRect(0, 0, W, H);
  const x = Math.round((W - w) / 2), y = Math.round((H - h) / 2);
  panel(ctx, x, y, w, h, '#6a4325', '#9a6a3c', '#3f2615');
  inset(ctx, x + 5, y + 5, w - 10, h - 10, 'rgba(42,23,11,0.55)');
  nail(ctx, x + 4, y + 4); nail(ctx, x + w - 4, y + 4); nail(ctx, x + 4, y + h - 4); nail(ctx, x + w - 4, y + h - 4);
  text(ctx, title, x + w / 2, y + 7, 17, color, 'center', true, OUT);
  body(x, y, w);
}

// logo do jogo em duas linhas, igual ao banner do itch
function logo(ctx, cx, y) {
  text(ctx, 'CAPIVARA', cx, y, 30, '#f8d878', 'center', true, '#3a1f0c');
  text(ctx, 'OF WAR', cx, y + 36, 20, '#ff9b3d', 'center', true, '#3a1f0c');
}

// capivaras andando paradas no lugar, enfeitando as telas de menu
function mascots(ctx) {
  const i = Math.floor(performance.now() / 140) % 4, y = GROUND + 10;
  for (const [x, s] of [[110, 0], [W - 110, 1]]) {
    ctx.fillStyle = 'rgba(30,20,10,0.28)';
    ctx.beginPath(); ctx.ellipse(x, y, 10, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    draw1(ctx, frame('tacape', s, 'walk', i), x, y, 0);
  }
}

function menuBackdrop(ctx) {
  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  ctx.textBaseline = 'top';
  drawBg(ctx, 0, 0);
  ctx.fillStyle = 'rgba(15,8,4,0.4)'; ctx.fillRect(0, 0, W, H);
}

export function drawMenu(ctx, ui) {
  menuBackdrop(ctx);
  logo(ctx, W / 2, 22);
  mascots(ctx);
  text(ctx, t('pick'), W / 2, 104, 9, '#f3e6cc', 'center', false, OUT);
  MENU_BTNS.forEach((b, i) => {
    const r = (ui.mode === 'endless' ? ui.waves : ui.records)[i], hover = inside(b, ui.mx, ui.my), c = hover ? TONES.wood[1] : TONES.wood[0];
    panel(ctx, b.x, b.y, b.w, b.h, c, TONES.wood[1], TONES.wood[2]);
    nail(ctx, b.x + 4, b.y + b.h / 2); nail(ctx, b.x + b.w - 4, b.y + b.h / 2);
    text(ctx, `${i + 1}`, b.x + 14, b.y + 5, 11, '#f8d878', 'center', true, OUT);
    text(ctx, nm(DIFFICULTIES[i]), b.x + 26, b.y + 3, 9, '#fff4dc', 'left', true, OUT);
    if (r && ui.mode === 'endless') { icon(ctx, 'evolve', b.x + 30, b.y + 19, 8); text(ctx, `${t('bestWave')} ${r}`, b.x + 36, b.y + 14.5, 7, '#ffe9a8', 'left', false, OUT); }
    else if (r) { icon(ctx, 'time', b.x + 30, b.y + 19, 8); text(ctx, `${t('best')} ${fmt(r)}`, b.x + 36, b.y + 14.5, 7, '#ffe9a8', 'left', false, OUT); }
    else text(ctx, ui.mode === 'endless' ? t('noWave') : t('noWin'), b.x + 26, b.y + 14.5, 7, '#e8d2ad', 'left', false, OUT);
  });
  plank(ctx, MODE_BTN, ui.mode === 'endless' ? t('endless') : t('classic'), ui.mode === 'endless' ? 'hot' : 'wood', inside(MODE_BTN, ui.mx, ui.my));
  plank(ctx, ACH_BTN, `${t('achievements')} ${ui.got.size}/${ACHIEVEMENTS.length}`, 'wood', inside(ACH_BTN, ui.mx, ui.my));
  plank(ctx, LANG_BTN, t('lang'), 'wood', inside(LANG_BTN, ui.mx, ui.my));
  drawToasts(ctx, ui);
  text(ctx, t('help'), W / 2, H - 16, 7, '#f3e6cc', 'center', false, OUT);
  if (ui.showFps) text(ctx, `${ui.fps} fps`, W - 6, 6, 7, '#fff', 'right', false, OUT);
  ctx.textAlign = 'left';
}

// primeira tela: escolher o idioma (sempre bilíngue)
export function drawLangPick(ctx, ui) {
  menuBackdrop(ctx);
  logo(ctx, W / 2, 30);
  mascots(ctx);
  text(ctx, 'Escolha o idioma  ·  Choose your language', W / 2, 116, 9, '#f3e6cc', 'center', false, OUT);
  LANG_PICK.forEach((b, i) => {
    const hover = inside(b, ui.mx, ui.my), on = getLang() === (i ? 'en' : 'pt');
    const c = hover ? TONES.wood[1] : TONES.wood[0];
    panel(ctx, b.x, b.y, b.w, b.h, c, TONES.wood[1], TONES.wood[2]);
    if (on) { ctx.strokeStyle = '#f8d878'; ctx.lineWidth = 2 * P; ctx.strokeRect(b.x - 4 * P, b.y - 4 * P, b.w + 8 * P, b.h + 8 * P); }
    nail(ctx, b.x + 4, b.y + 4); nail(ctx, b.x + b.w - 4, b.y + 4);
    text(ctx, i ? 'English' : 'Português', b.x + b.w / 2, b.y + 8, 14, '#fff4dc', 'center', true, OUT);
    text(ctx, i ? 'press 2' : 'aperte 1', b.x + b.w / 2, b.y + 30, 7.5, '#ffe9a8', 'center', false, OUT);
  });
  ctx.textAlign = 'left';
}

export function drawAchievements(ctx, ui) {
  menuBackdrop(ctx);
  ctx.fillStyle = 'rgba(15,8,4,0.35)'; ctx.fillRect(0, 0, W, H);
  text(ctx, `${t('achTitle')}  ${ui.got.size}/${ACHIEVEMENTS.length}`, W / 2, 8, 15, '#f8d878', 'center', true, OUT);
  ACHIEVEMENTS.forEach((a, i) => {
    const b = ACH_CELL(i), on = ui.got.has(a.id), [name, desc] = achText(a), hide = a.secret && !on;
    panel(ctx, b.x, b.y, b.w, b.h, on ? '#9d6c3e' : '#5a4636', on ? '#d7a46c' : '#7a6452', on ? '#64401f' : '#3a2c22');
    inset(ctx, b.x + 5, b.y + 6, 38, 38, on ? '#5b3a1f' : '#2a1d14');
    if (hide) text(ctx, '?', b.x + 24, b.y + 11, 18, '#7a6452', 'center', true, OUT);
    else icon(ctx, a.icon, b.x + 24, b.y + 25, 30, on ? 1 : 0.3);
    text(ctx, hide ? t('secret') : name, b.x + 49, b.y + 8, 9, on ? '#fff4dc' : '#b8a48c', 'left', true, OUT, b.w - 54);
    text(ctx, hide ? t('secret') : desc, b.x + 49, b.y + 26, 7, on ? '#ffe9a8' : '#9a8670', 'left', false, OUT, b.w - 54);
    if (on) { // selo de conquistado
      ctx.fillStyle = '#5bd15b'; ctx.beginPath(); ctx.arc(b.x + b.w - 9, b.y + 9, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 2 * P; ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.beginPath();
      ctx.moveTo(b.x + b.w - 11.5, b.y + 9); ctx.lineTo(b.x + b.w - 9.5, b.y + 11); ctx.lineTo(b.x + b.w - 6.5, b.y + 7); ctx.stroke();
    }
  });
  plank(ctx, BACK_BTN, t('back'), 'wood', inside(BACK_BTN, ui.mx, ui.my));
  drawToasts(ctx, ui);
  ctx.textAlign = 'left';
}

// avisos de conquista: deslizam do topo, ficam uns segundos e somem
function drawToasts(ctx, ui) {
  ui.toasts.forEach((tt, i) => {
    const a = ACHIEVEMENTS.find((x) => x.id === tt.id), [name] = achText(a);
    const y = 46 + i * 34 - (1 - Math.min(1, (4 - tt.t) / 0.3)) * 20; // entra deslizando de cima
    ctx.globalAlpha = Math.max(0, Math.min(1, tt.t / 0.4));
    const w = 190, x = W / 2 - w / 2;
    panel(ctx, x, y, w, 28, '#6a4325', '#9a6a3c', '#3f2615');
    inset(ctx, x + 4, y + 4, 20, 20, '#5b3a1f');
    icon(ctx, a.icon, x + 14, y + 14, 16);
    text(ctx, t('achGot'), x + 29, y + 3, 7, '#f8d878', 'left', true, OUT);
    text(ctx, name, x + 29, y + 13, 9, '#fff4dc', 'left', true, OUT, w - 34);
    ctx.globalAlpha = 1;
  });
}
