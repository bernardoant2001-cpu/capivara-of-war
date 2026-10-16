# Capivara of War 🦫⚔️

Recriação de **Age of War** com capivaras. Jogo de navegador, pixel art no estilo 32 bits (GBA/Saturn), feito pra rodar liso até em PC fraco.

---

## 1. Visão geral

- **Gênero:** tower defense + tug-of-war numa única pista (lane) horizontal.
- **Objetivo:** destruir a base inimiga antes que destruam a sua.
- **Loop:** treina unidades → elas andam e lutam sozinhas → abates rendem **ouro** (pra comprar mais) e **XP** (pra evoluir de era) → evolui → unidades e torres mais fortes → repete até alguém cair.
- **Facções:** **Clã do Rio** (jogador, detalhes laranja) contra o **Clã do Pântano** (IA, detalhes azul/roxo). Os dois clãs usam os mesmos sprites com troca de paleta, então a arte custa a metade.
- **Tom:** fofo e bem-humorado. Ninguém morre: a capivara derrotada **deita, solta um "zzz" e some numa fumacinha**.

---

## 2. Mecânicas (base Age of War)

### 2.1 Pista e combate
- Um único caminho horizontal. A base do jogador fica à esquerda e a do inimigo à direita.
- **Briga em bando** (diferente do original): aliado não bloqueia aliado.
  - Cada unidade anda até a unidade inimiga mais avançada ficar no seu alcance e aí ataca.
  - Cada uma para num ponto sorteado dentro do próprio alcance e numa profundidade sorteada no chão, então o grupo vira um bolo e todo mundo bate junto.
  - Quem ficar sozinho apanha de vários ao mesmo tempo.
- **Distância:** formação, não fila.
  - Nunca passa do corpo a corpo mais avançado do próprio time e fica uma distância sorteada atrás dele.
  - Se saiu da base antes, segura a posição até o corpo a corpo passar.
  - Atira por cima de todo mundo, inclusive andando ou esperando.
  - Sem nenhum corpo a corpo em campo, vai sozinho até o próprio alcance.
- **Pesadas de era 3+:** dano em área (splash) num raio pequeno.
- Não precisa de motor de física. O alvo é só a unidade inimiga mais avançada, em O(n).

### 2.2 Economia
| Item | Valor |
|---|---|
| Ouro inicial | 175 |
| Ouro por abate | `custo da unidade inimiga × 1.3` |
| XP por abate | `custo da unidade inimiga × 4` |
| XP por dano na base inimiga | `dano × 0.5` |
| Renda passiva | 1 ouro/s na era 1, ×3 a cada era (evita travar sem dinheiro) |

### 2.3 Treinamento
- Fila de no máximo **5 unidades**.
- Cada unidade tem tempo de treino. Ela nasce na porta da base quando o espaço está livre.
- Cancelar uma unidade na fila devolve 100% do ouro.

### 2.4 Evolução (eras)
| Para a era | XP necessário |
|---|---|
| 2 – Medieval | 4.000 |
| 3 – Navegações | 16.000 |
| 4 – Moderna | 60.000 |
| 5 – Futuro | 220.000 |

- O botão "Evoluir" só acende quando há XP suficiente.
- Ao evoluir: o sprite e o HP máximo da base sobem, e o HP atual sobe pela diferença. A loja de unidades e de torres troca para a nova era.
- **Unidades da era antiga que já estão em campo continuam lutando.**

### 2.5 Torres
- **Slots:** começa com 1 e dá pra comprar até 4. Custo dos slots extras: 1.000 / 3.000 / 7.500.
- Cada era tem 3 torres (barata, rápida e pesada).
- Vender devolve 50%.
- A torre mira a unidade inimiga da frente que estiver dentro do alcance.

### 2.6 Habilidade especial
- Uma por era, com recarga de **60 s**.
- Cai dano espalhado pela metade inimiga do campo.

### 2.7 Vitória e derrota
- Base inimiga com HP 0 → vitória. A tela final mostra tempo, abates, era alcançada e dificuldade.
- O recorde de cada dificuldade fica salvo no `localStorage`.

---

## 3. Conteúdo por era

Os stats escalam com uma fórmula por era (`k = era - 1`), então tudo fica num único arquivo de dados:
- **custo** × 3^k
- **HP e dano** × 2.6^k
- **alcance:** fixo por arquétipo, com +10% por era para os de distância

### 3.1 Unidades

| Era | Corpo a corpo | Distância | Pesada | Especial |
|---|---|---|---|---|
| 1 – **Era da Lama** | Capivara do Tacape | Capivara do Estilingue | Capivara Montada no **Megatério** (preguiça gigante) | – |
| 2 – **Medieval** | Capivara Espadachim | Capivara Arqueira | Cavaleira montada numa **Anta de Armadura** | – |
| 3 – **Navegações** | Capivara Duelista (florete) | Capivara Mosqueteira | Capivara Canhoneira (splash) | – |
| 4 – **Moderna** | Capivara Soldado (baioneta) | Capivara Metralhadora | **Capitanque** (splash) | – |
| 5 – **Futuro** | Capivara Sabre-Laser | Capivara Blaster | **Capimecha** (splash) | **Capivara Suprema** (com a laranja na cabeça 🍊) |

**Stats base (era 1).** Para as outras eras aplica a fórmula acima.

| Arquétipo | Custo | HP | Dano | Alcance (px) | Recarga (s) | Velocidade (px/s) | Treino (s) |
|---|---|---|---|---|---|---|---|
| Corpo a corpo | 15 | 55 | 16 | 18 | 1.0 | 30 | 1.0 |
| Distância | 25 | 42 | 10 | 110 | 1.2 | 30 | 1.5 |
| Pesada | 100 | 300 | 40 | 22 (era 3+: 150, splash 24) | 1.5 | 24 | 4.0 |
| Suprema (só na era 5) | 25.000 | 45.000 | 2.500 | 40, splash 40 | 1.2 | 20 | 10 |

**Tabela pronta, já calculada:**

| Era | Corpo a corpo (custo/HP/dano) | Distância | Pesada |
|---|---|---|---|
| 1 | 15 / 55 / 16 | 25 / 42 / 10 | 100 / 300 / 40 |
| 2 | 45 / 145 / 42 | 75 / 110 / 26 | 300 / 780 / 105 |
| 3 | 135 / 370 / 108 | 225 / 285 / 68 | 900 / 2.000 / 270 |
| 4 | 400 / 960 / 280 | 675 / 740 / 175 | 2.700 / 5.300 / 700 |
| 5 | 1.200 / 2.500 / 730 | 2.000 / 1.900 / 460 | 8.100 / 13.700 / 1.830 |

**HP da base por era:** 3.000 / 7.800 / 20.300 / 52.700 / 137.100

> Com essas contas, cada era pede uns 30 abates de unidade média, ou seja, 2 a 4 minutos por era. Os números são ponto de partida e vão ser ajustados jogando.

### 3.2 Torres

| Era | Barata (tiro único) | Rápida (rajada) | Pesada (splash) |
|---|---|---|---|
| 1 | Estilingue Gigante | Lança-Cocos | Catapulta de Pedra |
| 2 | Besta de Taquara | Arco Triplo | Caldeirão de **Açaí Fervente** |
| 3 | Canhãozinho | Bateria de Mosquetes | Morteiro |
| 4 | Metralhadora | Lança-Foguetes | Torre Dupla |
| 5 | Canhão Laser | Atirador de Titânio | **Canhão de Íons** |

| Arquétipo (era 1) | Custo | Dano | Recarga (s) | Alcance | Splash |
|---|---|---|---|---|---|
| Barata | 100 | 12 | 1.0 | 180 | – |
| Rápida | 200 | 6 | 0.35 | 160 | – |
| Pesada | 500 | 45 | 2.5 | 220 | 30 |

A mesma fórmula de escala por era das unidades vale aqui.

### 3.3 Especiais

| Era | Nome | Efeito |
|---|---|---|
| 1 | Chuva de Cocos | 15 cocos, 60 de dano cada |
| 2 | Chuva de Flechas | 30 flechas, 60 cada (× 2.6) |
| 3 | Bombardeio da Caravela | 8 balas de canhão com splash |
| 4 | Ataque dos Capiaviões | 3 aviões cruzam a tela soltando bombas |
| 5 | Raio da Laranja Sagrada 🍊 | Um laser varre o campo inimigo |

### 3.4 Bases

| Era | Base |
|---|---|
| 1 | Toca de Lama, um morro com cara de capivara |
| 2 | Castelo de Taquara |
| 3 | Forte Colonial |
| 4 | Bunker |
| 5 | Cidadela Cyber, com uma laranja gigante no topo |

Cada base tem **3 estados de dano** (100–66%, 66–33%, 33–0%).

---

## 4. IA inimiga

A IA é simples, baseada em orçamento e tempo, igual ao original.

| Dificuldade | Multiplicador de renda | Evolui no máximo a cada | Máx. unidades em campo |
|---|---|---|---|
| Fácil | 0.7× | 6 min | 8 |
| Normal | 1.0× | 5 min | 12 |
| Difícil | 1.4× | 4 min | 16 |
| Impossível | 2.0× | 3 min | 20 |

- A IA ganha ouro por segundo e por abate, os dois multiplicados pela dificuldade.
- Evolui por XP igual o jogador. Se ficar pra trás, evolui pelo tempo da tabela.
- **Escolha de unidade:** sorteio ponderado (corpo a corpo 50, distância 35, pesada 15).
  - Se o jogador tem mais unidades em campo, sobe o peso da pesada.
  - Se a base dela está abaixo de 30% de HP, gasta tudo de uma vez.
- Depois de 1 min, troca a torre por uma melhor quando sobra ouro.
- Usa o especial quando há 5 ou mais unidades do jogador na metade dela do campo.

---

## 5. Arte: pixel art "32 bits"

Interpretação de "32 bits": estilo GBA/Saturn, com paleta rica e sombreamento em 3–4 tons. **Não** é 32×32 fixo para tudo.

### 5.1 Especificação
- **Resolução:** lógica em **640×360**, desenhada em **1920×1080** (3×). Os sprites usam 1 pixel da tela por pixel da arte.
- **Mundo:** 1280 px de largura (duas telas) com câmera que rola na horizontal.
- **Paleta:** cada personagem tem paleta própria, a mesma em todos os quadros dele (sem piscar cor entre quadros).
- **Contorno:** 1 px em tom escuro colorido (marrom-escuro, nunca preto puro).
- **Luz:** vem de cima, à esquerda.
- **Animação:** quadro a quadro. Andar 4, ataque 4, nocaute 3. O andar troca de quadro pela distância andada.

| Elemento | Tamanho do frame |
|---|---|
| Unidades leves (corpo a corpo e distância) | 32×32 |
| Unidades pesadas (montarias, tanque, mecha) | 64×48 |
| Capivara Suprema | 64×64 |
| Torres | 32×32 |
| Bases | 96×128 |
| Projéteis | 8×8 a 16×16 |
| Ícones da HUD | 24×24 |

### 5.2 Design da capivara
- Silhueta em forma de **barril**, cabeça quadradona, orelhinhas e **olhos sonolentos semicerrados**. É a expressão da capivara que nada abala.
- Corpo em 4 tons de marrom.
- **Cor de clã** só em acessórios (bandana, capa, pintura). São exatamente essas cores que a troca de paleta substitui.
- **Truque de produção:** todas as unidades leves usam o **mesmo corpo base animado**. Por era só muda o equipamento (chapéu, arma, roupa). Isso corta muito o trabalho de animação.

### 5.3 Lista de sprites

| Asset | Qtd. | Animações | Frames |
|---|---|---|---|
| Unidades | 16 | andar 4, atacar 4, idle 2, deitar/zzz 4 | 224 |
| Torres | 15 | idle 1, tiro 3 | 60 |
| Bases | 5 | 3 estados de dano | 15 |
| Projéteis | ~15 | 1–2 | ~25 |
| Efeitos dos especiais | 5 | 4–6 | ~25 |
| Partículas (poeira, fumaça, faísca, folhas, "zzz") | 6 | 3–4 | ~20 |
| Fundos (3 camadas de parallax por era) | 5 | – | 15 |
| UI (ícones, botões, barras, fonte bitmap) | ~50 | – | ~50 |
| **Total** | | | **~430 frames** |

**Ferramentas:**
- Aseprite (pago, ou compilado de graça) ou Pixelorama (grátis, roda no navegador).
- Exportar como **sprite sheet + JSON**, e o jogo lê esse JSON direto.

**Ideias de fundo por era:**

| Era | Fundo |
|---|---|
| 1 | Pantanal pré-histórico |
| 2 | Floresta com castelo |
| 3 | Litoral com caravelas |
| 4 | Cidade com Marginal Pinheiros (as capivaras de SP 😄) |
| 5 | Metrópole neon |

---

## 6. Áudio
- **Efeitos sonoros:** gerados no [jsfxr](https://sfxr.me) (grátis, estilo retrô). São uns 20: tiro, golpe, explosão, "zzz", moeda, evoluir, clique, vitória, derrota.
- **Música:** composta no [BeepBox](https://www.beepbox.co), com uma faixa curta em loop por era mais uma do menu. Exportar em `.ogg` mono a 64 kbps.
- Tudo via **Web Audio API**, com os buffers decodificados uma única vez.
  - Limite de 3 instâncias simultâneas do mesmo som, pra não estourar o volume com 10 mosqueteiras atirando juntas.

---

## 7. Arquitetura técnica

**Zero dependências:** JavaScript puro (ES modules) com Canvas 2D. Phaser e outros motores não se pagam aqui: nunca vão estar mais de ~80 sprites na tela.

```
capivara-of-war/
├── index.html          # canvas + menus em DOM (iniciar, pausa, fim)
├── src/
│   ├── main.js         # loop, estados (menu/jogo/pausa/fim), input
│   ├── data.js         # eras, unidades, torres, especiais, IA (tudo tabela)
│   ├── battle.js       # unidades, projéteis, combate, economia, IA
│   ├── render.js       # atlas, desenho, câmera, HUD, partículas
│   └── audio.js        # Web Audio
└── assets/
    ├── atlas.png + atlas.json
    ├── sfx/*.ogg
    └── music/*.ogg
```

- **Rodar local:** `npx serve`, ou a extensão Live Server do VS Code. Não precisa de build.
- **Publicar:** GitHub Pages ou itch.io (é só zipar a pasta).

### Controles
| Ação | Mouse/toque | Teclado |
|---|---|---|
| Treinar unidade | Botão na HUD | `1` `2` `3` `4` |
| Torres | Botão na HUD | `T` |
| Especial | Botão | `Espaço` |
| Evoluir | Botão | `E` |
| Rolar câmera | Arrastar ou encostar na borda | `←` `→` / `A` `D` |
| Pausa | Botão | `Esc` / `P` |

Pointer Events cobrem mouse e toque com o mesmo código.

---

## 8. Desempenho (o que deixa o jogo leve de verdade)

1. **Render em baixa resolução.** O canvas tem 640×360 e o CSS amplia com `image-rendering: pixelated`. A GPU faz o upscale de graça, e isso sozinho já é o maior ganho.
2. **Um único atlas PNG**, com `drawImage` em coordenadas inteiras e `imageSmoothingEnabled = false`. Não tem troca de textura nem borrão.
3. **Fundo pré-renderizado.** As camadas de parallax são desenhadas uma vez por era num `OffscreenCanvas`. Por frame são só 3 `drawImage`.
4. **Troca de paleta feita no carregamento.** A versão inimiga do atlas é gerada uma vez via `ImageData`, sem nenhum filtro em tempo real.
5. **Passo fixo:** lógica a 60 Hz com acumulador, render no `requestAnimationFrame`. Com a aba escondida (`visibilitychange`), o jogo pausa e não gasta CPU.
6. **Zero alocação no loop.** Pools de objetos para unidades, projéteis e partículas. Sem `.filter`/`.map` por frame: remoção por swap-remove e nada de closures no caminho quente.
7. **Combate em O(n).** O alvo é sempre a unidade inimiga da frente e o bloqueio é sempre o aliado da frente. Não existe busca de vizinhos.
8. **HUD no canvas com fonte bitmap.** Os números (ouro, XP) só são redesenhados quando mudam: um canvas da HUD fica em cache e só é refeito quando está "sujo".
9. **Tetos de quantidade:** 20 unidades por lado, 100 projéteis, 150 partículas. Quando lota, a partícula mais velha é reciclada.
10. **Orçamento de download:** JS < 50 KB, atlas < 500 KB, áudio < 1.5 MB. **O total fica abaixo de 2 MB.**

**Meta:** 60 fps estáveis em notebook fraco e celular intermediário. Medir com a aba Performance do Chrome e com um contador de fps embutido, ligado na tecla `F3`.

### Esqueleto do tick de combate (referência)
```js
for (const u of myUnits) {
  const foe = enemyFront ?? enemyBase;               // alvo é sempre o da frente
  if (dist(u, foe) <= u.range) attack(u, foe, dt);
  else if (u.ahead && dist(u, u.ahead) < SPACING) u.state = IDLE;
  else u.x += u.dir * u.speed * dt;
}
```

---

## 9. Roadmap

### M0 - Protótipo cinza (≈1 fim de semana)
- [x] Canvas 640×360 escalado, loop de passo fixo e câmera rolando
- [x] Unidades como retângulos coloridos: andar, parar, atacar, morrer
- [x] Duas bases com HP, ouro e botão de treinar
- [x] IA burra que spawna em timer
- **Pergunta-chave:** já é divertido com quadrados? Se não for, mexer nos números antes de desenhar qualquer coisa.

### M1 - Jogo completo em quadrados
- [x] `data.js` com as 5 eras, XP e evolução
- [x] Fila de treino com 5 vagas
- [x] Torres e slots, compra e venda (era 1)
- [x] Especiais (por enquanto todos são chuva; o visual de cada um vem no M3)
- [x] IA com dificuldades
- [x] Vitória/derrota e recordes
- [ ] Balanceamento: dá pra jogar do começo ao fim

### M2 - Arte e som da era 1
- [x] Animações quadro a quadro dos dois clãs (andar, ataque, nocaute)
- [x] Unidades, torres, base e fundo da era 1 (fundo e base inimiga ainda vão ser refeitos)
- [x] Atlas único por era
- [x] Efeitos sonoros e música (gerados no navegador)

### M3 - Arte das eras 2 a 5
- [x] Era 2 (Medieval): unidades animadas, torres, Castelo de Taquara e fundo, nos dois clãs
- [x] Eras 3, 4 e 5 (Navegações, Moderna e Futuro), com fundo, base, torres e unidades animadas nos dois clãs
- [x] Base e torres do Clã do Pântano desenhadas de propósito (sem recolorir)
- [x] Capivara Suprema animada nos dois clãs
- [x] Projéteis e especial com cara de cada era (pedra, flecha, bala de canhão, bala, laser)

### M4 - Polimento
- [ ] Menus, pausa, volume e tela cheia
- [ ] Screenshake leve, flash de dano, fumacinha do "zzz"
- [ ] Teste de desempenho em máquina fraca
- [ ] Deploy (GitHub Pages ou itch.io)

### Depois (só se bater vontade)
- Modo infinito com ondas
- Upgrades permanentes entre partidas
- Conquistas ("Pacifista": vença sem usar especial)
- Modo "Capivara Zen": a IA não ataca e você só fica olhando 🦫♨️

---

## 10. Riscos

| Risco | Mitigação |
|---|---|
| A arte é o gargalo (~430 frames) | Corpo base reaproveitado, troca de paleta no inimigo, jogo 100% jogável em quadrados antes da arte |
| Balanceamento | Todos os números vivem em `data.js`, com fórmulas por era (mexe num multiplicador e ajusta tudo) |
| Escopo crescer | O original não tinha nada além disso. O que não está em M0–M4 vai para "Depois" |
