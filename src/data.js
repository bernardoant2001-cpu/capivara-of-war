// Todos os números do jogo. Balanceamento é aqui.

export const W = 640, H = 360;     // resolução interna (o CSS amplia)
export const WORLD = 1280;         // largura do campo de batalha
export const GROUND = 300;         // y do chão
export const HUD_H = 40;
export const BASE_W = 64, BASE_H = 96, BASE_HP = 1000;

export const SPACING = 4;          // folga na porta da base pra nascer (px)
export const QUEUE_MAX = 5;
export const MAX_UNITS = 20;       // por lado
export const START_GOLD = 175;
export const INCOME = 1;           // ouro/s passivo
export const KILL_GOLD = 1.3;      // × custo do abatido
export const KILL_XP = 4;          // × custo do abatido
export const BASE_XP = 0.5;        // × dano causado na base
export const SHOT_SPEED = 220;     // px/s

// Era 1 por enquanto
export const UNITS = [
  { name: 'Tacape',     cost: 15,  hp: 55,  dmg: 16, range: 18,  cd: 1.0, speed: 30, train: 1.0, w: 16, h: 20 },
  { name: 'Estilingue', cost: 25,  hp: 42,  dmg: 10, range: 110, cd: 1.2, speed: 30, train: 1.5, w: 14, h: 18, ranged: true },
  { name: 'Megatério',  cost: 100, hp: 300, dmg: 40, range: 22,  cd: 1.5, speed: 24, train: 4.0, w: 30, h: 28 },
];

// Torres: alcance contado a partir da frente da base
export const TURRETS = [
  { name: 'Estilingão', cost: 100, dmg: 12, cd: 1.0,  range: 180 },
  { name: 'Lança-Coco', cost: 200, dmg: 6,  cd: 0.35, range: 160 },
  { name: 'Catapulta',  cost: 500, dmg: 45, cd: 2.5,  range: 220, splash: 30 },
];
export const MAX_SLOTS = 4;
export const SLOT_COSTS = [1000, 3000, 7500]; // 2ª, 3ª e 4ª vaga
export const SELL_REFUND = 0.5;
export const TURRET_W = 14, TURRET_H = 10;
export const slotY = (i) => GROUND - BASE_H + 8 + i * 22;
