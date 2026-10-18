// Conexão direta entre os dois navegadores (WebRTC, via PeerJS).
// A biblioteca só é baixada quando alguém abre o modo online; o resto do jogo não depende dela.
const PEERJS = 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js';
const PREFIX = 'capivara-of-war-v1-';
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sem I, L, O, 0 e 1 pra não confundir

let loading = null;
function loadPeer() {
  return (loading ||= new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = PEERJS;
    s.onload = () => ok(window.Peer);
    s.onerror = () => { loading = null; fail(new Error('lib')); };
    document.head.appendChild(s);
  }));
}

export const newCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
export const validChar = (c) => LETTERS.includes(c);

// ev: status(chave), ready(link), error(chave)
// link: { send(msg), onData(cb), onClose(cb), close() }
function wrap(peer, conn) {
  return {
    send: (m) => { if (conn.open) conn.send(m); },
    onData: (cb) => conn.on('data', cb),
    onClose: (cb) => conn.on('close', cb), // cair do servidor de sinal não importa, a conexão entre os dois é direta
    close: () => { try { conn.close(); peer.destroy(); } catch {} },
  };
}

const errorKey = (e) => (e.type === 'peer-unavailable' ? 'errNotFound' : e.type === 'unavailable-id' ? 'errTaken' : 'errNet');

// cria a sala com o código e espera alguém entrar
export async function host(code, ev) {
  let Peer;
  try { Peer = await loadPeer(); } catch { return ev.error('errLib'); }
  const peer = new Peer(PREFIX + code, { debug: 0 });
  let taken = false;
  peer.on('open', () => ev.status('waitingFriend'));
  peer.on('connection', (conn) => {
    if (taken) return conn.close(); // sala já tem dois
    taken = true;
    conn.on('open', () => ev.ready(wrap(peer, conn)));
  });
  peer.on('error', (e) => ev.error(errorKey(e)));
  return { close: () => peer.destroy() };
}

// entra na sala de outra pessoa
export async function join(code, ev) {
  let Peer;
  try { Peer = await loadPeer(); } catch { return ev.error('errLib'); }
  const peer = new Peer({ debug: 0 });
  peer.on('open', () => {
    ev.status('connecting');
    const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
    conn.on('open', () => ev.ready(wrap(peer, conn)));
  });
  peer.on('error', (e) => ev.error(errorKey(e)));
  return { close: () => peer.destroy() };
}
