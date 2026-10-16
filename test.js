// roda com: node test.js
import assert from 'node:assert';
import { newGame, update, train } from './src/battle.js';
import { SPACING, UNITS, KILL_GOLD, INCOME } from './src/data.js';

const run = (g, secs) => { for (let i = 0; i < secs * 60; i++) update(g, 1 / 60); };

// Fila andando: ninguém se sobrepõe e a ordem (frente → trás) se mantém.
{
  const g = newGame(false);
  g.sides[0].gold = 1e6;
  for (let i = 0; i < 5; i++) train(g, 0, i % 3);
  run(g, 20);
  const us = g.sides[0].units;
  assert.equal(us.length, 5);
  for (let i = 1; i < us.length; i++) {
    const gap = (us[i - 1].x - us[i - 1].w / 2) - (us[i].x + us[i].w / 2);
    assert.ok(gap >= SPACING - 1e-6, `sobreposição: ${gap}`);
  }
}

// Abate rende ouro: Megatério do jogador mata um Tacape inimigo.
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

// Partida termina: estilingueiros sem oposição derrubam a base inimiga.
{
  const g = newGame(false);
  g.sides[0].gold = 1e6;
  for (let t = 0; t < 600 && g.winner < 0; t++) { train(g, 0, 1); run(g, 1); }
  assert.equal(g.winner, 0);
}

// IA contra jogador passivo: a IA vence.
{
  const g = newGame(true);
  run(g, 900);
  assert.equal(g.winner, 1);
}

console.log('ok');
