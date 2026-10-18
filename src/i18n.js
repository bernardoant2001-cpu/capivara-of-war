// Idioma da interface. Começa pelo do navegador; a escolha no menu fica salva.
const KEY = 'capivara-of-war:idioma';

let lang = 'pt';
try { lang = localStorage.getItem(KEY) || ''; } catch {}
if (lang !== 'pt' && lang !== 'en') lang = typeof navigator !== 'undefined' && /^pt/i.test(navigator.language) ? 'pt' : 'en';

const TEXT = {
  pt: {
    special: 'Especial', spaceKey: 'Espaço', evolve: 'Evoluir', maxEra: 'era máx', ready: 'E: pronto!',
    units: 'Unidades', turrets: 'Torres', slotsFull: 'Vagas 4/4', slot: '+Vaga', sellPick: 'Clica na torre', sell: 'Vender',
    muted: 'som desligado (M)', win: 'VITÓRIA!', lose: 'DERROTA...', kills: 'abates', record: 'NOVO RECORDE!',
    backMenu: 'clique ou Enter pra voltar ao menu', paused: 'PAUSADO', resume: 'P ou Esc pra continuar',
    pick: 'escolha a dificuldade', best: 'recorde', noWin: 'sem vitória ainda',
    help: 'I: modo  ·  C: conquistas  ·  L: idioma  ·  M: som',
    lang: 'Idioma: Português',
    classic: 'Modo: Clássico', endless: 'Modo: Infinito', achievements: 'Conquistas', achTitle: 'CONQUISTAS', back: 'Voltar (Esc)',
    wave: 'Onda', waveDone: 'Onda vencida!', nextWave: 'próxima onda em', bestWave: 'melhor onda', noWave: 'nenhuma onda ainda', gameOver: 'FIM DE JOGO',
    achGot: 'Conquista!', secret: '???',
  },
  en: {
    special: 'Special', spaceKey: 'Space', evolve: 'Evolve', maxEra: 'max era', ready: 'E: ready!',
    units: 'Units', turrets: 'Turrets', slotsFull: 'Slots 4/4', slot: '+Slot', sellPick: 'Click a turret', sell: 'Sell',
    muted: 'sound off (M)', win: 'VICTORY!', lose: 'DEFEAT...', kills: 'kills', record: 'NEW RECORD!',
    backMenu: 'click or Enter to go back to the menu', paused: 'PAUSED', resume: 'P or Esc to resume',
    pick: 'choose the difficulty', best: 'best', noWin: 'no win yet',
    help: 'I: mode  ·  C: achievements  ·  L: language  ·  M: sound',
    lang: 'Language: English',
    classic: 'Mode: Classic', endless: 'Mode: Endless', achievements: 'Achievements', achTitle: 'ACHIEVEMENTS', back: 'Back (Esc)',
    wave: 'Wave', waveDone: 'Wave cleared!', nextWave: 'next wave in', bestWave: 'best wave', noWave: 'no waves yet', gameOver: 'GAME OVER',
    achGot: 'Achievement!', secret: '???',
  },
};

export const t = (k) => TEXT[lang][k];
// nome de era, unidade, torre, especial ou dificuldade no idioma atual
export const nm = (o) => (lang === 'en' && o.en) || o.name;
// texto de conquista: [nome, descrição] no idioma atual
export const achText = (a) => a[lang];

export const getLang = () => lang;
export const toggleLang = () => setLang(lang === 'pt' ? 'en' : 'pt');

export function setLang(l) {
  lang = l;
  try { localStorage.setItem(KEY, lang); } catch {}
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
}
