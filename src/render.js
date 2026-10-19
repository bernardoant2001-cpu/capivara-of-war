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
const logoImg = new Image();
logoImg.src = 'assets/logo.png';
export const ready = Promise.all([document.fonts.load('8px "Jersey 10"'), loadUi, logoImg.decode(), loadEra(0), loadEra(1)])
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

let mine = 0;
const baseTop = [0, 0];

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
export const ONLINE_BTN = { x: W / 2 - 60, y: 284, w: 120, h: 15 };
export const CODE_BOX = { x: W / 2 - 58, y: 112, w: 116, h: 34 };
export const NICK_BTN = { x: W / 2 - 80, y: 84, w: 160, h: 16 };
export const RULE_BTNS = [0, 1, 2].map((i) => ({ x: W / 2 - 100, y: 196 + i * 21, w: 200, h: 17 }));
export const START_BTN = { x: W / 2 - 70, y: 264, w: 140, h: 22 };
export const EMO_BTNS = [0, 1, 2, 3, 4, 5].map((i) => ({ x: W / 2 - 75 + i * 25, y: H - 26, w: 23, h: 23 }));
export const REMATCH_BTN = { x: 178, y: 238, w: 136, h: 17 };
export const END_MENU_BTN = { x: 326, y: 238, w: 136, h: 17 };
export const SUDDEN = [0, 5, 10]; // opções de morte súbita, em minutos
export const PAUSE_BTN = { x: 122, y: HUD_H + 3, w: 17, h: 17 };
export const SPEED_BTN = { x: 141, y: HUD_H + 3, w: 21, h: 17 };
export const MINIMAP = { x: 167, y: HUD_H + 4, w: 328, h: 15 };
// botões do quadro de pausa (quantos forem): o quadro fica centralizado na tela
export function pauseBtns(n) {
  const y = Math.round((H - (74 + n * 21)) / 2);
  return Array.from({ length: n }, (_, i) => ({ x: W / 2 - 80, y: y + 34 + i * 21, w: 160, h: 17 }));
}

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
  mine = ui.me || 0;
  drawBg(ctx, cam, g.sides[mine].era);

  for (let s = 0; s < 2; s++) drawBase(ctx, g, s, cam, ui);

  // alcance da torre com o mouse em cima do botão
  const hoverTurret = ui.towers && ERAS[g.sides[mine].era].turrets[ui.hover];
  if (hoverTurret) {
    const side = g.sides[mine], b = side.base, d = side.dir, fx = Math.round(b.x + d * b.w / 2) - cam, r = hoverTurret.range;
    const x0 = d > 0 ? fx : fx - r;
    ctx.fillStyle = 'rgba(255,236,150,0.32)'; ctx.fillRect(x0, GROUND - 4, r, 18);
    ctx.fillStyle = 'rgba(255,236,150,0.7)'; ctx.fillRect(x0, GROUND - 4, r, 1); ctx.fillRect(x0, GROUND + 13, r, 1); // bordas da faixa
    ctx.fillStyle = 'rgba(255,230,140,0.85)';
    ctx.fillRect(fx + d * r - (d > 0 ? 1 : 0), GROUND - 12, 1, 28); // até onde a torre alcança
    ctx.textBaseline = 'top';
    text(ctx, `${t('range')} ${r}`, fx + d * (r - 3), GROUND - 22, 7, '#ffe9a8', d > 0 ? 'right' : 'left', false, OUT);
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
  drawPops(ctx, dt, cam);
  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  if (g.mode === 'pvp') drawNames(ctx, g, ui, cam);
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
  baseTop[s] = GROUND + 12 - h - 8;
  hpBar(ctx, Math.round(cx - b.w / 2), baseTop[s], b.w, b.hp / b.maxHp, null, 4);

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
      if (s === mine && ui.towers) { // vaga livre: contorno pra mostrar onde a torre vai
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
    if (s === mine && ui.selling) {
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
    case 'gold0': case 'gold1': // ouro de abate: só mostra o que é seu
      if (+name[4] === mine) { pops.push({ x, y, t: 0, str: '+' + dir }); if (pops.length > 40) pops.shift(); }
      break;
    case 'evolve': // brilhos dourados subindo em volta da base
      for (let i = 0; i < 50; i++) emit(x + rnd(-40, 40), y + rnd(-45, 45), rnd(-10, 10), rnd(-45, -15), rnd(0.9, 1.6), rnd(1.5, 2.5), i % 2 ? '#fff3b0' : '#f2c14e', -10);
      break;
  }
}

const pops = [];
function drawPops(ctx, dt, cam) {
  ctx.textBaseline = 'top';
  for (const p of pops) {
    p.t += dt;
    const k = Math.min(1, p.t / 0.9);
    ctx.globalAlpha = 1 - k * k;
    const y = p.y - 6 - k * 16;
    icon(ctx, 'coin', p.x - cam - 5, y + 4, 7);
    text(ctx, p.str, p.x - cam - 1, y, 7.5, '#f8d878', 'left', true, OUT);
  }
  ctx.globalAlpha = 1;
  while (pops.length && pops[0].t >= 0.9) pops.shift();
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
  const f = def.sprite && (FRAMES[mine ? def.sprite + '_inimigo' : def.sprite] || frame(def.sprite, mine, 'walk', 0));
  ctx.globalAlpha = dim ? 0.4 : 1;
  if (!f) {
    ctx.fillStyle = (def.type !== undefined && COLORS[mine][def.type]) || '#999';
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

// botão balança quando a ação não dá (ui.deny vem do main.js)
const jig = (ui, b) => (ui.deny && ui.deny.b === b ? Math.sin(ui.deny.t * 70) * 2.5 * (ui.deny.t / 0.35) : 0);
function shaken(ctx, ui, b, draw) {
  const j = jig(ui, b);
  if (j) { ctx.save(); ctx.translate(j, 0); }
  draw();
  if (j) ctx.restore();
}

function drawHud(ctx, g, ui) {
  const me = g.sides[mine], era = ERAS[me.era], mx = ui.mx, my = ui.my;
  ctx.textBaseline = 'top';
  drawHudBg(ctx);

  if (ui.towers) {
    const free = me.slots.includes(null);
    era.turrets.forEach((def, i) => {
      const pay = me.gold >= def.cost;
      shaken(ctx, ui, BUTTONS[i], () => card(ctx, BUTTONS[i], String(i + 1), def, free && pay, pay, inside(BUTTONS[i], mx, my)));
    });
    const full = me.slots.length >= MAX_SLOTS, cost = SLOT_COSTS[me.slots.length - 1];
    shaken(ctx, ui, SLOT_BTN, () => plank(ctx, SLOT_BTN, full ? t('slotsFull') : `${t('slot')} ${cost}`, !full && me.gold >= cost ? 'go' : 'off', inside(SLOT_BTN, mx, my), 'slot'));
    plank(ctx, SELL_BTN, ui.selling ? t('sellPick') : t('sell'), ui.selling ? 'hot' : 'wood', inside(SELL_BTN, mx, my), 'sell');
  } else {
    era.units.forEach((def, i) => {
      const pay = me.gold >= def.cost;
      shaken(ctx, ui, BUTTONS[i], () => card(ctx, BUTTONS[i], String(i + 1), def, pay && me.queue.length < QUEUE_MAX, pay, inside(BUTTONS[i], mx, my)));
    });
  }

  // ouro e XP num buraco escavado no painel
  const R = RES_BOX;
  const broke = ui.deny && ui.deny.r === 'gold' && Math.floor(ui.deny.t * 12) % 2 === 0; // pisca vermelho quando falta ouro
  inset(ctx, R.x, R.y, R.w, R.h, broke ? '#5a1d14' : undefined);
  icon(ctx, 'coin', R.x + 9, R.y + 8, 12);
  text(ctx, String(Math.floor(me.gold)), R.x + 17, R.y + 1, 11, broke ? '#ff6a5a' : '#f8d878', 'left', true, OUT);
  const next = XP_TO_EVOLVE[me.era], frac = next ? Math.min(1, me.xp / next) : 1;
  icon(ctx, 'xp', R.x + 9, R.y + 21, 11);
  const bx = R.x + 17, bw = R.w - 21;
  hpBar(ctx, bx, R.y + 18, bw, frac, frac >= 1 ? '#8fe6ff' : '#4aa8ea', 5);
  ctx.fillStyle = 'rgba(15,8,4,0.45)';
  for (let k = 1; k < 10; k++) ctx.fillRect(bx + (bw * k) / 10, R.y + 18, P, 5); // marquinhas de 10%

  const ready = me.specialT <= 0, can = canEvolve(me);
  shaken(ctx, ui, SPECIAL_BTN, () => action(ctx, SPECIAL_BTN, 'special', t('special'), ready ? t('spaceKey') : `${Math.ceil(me.specialT)}s`,
    ready ? 'hot' : 'off', inside(SPECIAL_BTN, mx, my), ready ? 1 : 1 - me.specialT / SPECIAL_CD, ready));
  const hidden = me.era + 1 === SECRET_ERA; // do Futuro em diante ninguém sabe o que vem
  shaken(ctx, ui, EVOLVE_BTN, () => action(ctx, EVOLVE_BTN, 'evolve', t('evolve'), !next ? t('maxEra') : can ? (hidden ? 'E: ???' : t('ready')) : hidden ? t('secret') : `${Math.floor(100 * frac)}%`,
    can ? 'go' : 'off', inside(EVOLVE_BTN, mx, my), !next || can ? 1 : frac, can));
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

  drawMinimap(ctx, g, ui);
  smallBtn(ctx, PAUSE_BTN, inside(PAUSE_BTN, mx, my), () => {
    ctx.fillStyle = OUT; ctx.fillRect(PAUSE_BTN.x + 4.5, PAUSE_BTN.y + 3.5, 8, 10);
    ctx.fillStyle = '#fff4dc'; ctx.fillRect(PAUSE_BTN.x + 5, PAUSE_BTN.y + 4, 2.5, 9); ctx.fillRect(PAUSE_BTN.x + 9.5, PAUSE_BTN.y + 4, 2.5, 9);
    ctx.fillStyle = OUT; ctx.fillRect(PAUSE_BTN.x + 7.5, PAUSE_BTN.y + 4, 2, 9);
  });
  if (g.mode !== 'pvp') smallBtn(ctx, SPEED_BTN, inside(SPEED_BTN, mx, my), () => text(ctx, `${ui.speed}x`, SPEED_BTN.x + SPEED_BTN.w / 2, SPEED_BTN.y + 3, 8.5, ui.speed > 1 ? '#f8d878' : '#fff4dc', 'center', true, OUT));

  // plaquinha da era e do tempo, no canto direito
  ctx.font = font(8);
  const label = g.mode === 'endless' ? `${t('wave')} ${g.wave}  ·  ${nm(era)}` : `${nm(era)}  ·  ${fmt(g.time)}`, lw = ctx.measureText(label).width + 12;
  const ex = W - 5 - lw, ey = HUD_H + 1;
  panel(ctx, ex, ey, lw, 14, '#5a3820', '#83562f', '#3a2212');
  text(ctx, label, ex + lw / 2, ey + 2, 8, '#fff4dc', 'center', true, OUT);
  if (ui.muted) icon(ctx, 'mute', ex - 11, ey + 7, 13);
  if (ui.showFps) text(ctx, `${ui.fps} fps`, W - 6, ey + (g.mode === 'pvp' ? 44 : 18), 7, '#fff', 'right', false, OUT);
  if (g.mode === 'pvp') drawPvpHud(ctx, g, ui, ey + 17);
  if (ui.deny && ui.deny.key) text(ctx, t(ui.deny.key), ui.deny.b.x + ui.deny.b.w / 2, HUD_H + 27, 8, '#ff8a7a', 'center', true, OUT);
  if (!ui.paused && g.winner < 0 && !ui.netEnd) drawTip(ctx, g, ui, me, era);
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
  } else if (g.winner >= 0 && g.mode === 'pvp') {
    drawPvpEnd(ctx, g, ui);
  } else if (g.winner >= 0) {
    const win = g.winner === mine;
    board(ctx, win ? t('win') : t('lose'), win ? '#f8d878' : '#ff8a7a', 270, 128, (x, y, w) => {
      const row = y + 46;
      statLine(ctx, x + w / 2, row, [['time', fmt(g.time)], ['kills', `${me.kills} ${t('kills')}`], ['evolve', nm(era)]]);
      text(ctx, g.mode === 'pvp' ? t('onlineTag') : nm(DIFFICULTIES[g.diff]), x + w / 2, y + 30, 8, '#e8d2ad', 'center', false, OUT);
      if (ui.newRecord) text(ctx, t('record'), x + w / 2, row + 20, 10, '#f8d878', 'center', true, OUT);
      text(ctx, t('backMenu'), x + w / 2, y + 128 - 20, 7.5, '#e8d2ad', 'center', false, OUT);
    });
  } else if (ui.netEnd) { // online acabou sem vencedor: o outro saiu ou as partidas ficaram diferentes
    board(ctx, t(ui.netEnd), '#ff8a7a', 270, 76, (x, y, w) => {
      text(ctx, t('backMenu'), x + w / 2, y + 46, 7.5, '#e8d2ad', 'center', false, OUT);
    });
  } else if (ui.paused) {
    const items = ui.pauseItems, btns = pauseBtns(items.length), h = 74 + items.length * 21, pvp = g.mode === 'pvp';
    const label = { resume: t('resumeBtn'), restart: t('restart'), sound: ui.muted ? t('soundOff') : t('soundOn'), full: t('fullscreen'), quit: t('quit') };
    board(ctx, pvp ? t('menuTitle') : t('paused'), '#fff4dc', 280, h, (x, y, w) => {
      if (pvp) text(ctx, t('stillRunning'), x + w / 2, y + 24, 7, '#ffe9a8', 'center', false, OUT);
      items.forEach((k, i) => plank(ctx, btns[i], label[k], k === 'resume' ? 'go' : k === 'quit' ? 'hot' : 'wood', inside(btns[i], mx, my)));
      text(ctx, t('controls1'), x + w / 2, y + h - 31, 7, '#e8d2ad', 'center', false, OUT, w - 16);
      text(ctx, t('controls2'), x + w / 2, y + h - 20, 7, '#e8d2ad', 'center', false, OUT, w - 16);
    });
  } else if (ui.waiting) {
    text(ctx, t('waitOpp'), W / 2, 112, 11, '#fff4dc', 'center', true, OUT);
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

// logo do jogo (assets/logo.png), com o topo em y
function logo(ctx, cx, y) {
  const w = logoImg.width / RES, h = logoImg.height / RES;
  ctx.drawImage(logoImg, Math.round((cx - w / 2) * RES) / RES, y, w, h);
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
  logo(ctx, W / 2, 5);
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
  plank(ctx, ONLINE_BTN, t('online'), 'go', inside(ONLINE_BTN, ui.mx, ui.my));
  drawToasts(ctx, ui);
  text(ctx, t('help'), W / 2, H - 16, 7, '#f3e6cc', 'center', false, OUT);
  if (ui.showFps) text(ctx, `${ui.fps} fps`, W - 6, 6, 7, '#fff', 'right', false, OUT);
  ctx.textAlign = 'left';
}

// primeira tela: escolher o idioma (sempre bilíngue)
export function drawLangPick(ctx, ui) {
  menuBackdrop(ctx);
  logo(ctx, W / 2, 14);
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

// ---------- online ----------

const RULE_LABELS = (r) => [
  `${t('ruleEra')}: ${nm(ERAS[r.era])}`,
  `${t('rulePace')}: ${r.fast ? t('fast') : t('normal')}`,
  `${t('ruleSudden')}: ${r.sudden ? `${r.sudden} min` : t('off')}`,
];

// tela do online: apelido, criar sala ou entrar, e o saguão com as regras
export function drawOnline(ctx, ui) {
  menuBackdrop(ctx);
  mascots(ctx);
  const n = ui.net, mx = ui.mx, my = ui.my;
  text(ctx, t('onlineTitle'), W / 2, 18, 20, '#f8d878', 'center', true, OUT);
  text(ctx, t('onlineHelp'), W / 2, 46, 8, '#f3e6cc', 'center', false, OUT);
  if (!n.role) {
    const edit = n.editing === 'nick', blink = edit && performance.now() % 1000 < 500 ? '_' : '';
    plank(ctx, NICK_BTN, `${t('nick')}: ${ui.nick}${blink}`, edit ? 'hot' : 'wood', inside(NICK_BTN, mx, my), 'unit');
    text(ctx, edit ? t('nickDone') : t('nickEdit'), W / 2, NICK_BTN.y + 19, 7, '#e8d2ad', 'center', false, OUT);
    LANG_PICK.forEach((b, i) => {
      const hover = inside(b, mx, my);
      panel(ctx, b.x, b.y, b.w, b.h, hover ? TONES.wood[1] : TONES.wood[0], TONES.wood[1], TONES.wood[2]);
      nail(ctx, b.x + 4, b.y + 4); nail(ctx, b.x + b.w - 4, b.y + 4);
      text(ctx, i ? t('join') : t('host'), b.x + b.w / 2, b.y + 9, 12, '#fff4dc', 'center', true, OUT, b.w - 12);
      text(ctx, i ? t('press2') : t('press1'), b.x + b.w / 2, b.y + 30, 7.5, '#ffe9a8', 'center', false, OUT);
    });
    if (n.status) text(ctx, t(n.status), W / 2, 196, 9, n.error ? '#ff8a7a' : '#fff4dc', 'center', true, OUT);
  } else {
    const B = CODE_BOX, host = n.role === 'host', lobby = n.phase === 'lobby';
    text(ctx, host ? t('roomCode') : lobby ? `${t('roomOf')} ${ui.rival}` : t('typeCode'), W / 2, B.y - 16, 9, '#f3e6cc', 'center', false, OUT);
    panel(ctx, B.x, B.y, B.w, B.h, TONES.wood[0], TONES.wood[1], TONES.wood[2]);
    for (let i = 0; i < 4; i++) {
      const x = B.x + 6 + i * 27;
      inset(ctx, x, B.y + 5, 23, B.h - 10, '#3a2414');
      const c = n.code[i] || (n.role === 'join' && !lobby && i === n.code.length && performance.now() % 1000 < 500 ? '_' : '');
      text(ctx, c, x + 11.5, B.y + 6, 20, '#f8d878', 'center', true, OUT);
    }
    let status = n.status && t(n.status), color = n.error ? '#ff8a7a' : '#fff4dc';
    if (lobby) { status = host ? `${ui.rival} ${t('joined')}` : `${t('waitHost')} ${ui.rival}...`; color = '#a8f07a'; }
    if (n.role === 'join' && !lobby && !n.busy) text(ctx, t('enterJoin'), W / 2, B.y + B.h + 6, 7.5, '#ffe9a8', 'center', false, OUT);
    if (status) text(ctx, status, W / 2, B.y + B.h + 19, 9, color, 'center', true, OUT);
    if (host || lobby) { // regras: o anfitrião escolhe, quem entrou só vê
      text(ctx, host ? t('rulesHost') : t('rules'), W / 2, RULE_BTNS[0].y - 13, 7.5, '#e8d2ad', 'center', false, OUT);
      RULE_LABELS(n.rules).forEach((label, i) => plank(ctx, RULE_BTNS[i], host ? `${i + 1}  ${label}` : label, host ? 'wood' : 'off', host && inside(RULE_BTNS[i], mx, my)));
    }
    if (host && lobby) plank(ctx, START_BTN, t('start'), 'go', inside(START_BTN, mx, my));
  }
  plank(ctx, BACK_BTN, t('back'), 'wood', inside(BACK_BTN, mx, my));
  ctx.textAlign = 'left';
}

// nome em cima de cada base e o balão de emote (preso na borda da tela se a base estiver fora)
function drawNames(ctx, g, ui, cam) {
  ctx.textBaseline = 'top';
  for (let s = 0; s < 2; s++) {
    const b = g.sides[s].base, cx = b.x - cam, name = s === mine ? ui.nick : ui.rival;
    if (cx > -60 && cx < W + 60) text(ctx, name, cx, baseTop[s] - 11, 8, s === mine ? '#fff4dc' : '#ffb59a', 'center', true, OUT);
    const e = ui.emotes.find((x) => x.side === s);
    if (!e) continue;
    const pop = Math.min(1, (2.5 - e.t) / 0.15), x = Math.max(22, Math.min(W - 22, cx)), y = Math.max(HUD_H + 6, baseTop[s] - 46);
    ctx.globalAlpha = Math.min(1, e.t / 0.3);
    const sz = 30 * (0.6 + 0.4 * pop);
    panel(ctx, x - 17, y, 34, 32, '#fff4dc', '#ffffff', '#c9b48e');
    ctx.fillStyle = '#fff4dc'; ctx.fillRect(x - 3, y + 31, 6, 3); // biquinho do balão
    icon(ctx, 'emo' + e.i, x, y + 16, sz);
    ctx.globalAlpha = 1;
  }
}

function drawPvpHud(ctx, g, ui, y) {
  // plaquinha do rival: nome, era e XP, e o sinal da conexão
  const foe = g.sides[1 - mine], next = XP_TO_EVOLVE[foe.era], frac = next ? Math.min(1, foe.xp / next) : 1;
  ctx.font = font(8);
  const label = `${ui.rival}  ·  ${nm(ERAS[foe.era])}`, w = Math.max(110, ctx.measureText(label).width + 14), x = W - 5 - w;
  panel(ctx, x, y, w, 24, '#5a3820', '#83562f', '#3a2212');
  text(ctx, label, x + w / 2, y + 2, 8, '#ffb59a', 'center', true, OUT);
  hpBar(ctx, x + 6, y + 15, w - 12, frac, frac >= 1 ? '#ff9a7a' : '#d06a4a', 4);
  const ping = ui.ping, c = ping == null ? '#9a8670' : ping < 120 ? '#5bd15b' : ping < 250 ? '#f2c14e' : '#ff5a4a';
  ctx.fillStyle = OUT; ctx.fillRect(x - 13, y + 4, 8, 8);
  ctx.fillStyle = c; ctx.fillRect(x - 12, y + 5, 6, 6);
  if (ping != null) text(ctx, `${Math.round(ping)}ms`, x - 9, y + 13, 6.5, '#fff4dc', 'center', false, OUT);

  // morte súbita: aviso antes e durante
  const left = g.rules.sudden * 60 - g.time;
  if (g.winner < 0 && g.sudden) {
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(performance.now() / 120);
    text(ctx, t('suddenNow'), W / 2, HUD_H + 22, 11, '#ff8a7a', 'center', true, OUT);
    ctx.globalAlpha = 1;
  } else if (g.winner < 0 && g.rules.sudden && left < 30) {
    text(ctx, `${t('suddenIn')} ${Math.ceil(left)}s`, W / 2, HUD_H + 22, 9, '#ffe9a8', 'center', true, OUT);
  }

  // contagem de largada
  if (g.countdown > 0) {
    ctx.fillStyle = 'rgba(15,8,4,0.35)'; ctx.fillRect(0, HUD_H + 3, W, H);
    text(ctx, String(Math.ceil(g.countdown)), W / 2, 92, 46, '#f8d878', 'center', true, OUT);
    text(ctx, `${ui.nick}  vs  ${ui.rival}`, W / 2, 150, 12, '#fff4dc', 'center', true, OUT);
    text(ctx, mine ? t('youRight') : t('youLeft'), W / 2, 168, 8, '#ffe9a8', 'center', false, OUT);
    text(ctx, RULE_LABELS(g.rules).join('   ·   '), W / 2, 184, 7.5, '#e8d2ad', 'center', false, OUT);
  } else if (g.time < 0.9 && g.winner < 0) {
    ctx.globalAlpha = Math.min(1, (0.9 - g.time) / 0.3);
    text(ctx, t('fight'), W / 2, 100 - g.time * 10, 34, '#ff9b3d', 'center', true, OUT);
    ctx.globalAlpha = 1;
  }

  // botões de emote, embaixo no meio
  if (g.winner < 0 && !ui.netEnd) {
    EMO_BTNS.forEach((b, i) => {
      const hover = inside(b, ui.mx, ui.my);
      panel(ctx, b.x, b.y - (hover ? 1 : 0), b.w, b.h, hover ? '#83562f' : '#5a3820', '#9a6a3c', '#3a2212');
      icon(ctx, 'emo' + i, b.x + b.w / 2, b.y + b.h / 2 - (hover ? 1 : 0), 18, ui.emoCd > 0 ? 0.45 : 1);
    });
    text(ctx, t('emoKeys'), W / 2, EMO_BTNS[0].y - 9, 6.5, '#f3e6cc', 'center', false, OUT);
  }
}

// resumo do fim: os dois lado a lado, e revanche
function drawPvpEnd(ctx, g, ui) {
  const win = g.winner === mine, me = g.sides[mine], foe = g.sides[1 - mine];
  board(ctx, win ? t('win') : t('lose'), win ? '#f8d878' : '#ff8a7a', 320, 170, (x, y, w) => {
    const c1 = x + 196, c2 = x + 268;
    text(ctx, `${fmt(g.time)}  ·  ${g.sudden ? t('bySudden') : t('onlineTag')}`, x + w / 2, y + 27, 7.5, '#e8d2ad', 'center', false, OUT);
    text(ctx, ui.nick, c1, y + 38, 8, '#fff4dc', 'center', true, OUT, 68);
    text(ctx, ui.rival, c2, y + 38, 8, '#ffb59a', 'center', true, OUT, 68);
    const rows = [
      ['kills', t('kills'), me.kills, foe.kills],
      ['unit', t('statUnits'), me.tally.units, foe.tally.units],
      ['turret', t('statTurrets'), me.tally.turrets, foe.tally.turrets],
      ['special', t('statSpecials'), me.tally.specials, foe.tally.specials],
      ['evolve', t('statEra'), nm(ERAS[me.era]), nm(ERAS[foe.era])],
    ];
    rows.forEach(([ico, label, a, b], i) => {
      const ry = y + 51 + i * 15;
      if (i % 2 === 0) { ctx.fillStyle = 'rgba(255,230,180,0.07)'; ctx.fillRect(x + 12, ry - 2, w - 24, 14); }
      icon(ctx, ico, x + 22, ry + 5, 11);
      text(ctx, label, x + 32, ry, 8, '#e8d2ad', 'left', false, OUT);
      const better = typeof a === 'number' && a !== b ? (a > b ? 0 : 1) : -1;
      text(ctx, String(a), c1, ry, 8.5, better === 0 ? '#f8d878' : '#fff4dc', 'center', true, OUT, 68);
      text(ctx, String(b), c2, ry, 8.5, better === 1 ? '#f8d878' : '#fff4dc', 'center', true, OUT, 68);
    });
    const r = ui.rematch;
    const msg = ui.oppGone ? t('oppGone') : r.them && !r.me ? `${ui.rival} ${t('wantsRematch')}` : r.me ? `${t('waitRematch')} ${ui.rival}...` : '';
    if (msg) text(ctx, msg, x + w / 2, y + 128, 8, ui.oppGone ? '#ff8a7a' : '#a8f07a', 'center', true, OUT);
    plank(ctx, REMATCH_BTN, t('rematch'), ui.oppGone ? 'off' : r.them || r.me ? 'go' : 'wood', !ui.oppGone && inside(REMATCH_BTN, ui.mx, ui.my));
    plank(ctx, END_MENU_BTN, t('menuEnter'), 'wood', inside(END_MENU_BTN, ui.mx, ui.my));
  });
}

// ---------- ajudas da partida ----------

function smallBtn(ctx, b, hover, inner) {
  panel(ctx, b.x, b.y, b.w, b.h, hover ? '#83562f' : '#5a3820', '#9a6a3c', '#3a2212');
  inner();
}

// o campo inteiro em miniatura: bases com a vida, cada unidade um pontinho e o pedaço que a câmera mostra
function drawMinimap(ctx, g, ui) {
  const M = MINIMAP, x0 = M.x + 9, w = M.w - 18, sx = (x) => x0 + (x / WORLD) * w;
  inset(ctx, M.x, M.y, M.w, M.h, 'rgba(42,23,11,0.85)');
  ctx.fillStyle = 'rgba(255,230,180,0.18)'; ctx.fillRect(x0, M.y + M.h - 4, w, P);
  for (let s = 0; s < 2; s++) {
    ctx.fillStyle = s ? '#7fb2f0' : '#ff9b3d';
    for (const u of g.sides[s].units) ctx.fillRect(Math.round(sx(u.x) * RES) / RES - 1, M.y + M.h - (u.def.type >= 2 ? 9 : 7), 2, u.def.type >= 2 ? 5 : 3);
    const b = g.sides[s].base, frac = Math.max(0, b.hp / b.maxHp), bx = s ? M.x + M.w - 8 : M.x + 3, bh = M.h - 6;
    ctx.fillStyle = OUT; ctx.fillRect(bx - P, M.y + 3 - P, 5 + 2 * P, bh + 2 * P);
    ctx.fillStyle = '#4a1d1d'; ctx.fillRect(bx, M.y + 3, 5, bh);
    ctx.fillStyle = frac > 0.5 ? '#5bd15b' : frac > 0.25 ? '#e8c440' : '#e34b3b';
    ctx.fillRect(bx, M.y + 3 + bh * (1 - frac), 5, bh * frac); // vida da base enchendo de baixo pra cima
  }
  ctx.strokeStyle = 'rgba(255,244,220,0.75)'; ctx.lineWidth = 2 * P;
  ctx.strokeRect(sx(ui.cam), M.y + 2, (W / WORLD) * w, M.h - 4);
}
// quanto o x da tela no minimapa vale no campo (pro clique na miniatura)
export const minimapToWorld = (x) => ((x - MINIMAP.x - 9) / (MINIMAP.w - 18)) * WORLD;

// quebra o texto em linhas que cabem na largura
function wrap(ctx, str, px, maxW) {
  ctx.font = font(px);
  const lines = [];
  let line = '';
  for (const word of str.split(' ')) {
    const tryLine = line ? line + ' ' + word : word;
    if (line && ctx.measureText(tryLine).width > maxW) { lines.push(line); line = word; } else line = tryLine;
  }
  if (line) lines.push(line);
  return lines;
}

// balão de informação do botão embaixo do mouse (ou do dedo segurando)
function drawTip(ctx, g, ui, me, era) {
  const mx = ui.mx, my = ui.my;
  if (mx < 0 || my > HUD_H) return;
  let b = null, title = '', tag = '', tagColor = '#ffe9a8', stats = [], lines = [];
  const i = BUTTONS.findIndex((x) => inside(x, mx, my));
  const def = i >= 0 && (ui.towers ? era.turrets : era.units)[i];
  if (def) {
    b = BUTTONS[i]; title = nm(def);
    if (ui.towers) {
      tag = def.splash ? `${t('turret')} · ${t('area')}` : t('turret');
      stats = [['kills', `${t('dmg')} ${def.dmg}`], ['time', `${t('every')} ${def.cd}s`], ['turret', `${t('range')} ${def.range}`]];
    } else {
      tag = def.type === 3 ? t('legendary') : def.splash ? t('area') : def.ranged ? t('ranged') : t('melee');
      tagColor = def.type === 3 ? '#f8d878' : def.ranged ? '#9fd4ff' : '#ffb59a';
      stats = [['base', `${t('hp')} ${def.hp}`], ['kills', `${t('dmg')} ${def.dmg} / ${def.cd}s`], ['time', `${t('trainTime')} ${def.train}s`]];
      if (def.ranged) stats.push(['unit', `${t('range')} ${def.range}`]);
    }
  } else if (inside(SPECIAL_BTN, mx, my)) {
    b = SPECIAL_BTN; title = nm(era.special);
    lines = [t('tipSpecial').replace('{n}', era.special.count).replace('{d}', era.special.dmg)];
  } else if (inside(EVOLVE_BTN, mx, my)) {
    b = EVOLVE_BTN; title = t('evolve');
    const next = XP_TO_EVOLVE[me.era];
    if (!next || me.era >= ERAS.length - 1) lines = [t('maxEra')];
    else {
      lines = [t('tipEvolve').replace('{e}', me.era + 1 === SECRET_ERA ? '???' : nm(ERAS[me.era + 1]))];
      lines.push(me.xp >= next ? t('ready') : t('tipXp').replace('{x}', Math.ceil(next - me.xp)));
    }
  } else if (ui.towers && inside(SLOT_BTN, mx, my)) { b = SLOT_BTN; title = t('slot'); lines = [t('tipSlot')]; }
  else if (ui.towers && inside(SELL_BTN, mx, my)) { b = SELL_BTN; title = t('sell'); lines = [t('tipSell')]; }
  if (!b) return;

  const w = 158, pad = 6;
  lines = lines.flatMap((l) => wrap(ctx, l, 7.5, w - pad * 2));
  const rows = Math.ceil(stats.length / 2), h = 22 + rows * 13 + lines.length * 10 + 3;
  const x = Math.max(4, Math.min(W - w - 4, b.x + b.w / 2 - w / 2)), y = HUD_H + 4;
  panel(ctx, x, y, w, h, '#4a2c17', '#83562f', '#2a170b');
  text(ctx, title, x + pad, y + 4, 9, '#fff4dc', 'left', true, OUT, w - 70);
  if (tag) text(ctx, tag, x + w - pad, y + 5.5, 7, tagColor, 'right', true, OUT, 70);
  ctx.fillStyle = 'rgba(255,230,180,0.18)'; ctx.fillRect(x + pad, y + 17, w - pad * 2, P);
  stats.forEach(([ico, str], k) => {
    const cx = x + pad + (k % 2) * ((w - pad * 2) / 2), cy = y + 21 + Math.floor(k / 2) * 13;
    icon(ctx, ico, cx + 4, cy + 5, 9);
    text(ctx, str, cx + 11, cy, 7.5, '#ffe9a8', 'left', false, OUT, (w - pad * 2) / 2 - 12);
  });
  lines.forEach((l, k) => text(ctx, l, x + pad, y + 21 + rows * 13 + k * 10, 7.5, '#ffe9a8', 'left', false, OUT));
}
