import { W, H, RES, WORLD, HUD_H, TURRET_W, TURRET_H, ERAS, slotY } from './data.js';
import { newGame, update, train, buyTurret, buySlot, sellTurret, evolve, special, why } from './battle.js';
import {
  draw, drawMenu, drawLangPick, drawAchievements, drawOnline, ready, effect, LANG_BTN, LANG_PICK, MODE_BTN, ACH_BTN, BACK_BTN, ONLINE_BTN, CODE_BOX,
  BUTTONS, SLOT_BTN, SELL_BTN, TOGGLE_BTN, SPECIAL_BTN, EVOLVE_BTN, MENU_BTNS,
  NICK_BTN, RULE_BTNS, START_BTN, EMO_BTNS, REMATCH_BTN, END_MENU_BTN, SUDDEN, PAUSE_BTN, SPEED_BTN, MINIMAP, pauseBtns, minimapToWorld,
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
  net: null, netEnd: null, waiting: false, nick: '', rival: '', ping: null,
  emotes: [], emoCd: 0, rematch: { me: false, them: false }, oppGone: false, count: 0,
  speed: 1, deny: null, pauseItems: [], camTo: null,
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
  Object.assign(ui, { cam: 0, camTo: null, me: 0, paused: false, towers: false, selling: false, newRecord: false, saved: false, deny: null });
}

// ---------- online ----------
const NICK_KEY = 'capivara-of-war:apelido';
let match = null, link = null, session = null, lastMsg = 0, stallT = 0, gen = 0;

// tudo que vem do outro lado passa por aqui antes de ser usado
const cleanNick = (v) => String(v ?? '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 12) || '???';
const cleanRules = (r) => ({
  era: Math.max(0, Math.min(ERAS.length - 2, Math.floor(+r?.era) || 0)),
  fast: r?.fast === true,
  sudden: SUDDEN.includes(r?.sudden) ? r.sudden : 0,
});
const nickOk = (c) => c.length === 1 && /[\p{L}\p{N} _.-]/u.test(c);

let savedNick = '';
try { savedNick = localStorage.getItem(NICK_KEY) || ''; } catch {}
ui.nick = savedNick ? cleanNick(savedNick) : `Capivara${Math.floor(Math.random() * 90 + 10)}`;
const saveNick = () => { ui.nick = cleanNick(ui.nick); try { localStorage.setItem(NICK_KEY, ui.nick); } catch {} };

function openOnline(status = null) {
  ui.screen = 'online';
  ui.net = { role: null, phase: 'room', code: '', status, error: !!status, busy: false, editing: null, rules: ui.net?.rules || cleanRules() };
}
function leaveOnline() {
  const l = link, s = session;
  match = link = session = null; // antes de fechar, pra queda da conexão não virar aviso
  l?.close(); s?.close();
  Object.assign(ui, { me: 0, netEnd: null, waiting: false, ping: null, emotes: [] });
}

// respostas do net.js; só valem enquanto a tela continua sendo a mesma tentativa
const events = (n) => ({
  status: (k) => { if (ui.net === n) Object.assign(n, { status: k, error: false }); },
  error: (k) => { if (ui.net === n && !link) Object.assign(n, { status: k, error: true, busy: false }); },
  ready: (l) => (ui.net === n && !link ? connected(l) : l.close()),
});

async function connect(n, fn) {
  session?.close();
  Object.assign(n, { status: 'loading', error: false, busy: true });
  const s = await fn(n.code, events(n));
  if (ui.net === n && !link) session = s; else s?.close();
}
const createRoom = () => { saveNick(); ui.net.editing = null; ui.net.role = 'host'; ui.net.code = net.newCode(); connect(ui.net, net.host); };
const joinRoom = () => { if (ui.net.code.length === 4 && !ui.net.busy) connect(ui.net, net.join); };
const pickJoin = () => { saveNick(); ui.net.editing = null; ui.net.role = 'join'; };

// os dois se acharam: vão pro saguão, trocam apelidos e o anfitrião manda as regras
function connected(l) {
  link = l; session = null; // fechar o link fecha o peer junto
  lastMsg = performance.now();
  Object.assign(ui.net, { phase: 'lobby', status: null, error: false, busy: false });
  ui.rival = '...';
  l.onClose(() => netDown('oppLeft'));
  l.onData(onMsg);
  l.send({ hi: ui.nick });
  if (ui.net.role === 'host') l.send({ rules: ui.net.rules });
}

function onMsg(msg) {
  if (!msg || typeof msg !== 'object') return;
  lastMsg = performance.now();
  if ('c' in msg) { if (match && msg.gen === gen && Array.isArray(msg.c)) match.receive(msg); return; } // de partida velha: ignora
  if ('hi' in msg) ui.rival = cleanNick(msg.hi);
  else if (msg.hello && ui.net.role === 'join') startOnline(msg.gen, msg.seed, msg.rules); // vem com as regras junto
  else if (msg.rules && ui.net.role === 'join') ui.net.rules = cleanRules(msg.rules);
  else if ('emo' in msg) showEmote(1 - ui.me, msg.emo);
  else if (msg.ping) link?.send({ pong: msg.ping });
  else if (msg.pong) ui.ping = performance.now() - msg.pong;
  else if (msg.rematch) { ui.rematch.them = true; checkRematch(); }
}

// anfitrião começa: nova semente, e a mesma mensagem liga a partida nos dois
function begin() {
  if (ui.net.role !== 'host' || ui.net.phase !== 'lobby' || !link) return;
  const seed = (Math.random() * 2 ** 32) >>> 0;
  gen++;
  link.send({ hello: 1, gen, seed, rules: ui.net.rules });
  startOnline(gen, seed, ui.net.rules);
}

function startOnline(n, seed, rules) {
  gen = n;
  const me = ui.net.role === 'host' ? 0 : 1, r = cleanRules(rules);
  ui.net.rules = r;
  match = createMatch(seed >>> 0, me, (m) => link?.send({ ...m, gen: n }), r);
  g = match.g;
  stallT = 0;
  Object.assign(ui, {
    cam: me ? WORLD - W : 0, me, paused: false, towers: false, selling: false, newRecord: false, saved: false,
    netEnd: null, waiting: false, emotes: [], emoCd: 0, rematch: { me: false, them: false }, oppGone: false, count: 0,
  });
}

// queda: no meio da partida encerra, no fim só avisa, no saguão volta pra tela do online
function netDown(key) {
  if (!link) return;
  if (match && g && g.winner < 0) { if (!ui.netEnd) ui.netEnd = key; return; }
  if (match && g) { ui.oppGone = true; return; }
  leaveOnline();
  openOnline('friendLeft');
}
const backToMenu = () => { g = null; leaveOnline(); };

// revanche: quando os dois pedem, voltam pro saguão (o anfitrião pode mudar as regras)
function askRematch() {
  if (ui.oppGone || ui.rematch.me) return;
  ui.rematch.me = true;
  link?.send({ rematch: 1 });
  audio.play('click');
  checkRematch();
}
function checkRematch() {
  if (!ui.rematch.me || !ui.rematch.them) return;
  match = null; g = null;
  ui.screen = 'online';
  Object.assign(ui.net, { phase: 'lobby', status: null, error: false });
  Object.assign(ui, { netEnd: null, waiting: false, emotes: [] });
}

// emotes: não passam pelo lockstep (não mexem na partida), vão direto
function showEmote(side, i) {
  if (!Number.isInteger(i) || i < 0 || i > 5) return;
  ui.emotes = ui.emotes.filter((e) => e.side !== side);
  ui.emotes.push({ side, i, t: 2.5 });
  audio.play('click');
}
function sendEmote(i) {
  if (ui.emoCd > 0 || !link || g.winner >= 0 || ui.netEnd) return;
  ui.emoCd = 1.2; // sem metralhar emote
  link.send({ emo: i });
  showEmote(ui.me, i);
}

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
  ui.waiting = stallT > 0.5 && g.countdown <= 0;
  // bipe a cada número da contagem e no LUTA
  const c = g.countdown > 0 ? Math.ceil(g.countdown) : 0;
  if (c !== ui.count) { audio.play(c ? 'click' : 'evolve'); ui.count = c; }
}
// a cada segundo: mede o atraso e, com a aba escondida (sem quadros), continua avisando que está vivo
setInterval(() => {
  if (!link) return;
  link.send({ ping: performance.now() });
  match?.flush();
  if (!match && performance.now() - lastMsg > 10000) netDown('oppLeft');
}, 1000);

function cycleRule(i) {
  const r = ui.net.rules;
  if (ui.net.role !== 'host') return;
  if (i === 0) r.era = (r.era + 1) % (ERAS.length - 1); // a era secreta não entra
  else if (i === 1) r.fast = !r.fast;
  else r.sudden = SUDDEN[(SUDDEN.indexOf(r.sudden) + 1) % SUDDEN.length];
  link?.send({ rules: r });
  audio.play('click');
}

function onlineKey(e) {
  const n = ui.net;
  if (n.editing === 'nick') {
    if (e.code === 'Enter' || e.code === 'Escape' || e.code === 'Tab') { n.editing = null; saveNick(); e.preventDefault(); }
    else if (e.code === 'Backspace') ui.nick = ui.nick.slice(0, -1);
    else if (nickOk(e.key) && ui.nick.length < 12) ui.nick += e.key;
    return;
  }
  if (e.code === 'Escape') return onlineBack();
  if (!n.role) {
    if (e.code === 'Digit1') createRoom();
    else if (e.code === 'Digit2') pickJoin();
    else if (e.code === 'Tab') { n.editing = 'nick'; e.preventDefault(); }
    return;
  }
  if (n.role === 'host') {
    const k = e.code.startsWith('Digit') ? +e.code.at(-1) - 1 : -1;
    if (k >= 0 && k < 3) cycleRule(k);
    else if (e.code === 'Enter') begin();
    return;
  }
  if (n.phase === 'lobby' || n.busy) return;
  if (e.code === 'Enter') joinRoom();
  else if (e.code === 'Backspace') n.code = n.code.slice(0, -1);
  else if (e.key.length === 1 && net.validChar(e.key.toUpperCase()) && n.code.length < 4) n.code += e.key.toUpperCase();
}
function onlineClick(x, y, touch) {
  const n = ui.net;
  if (inside(BACK_BTN, x, y)) return onlineBack();
  if (!n.role) {
    if (inside(NICK_BTN, x, y)) {
      if (touch) { const v = prompt(t('nick'), ui.nick); if (v != null) { ui.nick = v; saveNick(); } } // celular não tem teclado na tela do jogo
      else n.editing = n.editing ? null : 'nick';
      return;
    }
    if (n.editing) { n.editing = null; saveNick(); }
    const k = LANG_PICK.findIndex((b) => inside(b, x, y));
    if (k === 0) createRoom(); else if (k === 1) pickJoin();
    return;
  }
  if (n.role === 'host') {
    const k = RULE_BTNS.findIndex((b) => inside(b, x, y));
    if (k >= 0) cycleRule(k);
    else if (inside(START_BTN, x, y)) begin();
  } else if (n.phase !== 'lobby' && !n.busy && inside(CODE_BOX, x, y) && touch) {
    const code = (prompt(t('typeCode')) || '').toUpperCase().split('').filter(net.validChar).join('').slice(0, 4);
    if (code) { n.code = code; joinRoom(); }
  }
}
// voltar: da sala pra escolha de criar/entrar, da escolha pro menu
function onlineBack() {
  const had = ui.net.role;
  leaveOnline();
  if (had) openOnline(); else ui.screen = 'menu';
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
const BTN_OF = { special: SPECIAL_BTN, evolve: EVOLVE_BTN, slot: SLOT_BTN };
// o aviso que aparece embaixo do botão quando não dá
const DENY_TEXT = { gold: 'noGold', wait: 'recharging', xp: 'needXp' };
const denyText = (name, r) => (r === 'full' ? (name === 'train' ? 'queueFull' : name === 'turret' ? 'noSlot' : 'slotsFull') : DENY_TEXT[r]);

// no online o clique vira comando pros dois computadores; sozinho vale na hora.
// Se não dá (sem ouro, fila cheia...), o botão balança e aparece o motivo.
function act(name, arg, btn = BTN_OF[name]) {
  const r = why(g, ui.me, name, arg);
  if (r) {
    if (btn && r !== 'none' && r !== 'over') { ui.deny = { b: btn, r, key: denyText(name, r), t: 0.35 }; audio.play('deny'); }
    return false;
  }
  if (match) match.act(name, arg); else ACT[name](g, 0, arg);
  return true;
}
const pick = (i) => { if (act(ui.towers ? 'turret' : 'train', i, BUTTONS[i])) audio.play('click'); };
const toggleTowers = () => { ui.towers = !ui.towers; ui.selling = false; };
const toggleSpeed = () => { ui.speed = ui.speed === 1 ? 2 : 1; audio.play('click'); };

// vaga de torre do jogador embaixo do ponto (x,y da tela), ou -1
function slotAt(x, y) {
  const side = g.sides[ui.me], b = side.base, fx = b.x + side.dir * (b.w / 2 + 4), wx = x + ui.cam; // torre fica em cima da plataforma
  if (Math.abs(wx - fx) > TURRET_W / 2 + 4) return -1;
  for (let i = 0; i < side.slots.length; i++) if (y >= slotY(i) - 2 && y < slotY(i) + TURRET_H + 2) return i;
  return -1;
}

// câmera: pular pra própria base ou pra linha de frente (desliza até lá)
function camToBase() { ui.camTo = ui.me ? WORLD - W : 0; }
function camToFront() {
  const side = g.sides[ui.me], d = side.dir;
  let x = side.base.x;
  for (const u of side.units) if (d * (u.x - x) > 0) x = u.x;
  ui.camTo = x - W / 2 + d * 80;
}
const camToMini = (x) => { ui.camTo = null; ui.cam = minimapToWorld(x) - W / 2; };

// pausa: no online a partida não para, vira só um menu por cima
function openPause() {
  const full = document.fullscreenEnabled && !document.fullscreenElement && matchMedia('(pointer: coarse)').matches;
  ui.pauseItems = [...(match ? ['resume'] : ['resume', 'restart']), 'sound', ...(full ? ['full'] : []), 'quit'];
  ui.paused = true; ui.selling = false;
}
function pauseAction(k) {
  audio.play('click');
  if (k === 'resume') ui.paused = false;
  else if (k === 'restart') { ui.mode = g.mode; start(g.diff); }
  else if (k === 'sound') ui.muted = audio.toggleMute();
  else if (k === 'full') { goFull(); ui.paused = false; }
  else if (k === 'quit') leaveGame();
}
function leaveGame() {
  if (match) return backToMenu();
  if (!ui.saved) { ui.kills += g.sides[0].kills; achSave(); } // os abates contam pras conquistas mesmo saindo no meio
  g = null;
}

// tela cheia e deitado, no celular (o navegador só deixa depois de um toque)
let triedFull = false;
function goFull() {
  triedFull = true;
  document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
}

// clique nos botões do painel; devolve true se pegou em algum
function hudClick(x, y) {
  if (inside(TOGGLE_BTN, x, y)) { toggleTowers(); return true; }
  if (inside(SPECIAL_BTN, x, y)) { act('special'); return true; }
  if (inside(EVOLVE_BTN, x, y)) { act('evolve'); return true; }
  const i = BUTTONS.findIndex((b) => inside(b, x, y));
  if (i >= 0) { pick(i); return true; }
  if (ui.towers && inside(SLOT_BTN, x, y)) { if (act('slot')) audio.play('click'); return true; }
  if (ui.towers && inside(SELL_BTN, x, y)) { ui.selling = !ui.selling; return true; }
  return false;
}

let held = null, miniDrag = false; // dedo segurando um botão (mostra o balão); arrastando no minimapa
canvas.addEventListener('pointerdown', (e) => {
  audio.init();
  const [x, y] = toGame(e), touch = e.pointerType === 'touch';
  if (touch && !triedFull) goFull();
  if (!g && ui.screen === 'lang') {
    const k = LANG_PICK.findIndex((b) => inside(b, x, y));
    if (k >= 0) { setLang(k ? 'en' : 'pt'); ui.screen = 'menu'; }
    return;
  }
  if (!g && ui.screen === 'ach') { if (inside(BACK_BTN, x, y)) ui.screen = 'menu'; return; }
  if (!g && ui.screen === 'online') return onlineClick(x, y, touch);
  if (!g) {
    const i = MENU_BTNS.findIndex((b) => inside(b, x, y));
    if (i >= 0) start(i);
    else if (inside(LANG_BTN, x, y)) toggleLang();
    else if (inside(MODE_BTN, x, y)) toggleMode();
    else if (inside(ACH_BTN, x, y)) ui.screen = 'ach';
    else if (inside(ONLINE_BTN, x, y)) openOnline();
    return;
  }
  if (match && g.winner >= 0 && !ui.netEnd) { // resumo do online: revanche ou menu
    if (inside(REMATCH_BTN, x, y)) askRematch();
    else if (inside(END_MENU_BTN, x, y)) backToMenu();
    return;
  }
  if (g.winner >= 0 || ui.netEnd) return backToMenu();
  if (ui.paused) {
    const k = pauseBtns(ui.pauseItems.length).findIndex((b) => inside(b, x, y));
    if (k >= 0) pauseAction(ui.pauseItems[k]);
    return;
  }
  if (inside(PAUSE_BTN, x, y)) return openPause();
  if (!match && inside(SPEED_BTN, x, y)) return toggleSpeed();
  if (inside(MINIMAP, x, y)) { miniDrag = true; camToMini(x); canvas.setPointerCapture(e.pointerId); return; }
  if (match) { const k = EMO_BTNS.findIndex((b) => inside(b, x, y)); if (k >= 0) return sendEmote(k); }
  if (touch && y < HUD_H) { // no celular: toque rápido usa o botão, segurar mostra o balão de informação
    held = { x, y, t: performance.now() };
    ui.mx = x; ui.my = y; ui.hover = BUTTONS.findIndex((b) => inside(b, x, y));
    return;
  }
  if (hudClick(x, y)) return;
  if (ui.selling) {
    const k = slotAt(x, y);
    if (k >= 0) act('sell', k);
    ui.selling = false;
    return;
  }
  if (y > HUD_H) { dragX = x; ui.camTo = null; canvas.setPointerCapture(e.pointerId); }
});
canvas.addEventListener('pointermove', (e) => {
  [mouseX, mouseY] = toGame(e);
  if (held) return; // o balão fica parado no botão enquanto o dedo segura
  ui.mx = mouseX; ui.my = mouseY;
  ui.hover = BUTTONS.findIndex((b) => inside(b, mouseX, mouseY));
  ui.hoverMenu = MENU_BTNS.findIndex((b) => inside(b, mouseX, mouseY));
  if (miniDrag) camToMini(mouseX);
  if (dragX !== null) { ui.cam -= mouseX - dragX; dragX = mouseX; }
});
canvas.addEventListener('pointerup', (e) => {
  dragX = null; miniDrag = false;
  if (held) {
    if (performance.now() - held.t < 350 && g && !ui.paused) hudClick(held.x, held.y);
    held = null;
    ui.mx = ui.my = -1; ui.hover = -1;
  }
  if (e.pointerType !== 'mouse') mouseX = -1;
});
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
  if (g.winner >= 0 || ui.netEnd) {
    if (e.code === 'Enter') backToMenu();
    else if (e.code === 'KeyR' && match && !ui.netEnd) askRematch();
    return;
  }
  if (ui.paused) {
    if (e.code === 'Escape' || e.code === 'KeyP') pauseAction('resume');
    else if (e.code === 'KeyR' && !match) pauseAction('restart');
    else if (e.code === 'KeyQ') pauseAction('quit');
    return;
  }
  if (e.code === 'KeyP' || (e.code === 'Escape' && !ui.selling)) return openPause();
  if (match && /^Digit[05-9]$/.test(e.code)) return sendEmote((+e.code.at(-1) + 5) % 10); // 5..9 -> 0..4, 0 -> 5
  if (e.code === 'Space') { act('special'); e.preventDefault(); }
  else if (e.code === 'KeyE') act('evolve');
  else if (e.code === 'KeyT') toggleTowers();
  else if (e.code === 'KeyF' && !match) toggleSpeed();
  else if (e.code === 'KeyW' || e.code === 'ArrowUp') { camToFront(); e.preventDefault(); }
  else if (e.code === 'KeyS' || e.code === 'ArrowDown') { camToBase(); e.preventDefault(); }
  else if (e.code === 'Escape') ui.selling = false;
  else if (ui.towers && n === 3) { if (act('slot')) audio.play('click'); }
  else if (n >= 0 && n < 4) pick(n);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => { if (document.hidden && g && !match && g.winner < 0 && !ui.paused) openPause(); });

function moveCam(dt) {
  let v = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) v--;
  if (keys.has('ArrowRight') || keys.has('KeyD')) v++;
  if (dragX === null && !miniDrag && mouseX >= 0 && mouseY > HUD_H) {
    if (mouseX < 24) v--;
    else if (mouseX > W - 24) v++;
  }
  if (v) ui.camTo = null; // mexeu na mão: cancela o pulo
  ui.cam += v * 400 * dt;
  if (ui.camTo != null) {
    const to = Math.max(0, Math.min(WORLD - W, ui.camTo));
    ui.cam += (to - ui.cam) * Math.min(1, dt * 8);
    if (Math.abs(to - ui.cam) < 0.5) ui.camTo = null;
  }
}

// Lógica em passo fixo de 60 Hz, render a cada frame do monitor.
const STEP = 1 / 60;
let acc = 0, last = performance.now(), frames = 0, fpsT = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  if (g && (!ui.paused || match)) { // no online o menu de pausa não para a partida
    moveCam(dt);
    if (match) netFrame(dt);
    else {
      acc += dt * ui.speed;
      while (acc >= STEP) { update(g, STEP); acc -= STEP; }
    }
    for (let i = 0; i < g.fx.length; i += 4) { // nome, x, y, direção
      const name = g.fx[i];
      audio.play(name === 'tshoot' ? 'shoot' : name === 'gold' + ui.me ? 'coin' : name);
      effect(name, g.fx[i + 1], g.fx[i + 2], g.fx[i + 3]);
    }
    g.fx.length = 0;
    if (!match) achCheck();
    if (g.winner >= 0 && !ui.saved) {
      if (match) { ui.saved = true; audio.play(g.winner === ui.me ? 'win' : 'lose'); } else saveResult();
    }
  }
  for (const tt of ui.toasts) tt.t -= dt;
  ui.emoCd -= dt;
  if (ui.deny && (ui.deny.t -= dt) <= 0) ui.deny = null;
  for (const em of ui.emotes) em.t -= dt;
  if (ui.emotes.some((em) => em.t <= 0)) ui.emotes = ui.emotes.filter((em) => em.t > 0);
  while (ui.toasts.length && ui.toasts[0].t <= 0) ui.toasts.shift();
  ui.cam = Math.max(0, Math.min(WORLD - W, ui.cam));
  frames++;
  if ((fpsT += dt) >= 1) { ui.fps = frames; frames = 0; fpsT -= 1; }
  ui.dt = g && (!ui.paused || match) ? dt : 0;
  if (g) draw(ctx, g, ui);
  else if (ui.screen === 'lang') drawLangPick(ctx, ui);
  else if (ui.screen === 'ach') drawAchievements(ctx, ui);
  else if (ui.screen === 'online') drawOnline(ctx, ui);
  else drawMenu(ctx, ui);
  requestAnimationFrame(frame);
}
await ready; // só começa com a arte carregada
requestAnimationFrame(frame);
