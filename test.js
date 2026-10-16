// roda com: node test.js
import assert from 'node:assert';
import { newGame, update, train, buyTurret, buySlot, sellTurret, ATTACK } from './src/battle.js';
import { UNITS, TURRETS, KILL_GOLD, INCOME } from './src/data.js';

const run = (g, secs) => { for (let i = 0; i < secs * 60; i++) update(g, 1 / 60); };

// Briga em bando: 3 tacapes caem em cima de um megatério sozinho ao mesmo tempo.
{
  const g = newGame(false);
  g.sides[0].gold = 1e6;
  for (let i = 0; i < 3; i++) train(g, 0, 0);
  train(g, 1, 2);
  let most = 0;
  run(g, 5); // megatério ainda tá treinando
  g.sides[1].units[0].cd = 1e9; // ele só apanha, pra dar tempo de todo mundo chegar
  for (let i = 0; i < 60 * 60 && g.sides[1].units.length; i++) {
    update(g, 1 / 60);
    most = Math.max(most, g.sides[0].units.filter((u) => u.state === ATTACK).length);
  }
  assert.equal(most, 3, `só ${most} batendo junto`);
}

// Formação: estilingue sai primeiro, mas na briga fica atrás dos tacapes atirando.
{
  const g = newGame(false);
  g.sides[0].gold = 1e6;
  train(g, 0, 1); train(g, 0, 0); train(g, 0, 0);
  train(g, 1, 2);
  run(g, 5);
  g.sides[1].units[0].cd = 1e9;
  let checked = 0, shot = false;
  for (let i = 0; i < 60 * 60 && g.sides[1].units.length; i++) {
    update(g, 1 / 60);
    const us = g.sides[0].units, sling = us.find((u) => u.def.ranged);
    const melee = us.filter((u) => !u.def.ranged);
    if (!melee.some((u) => u.state === ATTACK)) continue;
    for (const m of melee) assert.ok(sling.x + sling.w / 2 < m.x - m.w / 2, 'estilingue na frente do tacape');
    shot ||= sling.state === ATTACK;
    checked++;
  }
  assert.ok(checked > 0 && shot, 'não teve briga com o estilingue atirando');
}

// Abate rende ouro: megatério do jogador mata um tacape inimigo.
{
  const g = newGame(false);
  g.sides[0].gold = 100;
  train(g, 0, 2);
  train(g, 1, 0);
  run(g, 30);
  assert.equal(g.sides[1].units.length, 0);
  const expected = 100 - UNITS[2].cost + INCOME * 30 + UNITS[0].cost * KILL_GOLD;
  assert.ok(Math.abs(g.sides[0].gold - expected) < 0.1, `ouro ${g.sides[0].gold} ≠ ${expected}`);
  assert.ok(g.sides[0].xp > 0);
}

// Torre sozinha segura um tacape e ganha o abate.
{
  const g = newGame(false);
  assert.ok(buyTurret(g, 0, 0));
  train(g, 1, 0);
  run(g, 60);
  assert.equal(g.sides[1].units.length, 0);
  assert.ok(g.sides[0].xp >= UNITS[0].cost * 4);
}

// Catapulta pega mais de um no splash.
{
  const g = newGame(false);
  g.sides[0].gold = 1e6;
  g.sides[1].gold = 1e6;
  buyTurret(g, 0, 2);
  for (let i = 0; i < 3; i++) train(g, 1, 0);
  let hit = 0;
  for (let i = 0; i < 60 * 60 && hit === 0; i++) {
    update(g, 1 / 60);
    hit = g.sides[1].units.filter((u) => u.hp < u.def.hp).length;
  }
  assert.ok(hit >= 2, `splash acertou só ${hit}`);
}

// Vagas, compra e venda.
{
  const g = newGame(false);
  g.sides[0].gold = 2000;
  assert.ok(buySlot(g, 0));
  assert.equal(g.sides[0].gold, 1000);
  assert.ok(buyTurret(g, 0, 2) && buyTurret(g, 0, 1));
  assert.ok(!buyTurret(g, 0, 0), 'comprou sem vaga');
  assert.ok(sellTurret(g, 0, 0));
  assert.equal(g.sides[0].gold, 1000 - 700 + TURRETS[2].cost / 2);
  assert.equal(g.sides[0].slots[0], null);
}

// Partida termina: estilingueiros sem oposição derrubam a base inimiga.
{
  const g = newGame(false);
  g.sides[0].gold = 1e6;
  for (let t = 0; t < 600 && g.winner < 0; t++) { train(g, 0, 1); run(g, 1); }
  assert.equal(g.winner, 0);
}

// IA contra jogador passivo: a IA vence (e compra torre no caminho).
{
  const g = newGame(true);
  run(g, 900);
  assert.equal(g.winner, 1);
}

console.log('ok');
