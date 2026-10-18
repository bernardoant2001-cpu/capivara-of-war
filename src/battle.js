// Lógica pura do jogo (sem DOM), roda no navegador e no node (test.js).
import {
  WORLD, GROUND, DEPTH, BASE_W, SPACING, HOLD_DIST, QUEUE_MAX, MAX_UNITS, START_GOLD,
  INCOME, KILL_GOLD, KILL_XP, BASE_XP, SHOT_SPEED, XP_TO_EVOLVE, SPECIAL_CD, DROP_FALL,
  MAX_SLOTS, SLOT_COSTS, SELL_REFUND, slotY, DIFFICULTIES, ERAS, SECRET_ERA,
} from './data.js';

export const WALK = 0, ATTACK = 1, IDLE = 2;

// evento pra som e efeito visual: nome, x, y e direção de quem causou (4 valores seguidos, sem criar objeto)
const fx = (g, name, x, y, dir) => g.fx.push(name, x, y, dir);

function makeSide(dir, mult) {
  const x = dir > 0 ? BASE_W / 2 : WORLD - BASE_W / 2, hp = ERAS[0].baseHp;
  return {
    dir, mult, era: 0, gold: START_GOLD, xp: 0, kills: 0,
    units: [], queue: [], trainT: 0, slots: [null], specialT: SPECIAL_CD,
    base: { x, w: BASE_W, hp, maxHp: hp, hitT: 0 },
  };
}

// sides[0] = jogador (anda pra direita), sides[1] = IA.
// mode: 'classic' (derrubar a base inimiga) ou 'endless' (aguentar ondas; a base inimiga não cai)
export function newGame(diff = 1, ai = true, mode = 'classic') {
  return {
    sides: [makeSide(1, 1), makeSide(-1, DIFFICULTIES[diff].income)],
    shots: [], drops: [], dying: [], fx: [], winner: -1, time: 0, diff, ai, aiT: 2, mode,
    // o que o jogador fez na partida (pras conquistas)
    stats: { specials: 0, turrets: 0, maxTurrets: 0, maxUnits: 0, suprema: 0 },
    // modo infinito
    wave: 0, waveT: 8, waveOn: false, pending: [], bannerT: 0, bannerDone: false, bonus: 0,
  };
}

// Distância da frente de `a` até a borda mais próxima de `b`, olhando na direção `dir`.
const gap = (a, b, dir) => dir * ((b.x - dir * b.w / 2) - (a.x + dir * a.w / 2));

export function train(g, s, i) {
  const side = g.sides[s], def = ERAS[side.era].units[i];
  if (g.winner >= 0 || !def || side.gold < def.cost || side.queue.length >= QUEUE_MAX) return false;
  side.gold -= def.cost;
  if (side.queue.length === 0) side.trainT = def.train;
  side.queue.push(def);
  if (s === 0 && def.type === 3) g.stats.suprema++;
  return true;
}

export function buyTurret(g, s, i) {
  const side = g.sides[s], def = ERAS[side.era].turrets[i], k = side.slots.indexOf(null);
  if (g.winner >= 0 || !def || k < 0 || side.gold < def.cost) return false;
  side.gold -= def.cost;
  side.slots[k] = { def, cd: 0 };
  if (s === 0) {
    g.stats.turrets++;
    g.stats.maxTurrets = Math.max(g.stats.maxTurrets, side.slots.filter(Boolean).length);
  }
  return true;
}

export function buySlot(g, s) {
  const side = g.sides[s], cost = SLOT_COSTS[side.slots.length - 1];
  if (g.winner >= 0 || side.slots.length >= MAX_SLOTS || side.gold < cost) return false;
  side.gold -= cost;
  side.slots.push(null);
  return true;
}

export function sellTurret(g, s, i) {
  const side = g.sides[s], t = side.slots[i];
  if (g.winner >= 0 || !t) return false;
  side.gold += t.def.cost * SELL_REFUND;
  side.slots[i] = null;
  return true;
}

export const canEvolve = (side) => side.era < ERAS.length - 1 && side.xp >= XP_TO_EVOLVE[side.era];

// A IA evolui por tempo (force), o jogador por XP.
export function evolve(g, s, force = false) {
  const side = g.sides[s];
  if (g.winner >= 0 || side.era >= ERAS.length - 1 || (!force && !canEvolve(side))) return false;
  if (s === 1 && side.era + 1 === SECRET_ERA && g.sides[0].era < SECRET_ERA) return false; // a IA só vai pra era secreta depois do jogador
  side.era++;
  fx(g, 'evolve', side.base.x, GROUND - 40, side.dir);
  const b = side.base, hp = ERAS[side.era].baseHp;
  b.hp += hp - b.maxHp;
  b.maxHp = hp;
  return true;
}

// Chuva do especial: a maioria mira num inimigo (com desvio), o resto cai em qualquer lugar do campo.
export function special(g, s) {
  const side = g.sides[s], sp = ERAS[side.era].special, foes = g.sides[1 - s].units;
  if (g.winner >= 0 || side.specialT > 0) return false;
  side.specialT = SPECIAL_CD;
  if (s === 0) g.stats.specials++;
  fx(g, 'special', 0, 0, side.dir);
  const lo = WORLD * 0.2, hi = WORLD - BASE_W;
  for (let i = 0; i < sp.count; i++) {
    const r = lo + Math.random() * (hi - lo);
    const u = foes.length && Math.random() < 0.75 ? foes[Math.floor(Math.random() * foes.length)] : null;
    g.drops.push({
      s, u, off: (Math.random() - 0.5) * 48, x: side.dir > 0 ? r : WORLD - r,
      t: DROP_FALL + i * 0.12, dmg: sp.dmg, r: sp.radius, era: side.era, done: false,
    });
  }
  return true;
}

// TODO: usar pool de objetos se o spawn começar a pesar
function trySpawn(side, def) {
  const b = side.base, d = side.dir;
  const x = b.x + d * (b.w / 2 + def.w / 2);
  if (side.units.length >= MAX_UNITS) return false;
  for (let i = 0; i < side.units.length; i++) {
    const o = side.units[i];
    if (Math.abs(o.x - x) < (o.w + def.w) / 2 + SPACING) return false; // porta da base ocupada
  }
  side.units.push({
    def, x, w: def.w, hp: def.hp, cd: def.cd / 2, hitT: 0, state: WALK,
    // cada um para num ponto diferente dentro do alcance, pra virar bolo e não fila
    reach: def.range - Math.random() * Math.min(def.range * 0.8, 30),
    lag: 12 + Math.random() * 30, // quanto o de distância fica atrás do corpo a corpo
    z: Math.floor(Math.random() * 9), // profundidade no chão (só visual)
  });
  return true;
}

// Unidade inimiga mais avançada (a mais perto de mim), ou a base se não tiver ninguém.
function front(side) {
  let best = side.base;
  for (let i = 0; i < side.units.length; i++) {
    const u = side.units[i];
    if (u.hp > 0 && (best === side.base || side.dir * (u.x - best.x) > 0)) best = u;
  }
  return best;
}

// era = de que era é a arma (só muda o desenho do projétil)
function fire(g, s, x, y0, t, dmg, splash, era, turret = false) {
  g.shots.push({ s, x, x0: x, y0, t, dmg, splash, era, done: false });
  fx(g, turret ? 'tshoot' : 'shoot', x, y0, g.sides[s].dir);
}

function hurt(g, s, t, dmg) {
  if (t.hp <= 0) return;
  t.hp -= dmg;
  t.hitT = 0.1;
  const me = g.sides[s];
  if (t.def) {
    if (t.hp <= 0) {
      me.gold += t.def.cost * KILL_GOLD * me.mult;
      me.xp += t.def.cost * KILL_XP;
      me.kills++;
      fx(g, 'die', t.x, GROUND + t.z * DEPTH, me.dir);
    } else fx(g, 'hit', t.x, GROUND + t.z * DEPTH - t.def.h * 0.6, me.dir);
  } else {
    me.xp += dmg * BASE_XP;
    fx(g, 'hit', t.x - me.dir * t.w / 2, GROUND - 25, me.dir);
    if (g.mode === 'endless' && s === 0) t.hp = t.maxHp; // no infinito a base inimiga não cai
    if (t.hp <= 0) g.winner = s;
  }
}

// Acerto normal ou em área (área só pega unidade; se o alvo for a base, bate nela).
function strike(g, s, t, dmg, splash) {
  if (!splash || !t.def) return hurt(g, s, t, dmg);
  fx(g, 'boom', t.x, GROUND + 4, g.sides[s].dir);
  const x = t.x, us = g.sides[1 - s].units;
  for (let j = 0; j < us.length; j++) if (Math.abs(us[j].x - x) <= splash) hurt(g, s, us[j], dmg);
}

// Remove mortos sem alocar e sem bagunçar a ordem.
function compact(a, keep) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (keep(a[i])) a[n++] = a[i];
  a.length = n;
}
const alive = (o) => o.hp > 0;
const pending = (o) => !o.done;
export const DYING_TIME = 1.8;
const asleep = (o) => o.deadT < DYING_TIME;

function ai(g, dt) {
  const me = g.sides[1], foe = g.sides[0], diff = DIFFICULTIES[g.diff];
  // evolui por XP igual o jogador, ou por tempo se ficar pra trás
  if (canEvolve(me) || g.time >= diff.evolveEvery * (me.era + 1)) evolve(g, 1, true);

  if (me.specialT <= 0) {
    let n = 0;
    for (const u of foe.units) if (u.x > WORLD / 2) n++;
    if (n >= 5) special(g, 1);
  }

  if ((g.aiT -= dt) > 0) return;
  g.aiT = 0.6 + Math.random() * 1.2;

  // depois de 1 min, troca a torre por uma melhor quando sobra dinheiro
  if (g.time > 60) {
    const cur = me.slots[0], turrets = ERAS[me.era].turrets;
    for (let t = turrets.length - 1; t >= 0 && (!cur || turrets[t].cost > cur.def.cost); t--) {
      if (me.gold < turrets[t].cost + 100) continue;
      if (cur) sellTurret(g, 1, 0);
      buyTurret(g, 1, t);
      return;
    }
  }

  if (me.units.length + me.queue.length >= diff.maxUnits) return;
  const r = Math.random();
  if (r < 0.05 && train(g, 1, 3)) return; // Suprema, se estiver na era 5 e tiver ouro
  // pesos 50/35/15; se não der pra pagar o sorteado, tenta um mais barato
  for (let i = r < 0.5 ? 0 : r < 0.85 ? 1 : 2; i >= 0; i--) if (train(g, 1, i)) return;
}

// Modo infinito: ondas cada vez maiores e mais fortes; a cada 4 ondas o inimigo sobe de era.
export function waveUnits(g, wave) {
  const foe = g.sides[1], mult = DIFFICULTIES[g.diff].income;
  const units = ERAS[foe.era].units, m = 1 + 0.05 * (wave - 1) * mult; // vida e dano crescem a cada onda
  const count = Math.min(30, Math.round((3 + wave * 1.2) * Math.sqrt(mult)));
  const list = [];
  const pick = (i) => {
    const d = units[i];
    list.push({ ...d, hp: Math.round(d.hp * m), dmg: d.dmg * m, train: 0.6 });
  };
  for (let n = 0; n < count; n++) {
    const r = Math.random() * 100, heavy = 15 + wave;
    pick(r < heavy ? 2 : r < heavy + 30 ? 1 : 0);
  }
  if (wave % 5 === 0) { // onda de chefe
    for (let n = 0; n < 1 + wave / 5; n++) pick(2);
    if (units[3]) pick(3);
  }
  return list;
}

function waves(g, dt) {
  const foe = g.sides[1], me = g.sides[0];
  if (g.bannerT > 0) g.bannerT -= dt;
  if (g.waveOn) {
    if (g.pending.length && foe.queue.length < 2) {
      if (!foe.queue.length) foe.trainT = 0.6;
      foe.queue.push(g.pending.shift());
    }
    if (g.pending.length || foe.queue.length || foe.units.length) return;
    g.waveOn = false; // onda vencida: bônus e pausa
    g.waveT = 10;
    g.bonus = Math.round(ERAS[me.era].units[0].cost * (4 + g.wave));
    me.gold += g.bonus;
    g.bannerT = 2.5; g.bannerDone = true;
    fx(g, 'evolve', me.base.x, GROUND - 40, me.dir);
    return;
  }
  if ((g.waveT -= dt) > 0) return;
  g.wave++;
  const cap = me.era >= SECRET_ERA ? SECRET_ERA : SECRET_ERA - 1;
  while (foe.era < Math.min(cap, Math.floor((g.wave - 1) / 4))) evolve(g, 1, true);
  g.pending = waveUnits(g, g.wave);
  g.waveOn = true;
  g.bannerT = 2.5; g.bannerDone = false;
  fx(g, 'special', 0, 0, foe.dir);
}

export function update(g, dt) {
  if (g.winner >= 0) return;
  g.time += dt;
  if (g.fx.length > 800) g.fx.length = 0; // ninguém consumindo os eventos (ex.: nos testes)
  if (g.mode === 'endless') waves(g, dt);
  else if (g.ai) ai(g, dt);

  for (let s = 0; s < 2; s++) {
    const side = g.sides[s], foe = g.sides[1 - s], d = side.dir, b = side.base;
    side.gold += INCOME * 3 ** side.era * side.mult * dt;
    if (side.specialT > 0) side.specialT -= dt;
    if (b.hitT > 0) b.hitT -= dt;

    if (side.queue.length && (side.trainT -= dt) <= 0 && trySpawn(side, side.queue[0])) {
      side.queue.shift();
      if (side.queue.length) side.trainT = side.queue[0].train;
    }

    // corpo a corpo mais avançado do time: os de distância nunca passam dele
    let lead = null;
    for (let i = 0; i < side.units.length; i++) {
      const u = side.units[i];
      if (!u.def.ranged && u.hp > 0 && (!lead || d * (u.x - lead.x) > 0)) lead = u;
    }

    let target = front(foe);
    for (let i = 0; i < side.units.length; i++) {
      const u = side.units[i], def = u.def;
      if (u.hitT > 0) u.hitT -= dt;
      u.cd -= dt;
      if (target.hp <= 0) target = front(foe);

      const dist = gap(u, target, d);
      let room = dist - u.reach; // quanto ainda dá pra andar
      if (def.ranged && lead) {
        // só espera se o corpo a corpo estiver perto; longe demais, vai sozinho
        if (d * (u.x - lead.x) < HOLD_DIST) room = Math.min(room, d * (lead.x - u.x) - (lead.w + u.w) / 2 - u.lag);
      }
      const inRange = dist <= (def.ranged ? def.range : u.reach) + 0.01; // folga pro float

      if (room > 0.01) { u.x += d * Math.min(def.speed * dt, room); u.state = WALK; }
      else u.state = inRange ? ATTACK : IDLE;

      if (inRange && u.cd <= 0) {
        u.cd = def.cd;
        if (def.ranged) fire(g, s, u.x, GROUND - def.h * 0.6 + u.z * DEPTH, target, def.dmg, def.splash || 0, def.era);
        else strike(g, s, target, def.dmg, def.splash || 0);
      }
    }

    // torres só atiram em unidade, nunca na base
    target = front(foe);
    for (let i = 0; i < side.slots.length; i++) {
      const t = side.slots[i];
      if (!t) continue;
      t.cd -= dt;
      if (t.cd <= 0 && target.def && gap(b, target, d) <= t.def.range) {
        t.cd = t.def.cd;
        fire(g, s, b.x + d * (b.w / 2 + 10), slotY(i) + 4, target, t.def.dmg, t.def.splash || 0, t.def.era, true);
      }
    }
  }

  for (let i = 0; i < g.shots.length; i++) {
    const p = g.shots[i];
    if (p.t.hp <= 0) { p.done = true; continue; } // alvo já caiu: tiro some
    const dx = p.t.x - p.x, step = SHOT_SPEED * dt;
    if (Math.abs(dx) > step) { p.x += Math.sign(dx) * step; continue; }
    p.done = true;
    strike(g, p.s, p.t, p.dmg, p.splash);
  }

  for (let i = 0; i < g.drops.length; i++) {
    const p = g.drops[i];
    p.t -= dt;
    if (p.u && p.t <= DROP_FALL) { p.x = p.u.x + p.off; p.u = null; } // mira quando começa a cair
    if (p.t > 0) continue;
    p.done = true;
    fx(g, 'thud', p.x, GROUND + 4, 0);
    const us = g.sides[1 - p.s].units;
    for (let j = 0; j < us.length; j++) if (Math.abs(us[j].x - p.x) <= p.r) hurt(g, p.s, us[j], p.dmg);
  }

  compact(g.shots, pending);
  compact(g.drops, pending);
  // quem caiu fica um pouquinho deitado dormindo antes de sumir (só visual)
  for (let s = 0; s < 2; s++) {
    const us = g.sides[s].units;
    for (let i = 0; i < us.length; i++) if (us[i].hp <= 0) { us[i].s = s; us[i].deadT = 0; g.dying.push(us[i]); }
  }
  for (let i = 0; i < g.dying.length; i++) g.dying[i].deadT += dt;
  compact(g.dying, asleep);
  compact(g.sides[0].units, alive);
  compact(g.sides[1].units, alive);
  if (g.sides[0].units.length > g.stats.maxUnits) g.stats.maxUnits = g.sides[0].units.length;
}
