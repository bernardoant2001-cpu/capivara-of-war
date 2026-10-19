// roda com: node test.js
import assert from 'node:assert';
import {
  newGame, update, train, buyTurret, buySlot, sellTurret, evolve, special, canEvolve, waveUnits, why, ATTACK,
} from './src/battle.js';
import { ACHIEVEMENTS, check } from './src/achievements.js';
import { createMatch, stateHash } from './src/lockstep.js';
import { ERAS, KILL_GOLD, INCOME, XP_TO_EVOLVE, SPECIAL_CD, DIFFICULTIES, SECRET_ERA } from './src/data.js';

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
  while (me.era < 4) evolve(g, 0);
  assert.ok(train(g, 0, 3), 'sem Suprema na era 5');
  // a IA não passa do Futuro sozinha; a era secreta só abre depois do jogador
  const foe = g.sides[1];
  while (evolve(g, 1, true));
  assert.equal(foe.era, 4, 'IA entrou na era secreta antes do jogador');
  assert.ok(evolve(g, 0), 'jogador não chegou na era secreta');
  assert.equal(me.era, SECRET_ERA);
  assert.ok(!canEvolve(me), 'tem era depois da secreta');
  assert.ok(evolve(g, 1, true), 'IA não acompanhou o jogador na era secreta');
}

// Modo infinito: a base inimiga não cai, as ondas vêm e crescem, onda vencida dá bônus.
{
  const g = newGame(1, true, 'endless'), me = g.sides[0], foe = g.sides[1];
  assert.equal(g.wave, 0);
  run(g, 9);
  assert.equal(g.wave, 1);
  assert.ok(g.waveOn && g.pending.length + foe.queue.length > 0);
  // 6 estilingues aguentam a onda 1 sozinhos
  me.gold = 1e6;
  for (let t = 0; t < 120 && g.wave < 2; t++) { if (me.units.length < 6) train(g, 0, 1); run(g, 1); }
  assert.ok(g.wave >= 2, 'não passou da onda 1');
  assert.ok(g.bonus > 0, 'onda vencida sem bônus');
  // atacar a base inimiga não adianta
  foe.base.hp = 1;
  run(g, 30);
  assert.ok(g.winner !== 0, 'base inimiga caiu no infinito');
  assert.ok(waveUnits(g, 20).length > waveUnits(g, 1).length, 'ondas não crescem');
  assert.ok(waveUnits(g, 10)[0].hp > ERAS[foe.era].units[0].hp, 'ondas não ficam mais fortes');
}

// Infinito sem defesa: o jogador perde em algum momento.
{
  const g = newGame(1, true, 'endless');
  run(g, 900);
  assert.equal(g.winner, 1);
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

// Conquistas: vitória limpa no Impossível pega várias de uma vez; já conquistada não repete.
{
  const g = newGame(3, false);
  g.winner = 0; g.time = 300;
  const got = new Set(check(g, new Set(), 10));
  for (const id of ['win', 'hard', 'impossible', 'speed', 'nospecial', 'noturret', 'untouched']) assert.ok(got.has(id), 'faltou ' + id);
  assert.ok(!got.has('nap') && !got.has('future') && !got.has('wave10'));
  assert.equal(check(g, got, 10).length, 0, 'conquista repetida');
  assert.ok(check(g, got, 500).includes('nap'));
  g.stats.specials = 1;
  assert.ok(!check(g, new Set(), 0).includes('nospecial'));
  for (const a of ACHIEVEMENTS) for (const l of ['pt', 'en']) assert.ok(a[l][1].length <= 30, 'descrição grande: ' + a[l][1]);
}

// Online: dois "computadores" com rede lenta e bagunçada jogam a mesma partida e terminam idênticos.
{
  const seed = 12345, net = [[], []]; // mensagens a caminho de cada lado
  let clock = 0;
  const mk = (me) => createMatch(seed, me, (msg) => net[1 - me].push({ at: clock + 2 + Math.floor(Math.random() * 12), msg: JSON.parse(JSON.stringify(msg)) }));
  const A = mk(0), B = mk(1);
  const bots = [A, B];
  for (clock = 0; clock < 60 * 400 && A.g.winner < 0; clock++) {
    for (const [k, m] of bots.entries()) {
      // entrega o que já chegou (fora de ordem não acontece: cada lado manda em ordem)
      while (net[k].length && net[k][0].at <= clock) m.receive(net[k].shift().msg);
      if (Math.random() < 0.02) m.act('train', Math.floor(Math.random() * 3));
      if (Math.random() < 0.002) m.act(Math.random() < 0.5 ? 'special' : 'evolve');
      if (Math.random() < 0.001) m.act('turret', 2);
      if (Math.random() < 0.3) { let n = 0; while (m.canStep() && n++ < 3) m.step(); } // cada um anda no seu ritmo
      m.flush();
    }
  }
  // deixa os dois alcançarem o mesmo ponto
  for (let i = 0; i < 5000 && (A.g.tick !== B.g.tick || A.g.winner < 0 && A.g.tick < 60 * 100); i++) {
    for (const [k, m] of bots.entries()) { while (net[k].length) m.receive(net[k].shift().msg); if (m.canStep()) m.step(); m.flush(); }
    clock++;
  }
  const t = Math.min(A.g.tick, B.g.tick);
  assert.ok(t > 60 * 30, 'quase não andou: ' + t);
  assert.ok(!A.desync && !B.desync, 'dessincronizou');
  if (A.g.tick === B.g.tick) assert.equal(stateHash(A.g), stateHash(B.g));
  assert.ok(A.g.sides[0].units.length + A.g.sides[1].units.length + A.g.sides[0].kills > 0, 'ninguém treinou nada');
}

// Motivo de não dar pra fazer a ação (aviso da interface) bate com o que a ação faz de verdade.
{
  const g = newGame(1, false);
  g.sides[0].gold = 10;
  assert.equal(why(g, 0, 'train', 0), 'gold'); assert.ok(!train(g, 0, 0));
  g.sides[0].gold = 1e6;
  for (let i = 0; i < 5; i++) assert.equal(why(g, 0, 'train', 0), null), train(g, 0, 0);
  assert.equal(why(g, 0, 'train', 0), 'full'); assert.ok(!train(g, 0, 0));
  assert.equal(why(g, 0, 'turret', 0), null); buyTurret(g, 0, 0);
  assert.equal(why(g, 0, 'turret', 0), 'full');
  assert.equal(why(g, 0, 'special'), 'wait'); g.sides[0].specialT = 0; assert.equal(why(g, 0, 'special'), null);
  assert.equal(why(g, 0, 'evolve'), 'xp'); g.sides[0].xp = 1e9; assert.equal(why(g, 0, 'evolve'), null);
  assert.equal(why(g, 0, 'train', 3), 'none');
}

// Regras do online: era inicial, ritmo rápido, contagem e morte súbita.
{
  const g = newGame(1, false, 'pvp', 7, { era: 2, fast: true, sudden: 1 });
  assert.equal(g.sides[0].era, 2); assert.equal(g.sides[1].era, 2);
  assert.equal(g.sides[0].gold, 175 * 9);
  assert.equal(g.fx.length, 0, 'evolução do começo não pode tocar som');
  g.countdown = 3;
  assert.ok(train(g, 0, 0), 'na contagem dá pra encher a fila');
  for (let i = 0; i < 60 * 2.9; i++) update(g, 1 / 60);
  assert.equal(g.time, 0); assert.equal(g.sides[0].units.length, 0, 'ninguém sai antes do LUTA');
  for (let i = 0; i < 60 * 3; i++) update(g, 1 / 60);
  assert.equal(g.sides[0].units.length, 1);
  const slow = newGame(1, false, 'pvp', 7);
  for (let i = 0; i < 600; i++) { update(g, 1 / 60); update(slow, 1 / 60); }
  assert.ok(g.sides[1].gold - 175 * 9 > (slow.sides[1].gold - 175) * 9 * 1.5, 'ritmo rápido rende mais');
  // morte súbita: quem tomou dano antes cai primeiro
  g.sides[1].base.hp -= 50;
  for (let i = 0; i < 60 * 200 && g.winner < 0; i++) update(g, 1 / 60);
  assert.ok(g.sudden); assert.equal(g.winner, 0);
  assert.ok(g.time < 60 + 120, 'morte súbita demorou: ' + g.time);
}

console.log('ok');
