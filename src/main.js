import { W, H, RES, WORLD, HUD_H, TURRET_W, TURRET_H, slotY } from './data.js';
import { newGame, update, train, buyTurret, buySlot, sellTurret, evolve, special } from './battle.js';
import {
  draw, drawMenu, drawLangPick, drawAchievements, drawOnline, ready, effect, LANG_BTN, LANG_PICK, MODE_BTN, ACH_BTN, BACK_BTN, ONLINE_BTN, CODE_BOX,
  BUTTONS, SLOT_BTN, SELL_BTN, TOGGLE_BTN, SPECIAL_BTN, EVOLVE_BTN, MENU_BTNS,
} from './render.js';
import { createMatch } from './lockstep.js';
import * as net from './net.js';
import * as audio from './audio.js';
import { t, toggleLang, setLang } from './i18n.js';
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
  screen: 'lang', // lang -> menu (ou conquistas, ou online) -> jogo
  me: 0, // lado de quem joga aqui; no online quem entra na sala é o 1
  net: null, netEnd: null, waiting: false,
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
  Object.assign(ui, { cam: 0, me: 0, paused: false, towers: false, selling: false, newRecord: false, saved: false });
}

// ---------- online ----------
let match = null, link = null, session = null, lastMsg = 0, stallT = 0;

function openOnline() { ui.screen = 'online'; ui.net = { role: null, code: '', status: null, error: false, busy: false }; }
function leaveOnline() {
  const l = link, s = session;
  match = link = session = null; // antes de fechar, pra queda da conexão não virar aviso
  l?.close(); s?.close();
  Object.assign(ui, { me: 0, netEnd: null, waiting: false });
}

// respostas do net.js; só valem enquanto a tela continua sendo a mesma tentativa
const events = (n) => ({
  status: (k) => { if (ui.net === n) Object.assign(n, { status: k, error: false }); },
  error: (k) => { if (ui.net === n && !match) Object.assign(n, { status: k, error: true, busy: false }); },
  ready: (l) => (ui.net === n && !match ? connected(l, n.role) : l.close()),
});

async function connect(n, fn) {
  session?.close();
  Object.assign(n, { status: 'loading', error: false, busy: true });
  const s = await fn(n.code, events(n));
  if (ui.net === n && !match) session = s; else s?.close();
}
const createRoom = () => { ui.net.role = 'host'; ui.net.code = net.newCode(); connect(ui.net, net.host); };
const joinRoom = () => { if (ui.net.code.length === 4 && !ui.net.busy) connect(ui.net, net.join); };

function connected(l, role) {
  link = l; session = null; // fechar o link fecha o peer junto
  lastMsg = performance.now();
  l.onClose(() => netDown('oppLeft'));
  l.onData((msg) => {
    lastMsg = performance.now();
    if (msg.hello) { if (!match) startOnline(msg.seed, 1); } else match?.receive(msg);
  });
  if (role === 'host') { // quem cria a sala sorteia a semente e joga com o Clã do Rio
    const seed = (Math.random() * 2 ** 32) >>> 0;
    l.send({ hello: 1, seed });
    startOnline(seed, 0);
  }
}

function startOnline(seed, me) {
  match = createMatch(seed, me, (m) => link?.send(m));
  g = match.g;
  stallT = 0;
  Object.assign(ui, { cam: me ? WORLD - W : 0, me, paused: false, towers: false, selling: false, newRecord: false, saved: false, netEnd: null, waiting: false });
  audio.play('evolve');
}
const netDown = (key) => { if (match && g.winner < 0 && !ui.netEnd) ui.netEnd = key; };
const backToMenu = () => { g = null; leaveOnline(); };

// avança a partida online até onde os comandos do outro já chegaram
function netFrame(dt) {
  if (match.desync) netDown('desync');
  if (performance.now() - lastMsg > 10000) netDown('oppLeft');
  if (ui.netEnd) return;
  acc = Math.min(acc + dt, 0.1); // travado esperando não junta uma rajada de passos
  for (let n = 0; acc >= STEP && match.canStep() && n < 8; n++) { match.step(); acc -= STEP; }
  if (match.behind() > 2 && match.canStep()) match.step(); // ficou pra trás: alcança aos poucos
  match.flush();
  stallT = match.canStep() ? 0 : stallT + dt;
  ui.waiting = stallT > 0.5;
}
// aba escondida não roda quadros; continua avisando o outro que está vivo
setInterval(() => match?.flush(), 1000);

function onlineKey(e) {
  const n = ui.net;
  if (e.code === 'Escape') return onlineBack();
  if (!n.role) { if (e.code === 'Digit1') createRoom(); else if (e.code === 'Digit2') n.role = 'join'; return; }
  if (n.role !== 'join' || n.busy) return;
  if (e.code === 'Enter') joinRoom();
  else if (e.code === 'Backspace') n.code = n.code.slice(0, -1);
  else if (e.key.length === 1 && net.validChar(e.key.toUpperCase()) && n.code.length < 4) n.code += e.key.toUpperCase();
}
function onlineClick(x, y) {
  const n = ui.net;
  if (inside(BACK_BTN, x, y)) return onlineBack();
  if (!n.role) {
    const k = LANG_PICK.findIndex((b) => inside(b, x, y));
    if (k === 0) createRoom(); else if (k === 1) n.role = 'join';
  } else if (n.role === 'join' && !n.busy && inside(CODE_BOX, x, y)) { // celular não tem teclado na tela do jogo
    const code = (prompt(t('typeCode')) || '').toUpperCase().split('').filter(net.validChar).join('').slice(0, 4);
    if (code) { n.code = code; joinRoom(); }
  }
}
// voltar: da sala pra escolha de criar/entrar, da escolha pro menu
function onlineBack() {
  leaveOnline();
  if (ui.net.role) openOnline(); else ui.screen = 'menu';
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

const ACT = { train, turret: buyTurret, slot: buySlot, sell: sellTurret, evolve, special };
// no online o clique vira comando pros dois computadores; sozinho vale na hora
function act(name, arg) {
  if (match) { match.act(name, arg); return true; }
  return ACT[name](g, 0, arg);
}
const pick = (i) => { if (act(ui.towers ? 'turret' : 'train', i)) audio.play('click'); };
const toggleTowers = () => { ui.towers = !ui.towers; ui.selling = false; };

// vaga de torre do jogador embaixo do ponto (x,y da tela), ou -1
function slotAt(x, y) {
  const side = g.sides[ui.me], b = side.base, fx = b.x + side.dir * (b.w / 2 + 4), wx = x + ui.cam; // torre fica em cima da plataforma
  if (Math.abs(wx - fx) > TURRET_W / 2 + 4) return -1;
  for (let i = 0; i < side.slots.length; i++) if (y >= slotY(i) - 2 && y < slotY(i) + TURRET_H + 2) return i;
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
  if (!g && ui.screen === 'online') return onlineClick(x, y);
  if (!g) {
    const i = MENU_BTNS.findIndex((b) => inside(b, x, y));
    if (i >= 0) start(i);
    else if (inside(LANG_BTN, x, y)) toggleLang();
    else if (inside(MODE_BTN, x, y)) toggleMode();
    else if (inside(ACH_BTN, x, y)) ui.screen = 'ach';
    else if (inside(ONLINE_BTN, x, y)) openOnline();
    return;
  }
  if (g.winner >= 0 || ui.netEnd) return backToMenu();
  if (ui.paused) return;
  if (inside(TOGGLE_BTN, x, y)) return toggleTowers();
  if (inside(SPECIAL_BTN, x, y)) return act('special');
  if (inside(EVOLVE_BTN, x, y)) return act('evolve');
  const i = BUTTONS.findIndex((b) => inside(b, x, y));
  if (i >= 0) return pick(i);
  if (ui.towers && inside(SLOT_BTN, x, y)) { if (act('slot')) audio.play('click'); return; }
  if (ui.towers && inside(SELL_BTN, x, y)) { ui.selling = !ui.selling; return; }
  if (ui.selling) {
    const k = slotAt(x, y);
    if (k >= 0) act('sell', k);
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
  if (!g && ui.screen === 'online') return onlineKey(e); // antes dos atalhos, senão digitar M muta o som
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
    else if (e.code === 'KeyO') openOnline();
    return;
  }
  if (g.winner >= 0 || ui.netEnd) { if (e.code === 'Enter') backToMenu(); return; }
  if (!match && (e.code === 'KeyP' || (e.code === 'Escape' && !ui.selling))) { ui.paused = !ui.paused; return; } // online não pausa
  if (ui.paused) return;
  if (e.code === 'Space') { act('special'); e.preventDefault(); }
  else if (e.code === 'KeyE') act('evolve');
  else if (e.code === 'KeyT') toggleTowers();
  else if (e.code === 'Escape') ui.selling = false;
  else if (ui.towers && n === 3) { if (act('slot')) audio.play('click'); }
  else if (n >= 0 && n < 4) pick(n);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => { if (document.hidden && g && !match && g.winner < 0) ui.paused = true; });

function moveCam(dt) {
  let v = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) v--;
  if (keys.has('ArrowRight') || keys.has('KeyD')) v++;
  if (dragX === null && mouseX >= 0 && mouseY > HUD_H) {
    if (mouseX < 24) v--;
    else if (mouseX > W - 24) v++;
  }
  ui.cam += v * 400 * dt;
}

// Lógica em passo fixo de 60 Hz, render a cada frame do monitor.
const STEP = 1 / 60;
let acc = 0, last = performance.now(), frames = 0, fpsT = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  if (g && !ui.paused) {
    moveCam(dt);
    if (match) netFrame(dt);
    else {
      acc += dt;
      while (acc >= STEP) { update(g, STEP); acc -= STEP; }
    }
    for (let i = 0; i < g.fx.length; i += 4) { // nome, x, y, direção
      const name = g.fx[i];
      audio.play(name === 'tshoot' ? 'shoot' : name);
      effect(name, g.fx[i + 1], g.fx[i + 2], g.fx[i + 3]);
    }
    g.fx.length = 0;
    if (!match) achCheck();
    if (g.winner >= 0 && !ui.saved) {
      if (match) { ui.saved = true; audio.play(g.winner === ui.me ? 'win' : 'lose'); } else saveResult();
    }
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
  else if (ui.screen === 'online') drawOnline(ctx, ui);
  else drawMenu(ctx, ui);
  requestAnimationFrame(frame);
}
await ready; // só começa com a arte carregada
requestAnimationFrame(frame);
