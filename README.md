# Capivara of War

Age of War, só que com capivaras.

**Jogar:** https://bernardoant2001-cpu.github.io/capivara-of-war/

Também no itch.io: https://nadinh0.itch.io/capivara-of-war

## Rodar local

```
npx serve
```

Testes da lógica: `node test.js`

Publicar no itch.io (precisa do [butler](https://itch.io/docs/butler/) logado): `.\publicar-itch.ps1`

Atalhos pra testar: `?era=2` começa os dois lados na era 2, `?ouro=5000` começa com 5000 de ouro (dá pra juntar: `?era=3&ouro=9000`).

## Modos

- **Clássico:** derrube a base do clã rival atravessando as eras.
- **Infinito:** aguente o máximo de ondas que conseguir; a cada 4 ondas o inimigo sobe de era.
- **Online:** contra um amigo. Um cria a sala e passa o código de 4 letras, o outro entra com ele. A conexão é direta entre os dois navegadores (WebRTC via PeerJS), sem servidor próprio; em algumas redes muito fechadas pode não conectar.
  No saguão quem criou a sala escolhe as regras: era inicial, ritmo (normal ou rápido) e morte súbita (desligada, 5 ou 10 min). Tem contagem antes de começar, emotes de capivara (`5` a `0`), resumo lado a lado no fim e revanche (`R`).
- **Conquistas:** 15 pra desbloquear, salvas no navegador.

## Controles

- `1` `2` `3` `4` treinam unidades (o `4` só na última era)
- `T` alterna entre unidades e torres (no modo torres, `4` compra vaga)
- `E` evolui de era quando a barra de XP enche
- `Espaço` solta o especial
- `←` `→` / `A` `D` / arrastar movem a câmera; `↑`/`W` pula pra linha de frente, `↓`/`S` volta pra base; clicar no minimapa leva a câmera até lá
- `F` alterna a velocidade 1x/2x (fora do online)
- Passar o mouse (ou segurar o dedo) num botão mostra vida, dano, alcance e o que ele faz
- `M` liga e desliga o som
- No menu: `I` troca o modo, `C` abre as conquistas, `O` abre o online, `L` troca o idioma
- `P` / `Esc` abre a pausa: continuar, reiniciar, som e sair pro menu (no online abre o menu, mas a partida continua)
- `F3` mostra o fps
