// Conquistas: cada uma tem um teste em cima da partida atual. Sem DOM, roda no node (test.js).
import { SECRET_ERA } from './data.js';

const classicWin = (g) => g.mode === 'classic' && g.winner === 0;

// icon: nome do ícone no atlas da interface (assets/ui.json)
export const ACHIEVEMENTS = [
  { id: 'win', icon: 'kills', pt: ['Primeira vitória', 'Vença uma partida'], en: ['First Victory', 'Win a match'], test: classicWin },
  { id: 'hard', icon: 'base', pt: ['Durona', 'Vença no Difícil'], en: ['Tough Capy', 'Win on Hard'], test: (g) => classicWin(g) && g.diff >= 2 },
  { id: 'impossible', icon: 'base', pt: ['Impossível?', 'Vença no Impossível'], en: ['Impossible?', 'Win on Impossible'], test: (g) => classicWin(g) && g.diff === 3 },
  { id: 'speed', icon: 'time', pt: ['Velocista', 'Vença em menos de 10 min'], en: ['Speedrunner', 'Win in under 10 min'], test: (g) => classicWin(g) && g.time < 600 },
  { id: 'nospecial', icon: 'special', pt: ['Sem truques', 'Vença sem usar o especial'], en: ['No Tricks', 'Win without the special'], test: (g) => classicWin(g) && !g.stats.specials },
  { id: 'noturret', icon: 'turret', pt: ['Peito aberto', 'Vença sem comprar torre'], en: ['No Walls', 'Win without turrets'], test: (g) => classicWin(g) && !g.stats.turrets },
  { id: 'untouched', icon: 'base', pt: ['Intocada', 'Vença com a base acima de 75%'], en: ['Untouched', 'Win with base above 75%'], test: (g) => classicWin(g) && g.sides[0].base.hp >= g.sides[0].base.maxHp * 0.75 },
  { id: 'future', icon: 'evolve', pt: ['Viajante do tempo', 'Chegue à era do Futuro'], en: ['Time Traveler', 'Reach the Future'], test: (g) => g.sides[0].era >= 4 },
  { id: 'secret', icon: 'xp', secret: true, pt: ['Além das estrelas', 'Descubra a era secreta'], en: ['Beyond the Stars', 'Discover the secret era'], test: (g) => g.sides[0].era >= SECRET_ERA },
  { id: 'suprema', icon: 'unit', pt: ['Laranja na cabeça', 'Treine a Capivara Suprema'], en: ['Orange on Top', 'Train the Supreme Capybara'], test: (g) => g.stats.suprema > 0 },
  { id: 'army', icon: 'unit', pt: ['Exército', 'Tenha 20 unidades em campo'], en: ['Army', 'Have 20 units on the field'], test: (g) => g.stats.maxUnits >= 20 },
  { id: 'builder', icon: 'slot', pt: ['Arquiteta', 'Tenha 4 torres ao mesmo tempo'], en: ['Architect', 'Have 4 turrets at once'], test: (g) => g.stats.maxTurrets >= 4 },
  { id: 'nap', icon: 'kills', pt: ['Hora da soneca', 'Faça 500 capivaras dormirem'], en: ['Nap Time', 'Put 500 capybaras to sleep'], test: (g, kills) => kills >= 500 },
  { id: 'wave10', icon: 'time', pt: ['Resistente', 'Chegue à onda 10 no Infinito'], en: ['Survivor', 'Reach wave 10 in Endless'], test: (g) => g.mode === 'endless' && g.wave >= 10 },
  { id: 'wave25', icon: 'xp', pt: ['Lendária', 'Chegue à onda 25 no Infinito'], en: ['Legend', 'Reach wave 25 in Endless'], test: (g) => g.mode === 'endless' && g.wave >= 25 },
];

// ids que acabaram de ser conquistados (got = Set dos já conquistados; kills = total de abates contando esta partida)
export function check(g, got, kills) {
  const out = [];
  for (const a of ACHIEVEMENTS) if (!got.has(a.id) && a.test(g, kills)) out.push(a.id);
  return out;
}
