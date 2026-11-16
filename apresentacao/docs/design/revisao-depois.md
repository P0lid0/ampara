# Revisão independente depois da refação: página de apresentação do Ampara

Data: 16/11/2026. Escopo: `apresentacao/` (index.html, css/style.css, js/main.js, img/, fonts/). Só leitura: nenhum arquivo da página foi alterado.
Skill usada: `design-taste-frontend`, parte de revisão (lint, inspector em 1440, 768 e 390 px, crítica de 14 passes sobre os prints). Comparada com `revisao.md` (antes: 6,9).

## Medição

- `lint.mjs`: 0 FAIL, 0 WARN.
- `inspect.mjs`: 0 FAIL, 4 WARN. Antes: 0 FAIL, 1 WARN.
  - `palette-cream` (#f4efe6): é a areia da marca. Defensável, sem ação.
  - `size-count`: 14 tamanhos de fonte (14, 16, 17, 18, 22, 24, 26, 28, 32, 34, 49, 66, 101, 230 px). A skill pede cerca de 5. Real, ver achado 4.
  - `no-footage`: continua sem vídeo.
  - `off-centre`: margens de 40 px à esquerda e 58 px à direita em 1440. Real, ver achado 3.
- Hero com 2 linhas nas três larguras (66 / 64 / 35 px). Antes: 144 / 76 / 36 px, em caixa alta. O h1 ficou menor em desktop; a força vem do peso e do print ao lado, não do tamanho.
- 13,9 telas de altura (antes 13,4), 1527 palavras (antes 1586), 18 imagens (antes 13), mídia do hero 17% da primeira tela (antes 14%).
- Movimento: 60 elementos se mexem (o inspector exige 8 e avisa abaixo de 16), 54 marcados com `data-rv`, `prefers-reduced-motion` tratado em CSS e JS.
- `node --test apresentacao/tests/contraste.test.mjs`: 16 de 16 passando.
- Simulação exercitada no navegador (1440): "Acelerar 6x", apertar o chaveiro, Marina e Paulo viram "sem resposta" riscado, Helena fica com o alarme tocando, "Estou ciente" troca o campo de vermelho para petróleo, mostra "Helena assumiu o alarme em 24 s" e libera o passo a passo com "Marcar como feito". Os botões têm `aria-label`.
- Console: 8 a 19 erros de rede por carregamento, que são os pings de saúde a localhost (API 5080, Ponte 8000, painel 5174) sem os serviços no ar. Esperado, mas sujo se a banca abrir o console.

## Crítica (formato da skill)

```
ROUND 1 (depois)
Seen in one second: a headline em Manrope pesada sobre areia e, ao lado, um painel petróleo com um celular vermelho. O vermelho puxa o olho primeiro, que é o certo.
Idea (one sentence): o relógio dos 90 minutos depois do roubo vira a espinha da página, e o alarme de 60 segundos vira uma seção vermelha de largura total que o visitante dispara.
Live thing: "Simular o alarme" (chaveiro, contagem de 60 s, escada de 3 guardiões, "Estou ciente", passo a passo carimbado). Forte: usa conteúdo real do produto e tem o print como alternativa sem script.
Layout words by section: hero=split / alarme=full-bleed vermelho, 3 colunas / problema=split+lista de números / foto=full-bleed / 90 min=lista de 7 linhas iguais / estado=split+tabela / demo=split abas / segurança=split+acordeão / equipe=3 faixas largas / cta=split esmeralda / rodapé=linhas
Scores: design 7,6 · usability 7,7 · creativity 8,4 · content 8,5 → overall 7,9
Caps applied: nenhum. Risco de teto 6,5 em design pelo chão vazio no hero (achado 1); não aplicado porque a primeira tela se sustenta no h1 e no botão.
```

Subida de 6,9 para 7,9: design 6,8 para 7,6, usability 7,2 para 7,7, creativity 6,5 para 8,4, content 7,5 para 8,5. O maior ganho está em creativity: a página deixou de ser genérica e passou a ter a ideia que a revisão anterior escreveu (frase da ideia, coisa viva, vermelho só no alarme). Passes 3 e 14 passam: nenhum app de rastreio tem guardião, 60 segundos e passo a passo carimbado. Fica abaixo de 8 por causa do hero e da linha do tempo (achados 1 e 2).

## O que a refação resolveu (dos 11 tells de `revisao.md`)

1. Caixa alta condensada: resolvido. Manrope única, sentença normal.
2. Paleta fora da marca: resolvido. Petróleo, petróleo fundo, areia, areia escura, esmeralda. O vermelho só aparece no alarme (hero, seção da simulação, rótulo "60 s" e a faixa "Risco alto" que é print).
3. Recibo e zigue-zague: resolvido.
4. Linha pontilhada em massa: resolvido. "Estado de cada parte" virou tabela de três colunas com etiquetas "Roda", "No repositório", "Parcial", "Em preparo".
5. Seis de nove seções "split": melhorou (alarme full-bleed, foto full-bleed, equipe em faixas, tabela), mas ainda há splits seguidos no meio (estado, demo, segurança).
6. Três cartões iguais e ODS: resolvido. Guardião, polícia e cidadão viraram faixas largas com o pedaço de tela de cada um.
7. Grade de 4 colunas com 7 itens e buraco: resolvido. Virou lista vertical no relógio.
8. A mesma foto quatro vezes: resolvido. `pinheiros-linha9.jpg` aparece uma vez, em largura total.
9. Placeholders: resolvido. O esboço com `--:--` e o SVG lima saíram; o chaveiro desenhado virou a peça interativa, com legenda franca ("Ainda não há foto do protótipo").
10. Hero com mídia pequena e ação no canto: resolvido. "Simular o alarme" fica logo abaixo da frase de apoio, e "Serviços locais" saiu do hero.
11. Movimento único e CSS morto: parcial. Há movimento em 60 elementos e uma simulação de verdade; não conferi se `[data-print]` e `.slip .last` foram apagados.

Mantido o que a revisão pediu para preservar: o h1, a frase de apoio, os rótulos de estado com data de conferência (16/11), a lista de limites, os créditos da foto e a honestidade como assinatura.

## Achados que ainda ficam (ordem de impacto)

1. **Hero: o painel direito tem mais chão do que conteúdo, e o print está mal recortado.** (`desktop-fold.jpg`, `tablet-fold.jpg`, `mobile-fold.jpg`) O print do alarme é a tela cheia vermelha, e o recorte deixa cerca de 55% do topo do celular em vermelho liso; o texto do alarme só começa na metade. A frase "60 segundos para o guardião dizer..." fica solta no alto do painel petróleo, com um vazio grande entre ela e o celular, e a legenda encosta no pé. No celular, o print só começa na borda inferior da primeira tela (botão a 340 px, celular a 600 px): o que se vê dele é uma massa vermelha sem texto. Correção: recortar o print para começar perto do título do alarme, subir o celular, juntar frase e legenda ao mesmo bloco e, no celular, trazer o texto do alarme para dentro da primeira tela.
2. **Linha do tempo: sete linhas com a mesma composição.** (`desktop-page-02.jpg`) Rótulo de tempo à esquerda, texto no meio, etiqueta de estado, print à direita, de "Antes" a "prevenção". A ideia do relógio é boa; a execução vira lista. Os prints são cortados no meio de um elemento (o passo "Banco", o "Como testar", o BO), o que lê como recorte acidental. As etiquetas "Roda hoje" repetidas em caixa tingida viram padrão. Os rótulos "minutos", "depois" e "prevenção" são palavras no mesmo tamanho de "0 s" e "90 min", e a régua do relógio perde escala. Correção: variar a altura (60 s e o BO merecem mais espaço), terminar cada recorte em fronteira de bloco, reduzir a etiqueta de estado a ponto mais palavra e dar ao minuto zero um destaque de escala.
3. **Margens desiguais em 1440 px: 40 px à esquerda, 58 px à direita** (WARN `off-centre`). Alinhar hero, painel e navegação ao mesmo par de margens.
4. **14 tamanhos de fonte.** 16 e 17, 22 e 24, 26 e 28, 32 e 34 diferem sem razão. Cerca de sete passos (14, 16, 20, 28, 34, 66, 101, mais o número de 230) deixam a página mais firme.
5. **Prints de painéis web ilegíveis no tamanho em que aparecem.** (`desktop-page-02.jpg` à direita, `desktop-page-03.jpg` no meio) Scalar, painel da polícia e painel de risco entram com 280 a 330 px de largura e o texto interno fica em 5 a 7 px. São prova de que a coisa existe, mas a prova só vale se lida. Recortar a parte útil (a faixa "Risco alto 75/100", o mapa com pontos) em escala maior, em vez do viewport inteiro.
6. **Meio da página denso e pequeno.** Tabela de estado, acordeão de segurança e legenda do "13" em 14 px, e três splits seguidos (estado, demo, segurança). O "13" é bom; a legenda deveria subir para cerca de 20 px, e o texto da tabela e do acordeão para 16 px.
7. **Texto auxiliar pequeno demais onde é informação.** A linha "Global Solution FIAP, tema CitizenTech..." sob o botão, as legendas dos prints e "Tudo aqui é demonstração" (14 px). Passam no contraste, mas a de "dados sintéticos" precisa ser lida pela banca: 16 px.
8. **Ainda sem clipe de vídeo** (WARN `no-footage`). A tela do alarme em loop mudo (do `roteiro-video.md`) no hero ou na simulação resolveria e mostraria o produto em movimento.
9. **Rodapé perdeu o fecho.** A revisão anterior elogiava o nome em largura total. Hoje é uma linha de links, três linhas de nota e a faixa de serviços, depois de um CTA esmeralda que funciona bem. Devolver o nome "Ampara" em largura total.
10. **Console sujo.** Erros de rede dos pings de saúde quando os serviços não estão de pé. Capturar sem logar, ou consultar só com `?apresentador`.

## Passes da skill

- **1 s / 5 s:** passa. Dá para dizer o que é (celular roubado, aviso a quem pode bloquear as contas) e o que fazer (botão verde).
- **2 Squint:** três massas claras no hero (h1, botão verde, celular vermelho).
- **3 Cobrir o logo:** passa.
- **4 Bordas:** três bordas de texto reaproveitadas; margem direita desigual (achado 3).
- **5 Espaço e quadro:** em "30 a 90 minutos" a metade inferior esquerda fica vazia ao lado da pilha de números, perto de meia tela em 1440.
- **6 Tipo:** salto decisivo (16 a 230 px nos números); passos demais (4).
- **7 Cor:** areia como chão, petróleo como contraste, esmeralda em ação e carimbo, vermelho só no alarme. O CTA final em esmeralda cheio é o único campo grande de esmeralda e fecha bem.
- **8 Imagens:** 18 imagens, a foto única em preto e branco e as capturas em cor seguem a regra. Um clipe falta.
- **9 Sameness:** linha do tempo com sete linhas iguais; estado, demo e segurança em split seguidos.
- **10 Celular:** composição própria na maior parte (h1 em 35 px, 2 linhas, menu, sequência vertical), mas o hero perde o celular na primeira tela.
- **11 Fullness:** hero com chão vazio (achado 1); no resto cada tela tem algo dominante.
- **12 Substância:** completa (estado por parte com data, 13 ataques, limites, equipe, demo com links).
- **13 Colisões:** nada sobre títulos; o inspector não acusou overflow nos três larguras.
- **14 Concorrente e coisa viva:** passa nos dois. A coisa viva é o melhor da página.

## Ordem sugerida (entrega 19/11, 23h55)

1. Hero: recorte do print, painel direito, margens iguais, celular na primeira tela do celular (1 e 3).
2. Prints dos painéis web recortados em escala legível (5) e texto da tabela e do acordeão a 16 px (6, 7).
3. Linha do tempo: variar altura, recortes que terminam em fronteira de bloco (2).
4. Escala de tipo (4), nome do rodapé em largura (9), console limpo (10).
5. Clipe curto do alarme em loop mudo (8), se sobrar tempo.

## Como esta revisão foi feita

- `lint.mjs` sobre `index.html`, `css/` e `js/`; `inspect.mjs` em 1440, 768 e 390 px; prints lidos: primeira tela e três folhas do desktop, primeira tela e duas folhas do celular, primeira tela do tablet.
- `http.server` em 127.0.0.1:5181 só para exercitar a simulação e ver o rodapé; parado ao fim pelo PID.
- Simulação (Acelerar 6x, chaveiro, escada, Estou ciente) executada e vista em screenshot em 1440 px. Não testei os atalhos `?apresentador`, o modo sem JavaScript, nem a simulação em 390 px.
- Não li uma a uma as folhas do tablet além da primeira tela, nem o CSS morto.
