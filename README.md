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
- **Conquistas:** 15 pra desbloquear, salvas no navegador.

## Controles

- `1` `2` `3` `4` treinam unidades (o `4` só na última era)
- `T` alterna entre unidades e torres (no modo torres, `4` compra vaga)
- `E` evolui de era quando a barra de XP enche
- `Espaço` solta o especial
- `←` `→` / `A` `D` / arrastar movem a câmera
- `M` liga e desliga o som
- No menu: `I` troca o modo, `C` abre as conquistas, `L` troca o idioma
- `P` / `Esc` pausa
- `F3` mostra o fps
