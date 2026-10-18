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
    help: 'I: modo  ·  C: conquistas  ·  O: online  ·  L: idioma  ·  M: som',
    lang: 'Idioma: Português',
    classic: 'Modo: Clássico', endless: 'Modo: Infinito', achievements: 'Conquistas', achTitle: 'CONQUISTAS', back: 'Voltar (Esc)',
    wave: 'Onda', waveDone: 'Onda vencida!', nextWave: 'próxima onda em', bestWave: 'melhor onda', noWave: 'nenhuma onda ainda', gameOver: 'FIM DE JOGO',
    achGot: 'Conquista!', secret: '???',
    online: 'Jogar online', onlineTitle: 'JOGAR ONLINE', onlineTag: 'Online', onlineHelp: 'Contra um amigo: um cria a sala e manda o código pro outro',
    host: 'Criar sala', join: 'Entrar na sala', press1: 'aperte 1', press2: 'aperte 2',
    roomCode: 'Código da sala (passe pro seu amigo)', typeCode: 'Digite o código do seu amigo', enterJoin: 'Enter pra entrar',
    loading: 'carregando...', waitingFriend: 'esperando o amigo entrar...', connecting: 'conectando...',
    errNotFound: 'sala não encontrada', errTaken: 'código em uso, tente de novo', errNet: 'falha na conexão', errLib: 'não deu pra carregar o online',
    waitOpp: 'esperando o oponente...', oppLeft: 'O OPONENTE SAIU', desync: 'PARTIDA DESSINCRONIZOU',
    nick: 'Apelido', nickEdit: 'clique no apelido pra mudar', nickDone: 'digite e aperte Enter',
    roomOf: 'Sala de', joined: 'entrou na sala!', waitHost: 'esperando o anfitrião começar:', friendLeft: 'o amigo saiu da sala',
    rules: 'Regras da partida', rulesHost: 'Regras (clique ou aperte 1, 2, 3 pra mudar)', start: 'Começar (Enter)',
    ruleEra: 'Era inicial', rulePace: 'Ritmo', ruleSudden: 'Morte súbita', fast: 'Rápido', normal: 'Normal', off: 'Desligada',
    youLeft: 'Você é o Clã do Rio, na esquerda', youRight: 'Você é o Clã do Pântano, na direita', fight: 'LUTA!',
    suddenIn: 'MORTE SÚBITA EM', suddenNow: 'MORTE SÚBITA!', bySudden: 'decidido na morte súbita', emoKeys: 'emotes: 5 6 7 8 9 0',
    statUnits: 'tropas', statTurrets: 'torres', statSpecials: 'especiais', statEra: 'era',
    rematch: 'Revanche (R)', menuEnter: 'Menu (Enter)', wantsRematch: 'quer revanche!', waitRematch: 'esperando', oppGone: 'o oponente saiu',
  },
  en: {
    special: 'Special', spaceKey: 'Space', evolve: 'Evolve', maxEra: 'max era', ready: 'E: ready!',
    units: 'Units', turrets: 'Turrets', slotsFull: 'Slots 4/4', slot: '+Slot', sellPick: 'Click a turret', sell: 'Sell',
    muted: 'sound off (M)', win: 'VICTORY!', lose: 'DEFEAT...', kills: 'kills', record: 'NEW RECORD!',
    backMenu: 'click or Enter to go back to the menu', paused: 'PAUSED', resume: 'P or Esc to resume',
    pick: 'choose the difficulty', best: 'best', noWin: 'no win yet',
    help: 'I: mode  ·  C: achievements  ·  O: online  ·  L: language  ·  M: sound',
    lang: 'Language: English',
    classic: 'Mode: Classic', endless: 'Mode: Endless', achievements: 'Achievements', achTitle: 'ACHIEVEMENTS', back: 'Back (Esc)',
    wave: 'Wave', waveDone: 'Wave cleared!', nextWave: 'next wave in', bestWave: 'best wave', noWave: 'no waves yet', gameOver: 'GAME OVER',
    achGot: 'Achievement!', secret: '???',
    online: 'Play online', onlineTitle: 'PLAY ONLINE', onlineTag: 'Online', onlineHelp: 'Against a friend: one creates the room and sends the code to the other',
    host: 'Create room', join: 'Join room', press1: 'press 1', press2: 'press 2',
    roomCode: 'Room code (send it to your friend)', typeCode: "Type your friend's code", enterJoin: 'Enter to join',
    loading: 'loading...', waitingFriend: 'waiting for your friend...', connecting: 'connecting...',
    errNotFound: 'room not found', errTaken: 'code in use, try again', errNet: 'connection failed', errLib: "couldn't load online mode",
    waitOpp: 'waiting for opponent...', oppLeft: 'OPPONENT LEFT', desync: 'MATCH OUT OF SYNC',
    nick: 'Nickname', nickEdit: 'click your nickname to change it', nickDone: 'type and press Enter',
    roomOf: 'Room of', joined: 'joined the room!', waitHost: 'waiting for the host to start:', friendLeft: 'your friend left the room',
    rules: 'Match rules', rulesHost: 'Rules (click or press 1, 2, 3 to change)', start: 'Start (Enter)',
    ruleEra: 'Starting era', rulePace: 'Pace', ruleSudden: 'Sudden death', fast: 'Fast', normal: 'Normal', off: 'Off',
    youLeft: 'You are the River Clan, on the left', youRight: 'You are the Swamp Clan, on the right', fight: 'FIGHT!',
    suddenIn: 'SUDDEN DEATH IN', suddenNow: 'SUDDEN DEATH!', bySudden: 'decided by sudden death', emoKeys: 'emotes: 5 6 7 8 9 0',
    statUnits: 'units', statTurrets: 'turrets', statSpecials: 'specials', statEra: 'era',
    rematch: 'Rematch (R)', menuEnter: 'Menu (Enter)', wantsRematch: 'wants a rematch!', waitRematch: 'waiting for', oppGone: 'opponent left',
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
