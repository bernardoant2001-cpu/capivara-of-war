// Online em lockstep: os dois computadores rodam a mesma simulação e trocam só os comandos.
// Cada clique vale DELAY ticks no futuro, pra dar tempo de chegar no outro lado antes de ser aplicado.
// Sem DOM e sem rede (quem manda e recebe é o net.js), então roda no node (test.js).
import { newGame, update, train, buyTurret, buySlot, sellTurret, evolve, special } from './battle.js';

export const DELAY = 6; // 100 ms
export const STEP = 1 / 60;
const HASH_EVERY = 60; // a cada 1 s os dois conferem se a partida está igual

const ACTIONS = {
  train: (g, s, i) => train(g, s, i),
  turret: (g, s, i) => buyTurret(g, s, i),
  slot: (g, s) => buySlot(g, s),
  sell: (g, s, i) => sellTurret(g, s, i),
  evolve: (g, s) => evolve(g, s),
  special: (g, s) => special(g, s),
};

// resumo da partida pra comparar os dois lados (FNV-1a sobre os números que importam)
export function stateHash(g) {
  let h = 2166136261;
  const mix = (v) => {
    const str = String(v);
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  };
  mix(g.tick); mix(g.winner); mix(g.shots.length);
  for (const side of g.sides) {
    mix(side.gold); mix(side.xp); mix(side.era); mix(side.base.hp); mix(side.queue.length);
    for (const u of side.units) { mix(u.x); mix(u.hp); }
  }
  return h >>> 0;
}

// me: 0 (quem criou a sala, Clã do Rio) ou 1 (quem entrou, Clã do Pântano)
// send(msg): manda pro outro lado; o net.js entrega o que chegar em receive(msg)
// rules: as regras que o anfitrião escolheu (ver newGame)
export const COUNTDOWN = 3;
export function createMatch(seed, me, send, rules) {
  const g = newGame(1, false, 'pvp', seed, rules);
  g.countdown = COUNTDOWN;
  const cmds = new Map(); // tick -> [[lado, ação, argumento]]
  const myHashes = new Map(), theirHashes = new Map();
  let remoteUpTo = DELAY - 1; // até que tick já temos todos os comandos do outro (antes de DELAY ninguém consegue agir)
  let outbox = [], hashOut = null;

  const add = (t, c) => { if (!cmds.has(t)) cmds.set(t, []); cmds.get(t).push(c); };
  const compare = (t) => {
    if (myHashes.has(t) && theirHashes.has(t)) {
      if (myHashes.get(t) !== theirHashes.get(t)) m.desync = true;
      myHashes.delete(t); theirHashes.delete(t);
    }
  };

  const m = {
    g, me, desync: false,
    // clique local: vira comando pros dois lados
    act(action, arg) {
      if (!ACTIONS[action] || g.winner >= 0) return;
      const t = g.tick + DELAY;
      add(t, [me, action, arg]);
      outbox.push([t, action, arg]);
    },
    // todo quadro: manda os comandos novos e até que tick o outro já pode avançar
    flush() {
      send({ t: g.tick + DELAY - 1, c: outbox, h: hashOut });
      outbox = []; hashOut = null;
    },
    receive(msg) {
      // o que vem do outro lado não é confiável: só ação conhecida, no futuro próximo, com argumento pequeno
      for (const c of msg.c) {
        const [t, a, x] = Array.isArray(c) ? c : [];
        const argOk = x === undefined || x === null || (Number.isInteger(x) && x >= 0 && x < 4);
        if (Object.hasOwn(ACTIONS, a) && Number.isInteger(t) && t >= g.tick && t <= g.tick + 600 && argOk) add(t, [1 - me, a, x]);
      }
      if (Number.isInteger(msg.t) && msg.t > remoteUpTo) remoteUpTo = msg.t;
      if (msg.h) { theirHashes.set(msg.h[0], msg.h[1]); compare(msg.h[0]); }
    },
    canStep: () => g.tick <= remoteUpTo,
    // avança um tick: aplica os comandos desse tick (sempre na mesma ordem: lado 0 primeiro) e simula
    step() {
      const list = cmds.get(g.tick);
      if (list) {
        list.sort((a, b) => a[0] - b[0]); // sort estável: dentro do mesmo lado fica a ordem de chegada
        for (const [s, a, x] of list) ACTIONS[a](g, s, x);
        cmds.delete(g.tick);
      }
      update(g, STEP);
      if (g.tick % HASH_EVERY === 0) {
        const h = stateHash(g);
        myHashes.set(g.tick, h); hashOut = [g.tick, h]; compare(g.tick);
      }
    },
    // quanto o outro está na frente (em ticks); se for muito, dá pra acelerar um pouco pra alcançar
    behind: () => remoteUpTo - (DELAY - 1) - g.tick,
  };
  return m;
}
