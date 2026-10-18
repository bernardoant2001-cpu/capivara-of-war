// roda com: node test.js
import assert from 'node:assert';
import {
  newGame, update, train, buyTurret, buySlot, sellTurret, evolve, special, canEvolve, ATTACK,
} from './src/battle.js';
import { ERAS, KILL_GOLD, INCOME, XP_TO_EVOLVE, SPECIAL_CD, DIFFICULTIES } from './src/data.js';

const UNITS = ERAS[0].units, TURRETS = ERAS[0].turrets;
const run = (g, secs) => { for (let i = 0; i < secs * 60; i++) update(g, 1 / 60); };
const game = () => newGame(1, false);

// Briga em bando: 3 tacapes caem em cima de um megatério sozinho ao mesmo tempo.
{
  const g = game();
  g.sides[0].gold = 1e6;
  for (let i = 0; i < 3; i++) train(g, 0, 0);
  train(g, 1, 2);
  run(g, 5); // megatério ainda tá treinando
  g.sides[1].units[0].cd = 1e9; // ele só apanha, pra dar tempo de todo mundo chegar
  let most = 0;
  for (let i = 0; i < 60 * 60 && g.sides[1].units.length; i++) {
    update(g, 1 / 60);
    most = Math.max(most, g.sides[0].units.filter((u) => u.state === ATTACK).length);
  }
  assert.equal(most, 3, `só ${most} batendo junto`);
}

// Formação: estilingue sai primeiro, mas na briga fica atrás dos tacapes atirando.
{
  const g = game();
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

// Estilingues não ficam se encarando esperando um corpo a corpo que tá lá na base.
{
  const g = game();
  g.sides[0].gold = g.sides[1].gold = 1e6;
  train(g, 0, 1); train(g, 1, 1);
  run(g, 2);
  train(g, 0, 0); train(g, 1, 0);
  run(g, 1.2);
  const [a, b] = [g.sides[0], g.sides[1]].map((s) => s.units.find((u) => u.def.ranged));
  const [ma, mb] = [g.sides[0], g.sides[1]].map((s) => s.units.find((u) => !u.def.ranged));
  a.x = 500; b.x = 800; ma.x = 100; mb.x = 1180;
  run(g, 8);
  assert.ok(a.hp < a.def.hp || b.hp < b.def.hp, 'estilingues ficaram parados se olhando');
}

// Abate rende ouro: megatério do jogador mata um tacape inimigo.
{
  const g = game();
  g.sides[0].gold = 100;
  train(g, 0, 2);
  train(g, 1, 0);
  run(g, 30);
  assert.equal(g.sides[1].units.length, 0);
  const expected = 100 - UNITS[2].cost + INCOME * 30 + UNITS[0].cost * KILL_GOLD;
  assert.ok(Math.abs(g.sides[0].gold - expected) < 0.1, `ouro ${g.sides[0].gold} ≠ ${expected}`);
  assert.equal(g.sides[0].kills, 1);
}

// Torre sozinha segura um tacape e ganha o abate.
{
  const g = game();
  assert.ok(buyTurret(g, 0, 0));
  train(g, 1, 0);
  run(g, 60);
  assert.equal(g.sides[1].units.length, 0);
  assert.equal(g.sides[0].kills, 1);
}

// Catapulta pega mais de um no splash.
{
  const g = game();
  g.sides[0].gold = g.sides[1].gold = 1e6;
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
  const g = game();
  g.sides[0].gold = 2000;
  assert.ok(buySlot(g, 0));
  assert.equal(g.sides[0].gold, 1000);
  assert.ok(buyTurret(g, 0, 2) && buyTurret(g, 0, 1));
  assert.ok(!buyTurret(g, 0, 0), 'comprou sem vaga');
  assert.ok(sellTurret(g, 0, 0));
  assert.equal(g.sides[0].gold, 1000 - 700 + TURRETS[2].cost / 2);
  assert.equal(g.sides[0].slots[0], null);
}

// Evolução: precisa do XP, sobe a vida da base e troca a loja.
{
  const g = game(), me = g.sides[0];
  assert.ok(!evolve(g, 0), 'evoluiu sem XP');
  me.base.hp -= 300;
  me.xp = XP_TO_EVOLVE[0];
  assert.ok(canEvolve(me) && evolve(g, 0));
  assert.equal(me.era, 1);
  assert.equal(me.base.maxHp, ERAS[1].baseHp);
  assert.equal(me.base.hp, ERAS[1].baseHp - 300);
  me.gold = 1e6;
  train(g, 0, 0);
  assert.equal(me.queue[0], ERAS[1].units[0]);
  assert.ok(!train(g, 0, 3), 'Suprema antes da era 5');
  me.xp = 1e9;
  while (evolve(g, 0));
  assert.equal(me.era, 4);
  assert.ok(train(g, 0, 3), 'sem Suprema na era 5');
}

// Especial: mira nos inimigos andando e derruba pelo menos metade (não precisa ser todo mundo).
{
  const g = game();
  g.sides[1].gold = 1e6;
  for (let i = 0; i < 5; i++) train(g, 1, 0); // 5 é o limite da fila
  run(g, 3);
  train(g, 1, 0);
  run(g, 4);
  assert.equal(g.sides[1].units.length, 6);
  g.sides[0].specialT = 0;
  assert.ok(special(g, 0));
  assert.ok(!special(g, 0), 'especial sem recarga');
  run(g, 3);
  assert.ok(g.sides[1].units.length <= 3, `sobraram ${g.sides[1].units.length} de 6`);
  assert.ok(g.sides[0].specialT > SPECIAL_CD - 4);
}

// Nome cabe no botão (12 caracteres com o número da tecla; inglês tem um de folga, o botão aperta o texto).
for (const era of ERAS) {
  for (const d of [...era.units, ...era.turrets]) assert.ok(`1 ${d.name}`.length <= 12, `nome grande: ${d.name}`);
  for (const d of [...era.units, ...era.turrets]) assert.ok(d.en && `1 ${d.en}`.length <= 13, `nome em inglês faltando ou grande: ${d.en}`);
}

// Partida termina: estilingueiros sem oposição derrubam a base inimiga.
{
  const g = game();
  g.sides[0].gold = 1e6;
  for (let t = 0; t < 600 && g.winner < 0; t++) { train(g, 0, 1); run(g, 1); }
  assert.equal(g.winner, 0);
}

// IA contra jogador passivo: vence e evolui com o tempo no caminho.
{
  const g = newGame(3, true);
  run(g, DIFFICULTIES[3].evolveEvery + 1);
  assert.ok(g.sides[1].era >= 1 || g.winner === 1, 'IA não evoluiu');
  run(g, 900);
  assert.equal(g.winner, 1);
}

console.log('ok');
