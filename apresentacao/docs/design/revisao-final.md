# Revisão final da página de apresentação (17/11/2026)

Escopo: `apresentacao/`. Skill: `design-taste-frontend` (lint, inspector em 1440, 768 e 390 px, olhar os prints). Parte de `revisao-depois.md` (achados 1 a 8). Prints em `final/` (`antes-*` e `depois-*`: primeira tela nas três larguras e a folha 2 do desktop, onde fica a linha do tempo).

## Medição

| | antes | depois |
|---|---|---|
| `lint.mjs` | 0 FAIL, 0 WARN | 0 FAIL, 0 WARN |
| `inspect.mjs` | 0 FAIL, 4 WARN | 0 FAIL, 2 WARN (areia da marca; sem vídeo, achado 8) |
| tamanhos de fonte (1440) | 14: 14, 16, 17, 18, 22, 24, 26, 28, 32, 34, 49, 66, 101, 230 | 7: 16, 18, 24, 48, 64, 100, 230 |
| margens em 1440 | 40 px à esquerda, 58 px à direita | um par só, sem aviso |
| mídia do hero na primeira tela | 17% | 25% |
| h1 (1440 / 768 / 390) | 66 / 64 / 35 px | 64 / 48 / 36 px |
| `contraste.test.mjs` | 16 de 16 | 17 de 17 (um par novo, ver notas) |

## Por achado

1. **Hero.** O print do alarme é recortado em três faixas de fundo liso (barra e título, bloco de texto, botão) e coladas; o vermelho sem conteúdo cai de cerca de 55% para cerca de 25% do recorte (`img/app-alarme.webp`, 720x873 em vez de 720x1467). O painel petróleo agrupa a frase, a legenda e o celular, que sobe e fica rente ao pé e à margem direita. No celular (390 x 844) a frase e o texto do alarme ("Ana SINTETICO precisa de ajuda") aparecem dentro da primeira tela; antes só havia vermelho abaixo da dobra. A tela usa o print novo do app (`11-alarme.png`).
2. **Linha do tempo.** Três marcos em escala (0 s, 60 s e 90 min a 100 px); "0 s" da API a 48 px; "Antes", "minutos", "depois" e "prevenção" a 24 px, como palavras. Cada print termina em fronteira de bloco: cartão Banco Inter, cartão do chaveiro, grupos de rotas da API, alarme com botão, cartão Banco do passo a passo, mapa com "Relatar aqui", mapa de hotspots, página de emergência até "Gerar o BO". Largura e altura variam por passo (240 a 520 px), com mais espaço para 60 s e para o BO. A etiqueta em caixa tingida virou losango cheio (roda) ou vazado (em construção) mais a palavra, sem fundo.
3. **Margens.** Margem externa única (`--m`), phone do hero e prints da linha do tempo alinhados à margem direita; no tablet, os parágrafos de abertura vão até a margem. Sem aviso `off-centre` em 1440 e 768.
4. **Escala de tipo.** Tokens fixos por faixa de tela (>1100, até 1100, até 560) no lugar de `clamp` e de valores soltos; 16 e 17, 22 e 24, 26 e 28, 32 e 34 colapsados.
6. e 7. **Texto de informação em 16 px ou mais.** Legendas, "dados sintéticos", créditos, linha de dados do hero, rótulos de tabela e acordeão, etiqueta "Roda" na tabela: 14 vira 16. A legenda do "13" sobe de 18 para 24 px.

## Notas

- Prints novos recortados por `scripts/preparar-midia.py` (agora com faixas coladas e recortes web `web-rota`, `web-policia-mapa` e `web-api-grupos`); rode de novo se os prints do app mudarem. A página de emergência usa o print inteiro de `antes/` porque o de `depois/` é só a janela de 390x844 com rodapé fixo.
- Cores: o apoio escureceu de `#3D6563` para `#2F5755` (aviso de texto cinza) e o texto de atenção de `#8A5A00` para `#7A4F00` (4,4 para 5,4:1 sem a caixa). Marca intacta. Par novo no teste: atenção sobre areia escura.
- `.s-list details:not([open]) dl{display:none}`: o inspector lia o texto de um acordeão fechado como rótulo de título ("ataque A05").
- Simulação (JS) intocada; conferi no navegador que o chaveiro dispara o alarme e a contagem corre.
- Console e nome do rodapé (achados 9 e 10), o recorte legível do painel de risco no "Demo ao vivo" (achado 5, só na linha do tempo) e o clipe de vídeo (achado 8) ficaram de fora.
