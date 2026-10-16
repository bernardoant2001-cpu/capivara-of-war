// Lógica pura do jogo (sem DOM), roda no navegador e no node (test.js).
import {
  WORLD, GROUND, BASE_W, BASE_HP, SPACING, QUEUE_MAX, MAX_UNITS, START_GOLD,
  INCOME, KILL_GOLD, KILL_XP, BASE_XP, SHOT_SPEED, UNITS,
  TURRETS, MAX_SLOTS, SLOT_COSTS, SELL_REFUND, slotY,
} from './data.js';

export const WALK = 0, ATTACK = 1, IDLE = 2;

function makeSide(dir) {
  const x = dir > 0 ? BASE_W / 2 : WORLD - BASE_W / 2;
  return {
    dir, gold: START_GOLD, xp: 0, units: [], queue: [], trainT: 0, slots: [null],
    base: { x, w: BASE_W, hp: BASE_HP, maxHp: BASE_HP, hitT: 0 },
  };
}

// sides[0] = jogador (anda pra direita), sides[1] = IA.
export function newGame(ai = true) {
  return { sides: [makeSide(1), makeSide(-1)], shots: [], winner: -1, time: 0, ai, aiT: 2 };
}

// Distância da frente de `a` até a borda mais próxima de `b`, olhando na direção `dir`.
const gap = (a, b, dir) => dir * ((b.x - dir * b.w / 2) - (a.x + dir * a.w / 2));

export function train(g, s, type) {
  const side = g.sides[s], def = UNITS[type];
  if (g.winner >= 0 || side.gold < def.cost || side.queue.length >= QUEUE_MAX) return false;
  side.gold -= def.cost;
  if (side.queue.length === 0) side.trainT = def.train;
  side.queue.push(type);
  return true;
}

export function buyTurret(g, s, type) {
  const side = g.sides[s], def = TURRETS[type], i = side.slots.indexOf(null);
  if (g.winner >= 0 || i < 0 || side.gold < def.cost) return false;
  side.gold -= def.cost;
  side.slots[i] = { def, cd: 0 };
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

// TODO: usar pool de objetos se o spawn começar a pesar
function trySpawn(side, type) {
  const def = UNITS[type], b = side.base, d = side.dir;
  const x = b.x + d * (b.w / 2 + def.w / 2);
  if (side.units.length >= MAX_UNITS) return false;
  for (let i = 0; i < side.units.length; i++) {
    const o = side.units[i];
    if (Math.abs(o.x - x) < (o.w + def.w) / 2 + SPACING) return false; // porta da base ocupada
  }
  side.units.push({
    type, def, x, w: def.w, hp: def.hp, cd: def.cd / 2, hitT: 0, state: WALK,
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

function fire(g, s, x, y0, t, dmg, splash) {
  g.shots.push({ s, x, x0: x, y0, t, dmg, splash, done: false });
}

function hurt(g, s, t, dmg) {
  if (t.hp <= 0) return;
  t.hp -= dmg;
  t.hitT = 0.1;
  const me = g.sides[s];
  if (t.def) {
    if (t.hp <= 0) { me.gold += t.def.cost * KILL_GOLD; me.xp += t.def.cost * KILL_XP; }
  } else {
    me.xp += dmg * BASE_XP;
    if (t.hp <= 0) g.winner = s;
  }
}

// Remove mortos sem alocar e sem bagunçar a ordem.
function compact(a, keep) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (keep(a[i])) a[n++] = a[i];
  a.length = n;
}
const alive = (o) => o.hp > 0;
const flying = (o) => !o.done;

function ai(g, dt) {
  if ((g.aiT -= dt) > 0) return;
  g.aiT = 1.5 + Math.random() * 2.5;
  const me = g.sides[1];

  // depois de 1 min, troca a torre por uma melhor quando sobra dinheiro
  if (g.time > 60) {
    const cur = me.slots[0];
    for (let t = TURRETS.length - 1; t >= 0 && (!cur || TURRETS[t].cost > cur.def.cost); t--) {
      if (me.gold < TURRETS[t].cost + 100) continue;
      if (cur) sellTurret(g, 1, 0);
      buyTurret(g, 1, t);
      return;
    }
  }

  const r = Math.random();
  train(g, 1, r < 0.5 ? 0 : r < 0.85 ? 1 : 2); // pesos 50/35/15
}

export function update(g, dt) {
  if (g.winner >= 0) return;
  g.time += dt;
  if (g.ai) ai(g, dt);

  for (let s = 0; s < 2; s++) {
    const side = g.sides[s], foe = g.sides[1 - s], d = side.dir, b = side.base;
    side.gold += INCOME * dt;
    if (b.hitT > 0) b.hitT -= dt;

    if (side.queue.length && (side.trainT -= dt) <= 0 && trySpawn(side, side.queue[0])) {
      side.queue.shift();
      if (side.queue.length) side.trainT = UNITS[side.queue[0]].train;
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
      if (def.ranged && lead) room = Math.min(room, d * (lead.x - u.x) - (lead.w + u.w) / 2 - u.lag);
      const inRange = dist <= (def.ranged ? def.range : u.reach) + 0.01; // folga pro float

      if (room > 0.01) { u.x += d * Math.min(def.speed * dt, room); u.state = WALK; }
      else u.state = inRange ? ATTACK : IDLE;

      if (inRange && u.cd <= 0) {
        u.cd = def.cd;
        if (def.ranged) fire(g, s, u.x, GROUND - def.h * 0.6 + u.z, target, def.dmg, 0);
        else hurt(g, s, target, def.dmg);
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
        fire(g, s, b.x + d * b.w / 2, slotY(i), target, t.def.dmg, t.def.splash || 0);
      }
    }
  }

  for (let i = 0; i < g.shots.length; i++) {
    const p = g.shots[i];
    if (p.t.hp <= 0) { p.done = true; continue; } // alvo já caiu: tiro some
    const dx = p.t.x - p.x, step = SHOT_SPEED * dt;
    if (Math.abs(dx) > step) { p.x += Math.sign(dx) * step; continue; }
    p.done = true;
    if (!p.splash) { hurt(g, p.s, p.t, p.dmg); continue; }
    const us = g.sides[1 - p.s].units;
    for (let j = 0; j < us.length; j++) if (Math.abs(us[j].x - p.t.x) <= p.splash) hurt(g, p.s, us[j], p.dmg);
  }

  compact(g.shots, flying);
  compact(g.sides[0].units, alive);
  compact(g.sides[1].units, alive);
}
