// Lógica pura do jogo (sem DOM), roda no navegador e no node (test.js).
import {
  WORLD, BASE_W, BASE_HP, SPACING, QUEUE_MAX, MAX_UNITS, START_GOLD,
  INCOME, KILL_GOLD, KILL_XP, BASE_XP, SHOT_SPEED, UNITS,
} from './data.js';

export const WALK = 0, IDLE = 1, ATTACK = 2;

function makeSide(dir) {
  const x = dir > 0 ? BASE_W / 2 : WORLD - BASE_W / 2;
  return {
    dir, gold: START_GOLD, xp: 0, units: [], queue: [], trainT: 0,
    base: { x, w: BASE_W, hp: BASE_HP, maxHp: BASE_HP, hitT: 0 },
  };
}

// sides[0] = jogador (anda pra direita), sides[1] = IA. units[0] é sempre o da frente.
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

// TODO: usar pool de objetos se o spawn começar a pesar
function trySpawn(side, type) {
  const def = UNITS[type], b = side.base, d = side.dir;
  const u = { type, def, x: b.x + d * (b.w / 2 + def.w / 2), w: def.w, hp: def.hp, cd: def.cd / 2, hitT: 0, state: WALK };
  const last = side.units[side.units.length - 1];
  if (side.units.length >= MAX_UNITS || (last && gap(u, last, d) < SPACING)) return false;
  side.units.push(u);
  return true;
}

function front(side) {
  for (let i = 0; i < side.units.length; i++) if (side.units[i].hp > 0) return side.units[i];
  return side.base;
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
  const r = Math.random();
  train(g, 1, r < 0.5 ? 0 : r < 0.85 ? 1 : 2); // pesos 50/35/15
}

export function update(g, dt) {
  if (g.winner >= 0) return;
  g.time += dt;
  if (g.ai) ai(g, dt);

  for (let s = 0; s < 2; s++) {
    const side = g.sides[s], foe = g.sides[1 - s], d = side.dir;
    side.gold += INCOME * dt;
    if (side.base.hitT > 0) side.base.hitT -= dt;

    if (side.queue.length && (side.trainT -= dt) <= 0 && trySpawn(side, side.queue[0])) {
      side.queue.shift();
      if (side.queue.length) side.trainT = UNITS[side.queue[0]].train;
    }

    let target = front(foe);
    for (let i = 0; i < side.units.length; i++) {
      const u = side.units[i], def = u.def;
      if (u.hitT > 0) u.hitT -= dt;
      u.cd -= dt;
      if (target.hp <= 0) target = front(foe);

      if (gap(u, target, d) <= def.range) {
        u.state = ATTACK;
        if (u.cd <= 0) {
          u.cd = def.cd;
          if (def.ranged) g.shots.push({ s, x: u.x, x0: u.x, t: target, dmg: def.dmg, done: false });
          else hurt(g, s, target, def.dmg);
        }
      } else {
        const room = i ? gap(u, side.units[i - 1], d) - SPACING : Infinity;
        const step = Math.min(def.speed * dt, room);
        if (step > 0) { u.x += d * step; u.state = WALK; } else u.state = IDLE;
      }
    }
  }

  for (let i = 0; i < g.shots.length; i++) {
    const p = g.shots[i];
    if (p.t.hp <= 0) { p.done = true; continue; } // alvo já caiu: tiro some
    const dx = p.t.x - p.x, step = SHOT_SPEED * dt;
    if (Math.abs(dx) <= step) { hurt(g, p.s, p.t, p.dmg); p.done = true; }
    else p.x += Math.sign(dx) * step;
  }

  compact(g.shots, flying);
  compact(g.sides[0].units, alive);
  compact(g.sides[1].units, alive);
}
