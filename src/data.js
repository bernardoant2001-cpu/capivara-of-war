// Todos os números do jogo. Balanceamento é aqui.

export const W = 640, H = 360;     // resolução lógica (a lógica toda roda nela)
export const RES = 3;              // desenho em 3x: canvas 1920x1080
export const WORLD = 1280;         // largura do campo de batalha
export const DEPTH = 1.5;          // quanto cada nível de profundidade desce no chão (px)
export const GROUND = 298;         // y do chão (começo da estradinha de terra no fundo)
export const HUD_H = 40;
export const BASE_W = 64, BASE_H = 96;

export const SPACING = 4;          // folga na porta da base pra nascer (px)
export const HOLD_DIST = 120;      // até quantos px o de distância espera o corpo a corpo alcançar
export const QUEUE_MAX = 5;
export const MAX_UNITS = 20;       // por lado
export const START_GOLD = 175;
export const INCOME = 1;           // ouro/s passivo na era 1 (×3 a cada era)
export const KILL_GOLD = 1.3;      // × custo do abatido
export const KILL_XP = 4;          // × custo do abatido
export const BASE_XP = 0.5;        // × dano causado na base
export const SHOT_SPEED = 220;     // px/s
export const XP_TO_EVOLVE = [4000, 16000, 60000, 220000]; // XP total pra chegar na era 2, 3, 4 e 5
export const SPECIAL_CD = 60;      // s
export const DROP_FALL = 0.8;      // s que cada coco/flecha leva caindo

export const MAX_SLOTS = 4;
export const SLOT_COSTS = [1000, 3000, 7500]; // 2ª, 3ª e 4ª vaga
export const SELL_REFUND = 0.5;
export const TURRET_W = 14, TURRET_H = 10;
export const slotY = (i) => GROUND - BASE_H + 8 + i * 22;

// income: multiplica a renda e o ouro de abate da IA. evolveEvery: a IA sobe de era a cada X segundos.
export const DIFFICULTIES = [
  { name: 'Fácil',      income: 0.7, evolveEvery: 360, maxUnits: 8 },
  { name: 'Normal',     income: 1.0, evolveEvery: 300, maxUnits: 12 },
  { name: 'Difícil',    income: 1.4, evolveEvery: 240, maxUnits: 16 },
  { name: 'Impossível', income: 2.0, evolveEvery: 180, maxUnits: 20 },
];

// Stats da era 1. Cada era seguinte: custo ×3, vida e dano ×2.6, alcance de quem atira +10%.
const UNIT_BASE = [
  { cost: 15,  hp: 55,  dmg: 16, range: 18,  cd: 1.0, speed: 30, train: 1.0, w: 16, h: 20 },
  { cost: 25,  hp: 42,  dmg: 10, range: 110, cd: 1.2, speed: 30, train: 1.5, w: 14, h: 18, ranged: true },
  { cost: 100, hp: 300, dmg: 40, range: 22,  cd: 1.5, speed: 24, train: 4.0, w: 30, h: 28 },
];
const HEAVY_GUN = { range: 150, splash: 24, ranged: true }; // pesada da era 3 em diante atira de longe
const SUPREMA = { name: 'Suprema', cost: 25000, hp: 45000, dmg: 2500, range: 30, splash: 40, cd: 1.2, speed: 20, train: 10, w: 34, h: 34 };

// Torres: alcance contado a partir da frente da base
const TURRET_BASE = [
  { cost: 100, dmg: 12, cd: 1.0,  range: 180 },
  { cost: 200, dmg: 6,  cd: 0.35, range: 160 },
  { cost: 500, dmg: 45, cd: 2.5,  range: 220, splash: 30 },
];

const ERA_INFO = [
  {
    name: 'Era da Lama', units: ['Tacape', 'Estilingue', 'Megatério'], turrets: ['Estilingão', 'Lança-Coco', 'Catapulta'], special: 'Chuva de Cocos',
    sprites: { units: ['tacape', 'estilingue', 'megaterio'], turrets: ['t_estilingao', 't_lancacoco', 't_catapulta'], base: 'base' },
  },
  {
    name: 'Medieval', units: ['Espadachim', 'Arqueira', 'Cavaleira'], turrets: ['Besta', 'Arco 3x', 'Caldeirão'], special: 'Chuva de Flechas',
    sprites: { units: ['espadachim', 'arqueira', 'cavaleira'], turrets: ['t_besta', 't_arco', 't_caldeirao'], base: 'castelo' },
  },
  { name: 'Navegações',  units: ['Duelista', 'Mosquete', 'Canhoneira'],  turrets: ['Canhão', 'Mosquetes', 'Morteiro'],       special: 'Bombardeio' },
  { name: 'Moderna',     units: ['Soldado', 'Metralha', 'Capitanque'],   turrets: ['Metralha', 'Foguetes', 'Torre 2x'],      special: 'Capiaviões' },
  { name: 'Futuro',      units: ['Sabre', 'Blaster', 'Capimecha'],       turrets: ['Laser', 'Titânio', 'Canhão Íon'],        special: 'Laranja Sagrada' },
];

const nice = (x) => (x < 100 ? Math.round(x) : Math.round(x / 5) * 5);

export const ERAS = ERA_INFO.map((info, k) => {
  const c = 3 ** k, p = 2.6 ** k;
  const units = UNIT_BASE.map((b, i) => {
    const u = { ...b, ...(i === 2 && k >= 2 ? HEAVY_GUN : null), name: info.units[i], sprite: info.sprites?.units[i], type: i, era: k };
    u.cost = nice(b.cost * c);
    u.hp = nice(b.hp * p);
    u.dmg = nice(b.dmg * p);
    if (u.ranged) u.range = Math.round(u.range * 1.1 ** k);
    return u;
  });
  if (k === ERA_INFO.length - 1) units.push({ ...SUPREMA, type: 3, era: k });
  return {
    name: info.name,
    art: !!info.sprites, // tem atlas e fundo próprios (assets/eraN.png, bgN.webp)
    baseSprite: info.sprites?.base,
    baseHp: nice(3000 * p),
    units,
    turrets: TURRET_BASE.map((b, i) => ({ ...b, name: info.turrets[i], sprite: info.sprites?.turrets[i], type: i, era: k, cost: nice(b.cost * c), dmg: nice(b.dmg * p) })),
    special: { name: info.special, dmg: nice(60 * p), count: 15, radius: 16 },
  };
});
