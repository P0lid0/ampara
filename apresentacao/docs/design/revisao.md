# Revisão de direção de arte: página de apresentação do Ampara

Data: 16/11/2026. Escopo: `apresentacao/` (index.html, css/style.css, js/main.js, img/, fonts/).
Skill usada: `design-taste-frontend`, parte de revisão (lint, inspector em 1440, 768 e 390 px, crítica de 14 passes sobre os prints).
Só revisão: nenhum arquivo da página foi alterado.

Medição: `lint.mjs` 0 FAIL 0 WARN. `inspect.mjs` 0 FAIL, 1 WARN (sem vídeo). Hero com 2 linhas nos três larguras (144 / 76 / 36 px). 13,4 telas de altura, 1586 palavras, 13 imagens (3 fotos distintas, 4 telas do sistema), mídia do hero ocupa 14% da primeira tela.

## Resumo em cinco linhas

1. A página é competente e honesta, mas **não parece o Ampara**: usa verde-floresta + lima + Bebas Neue em caixa alta + Garamond. O app e a marca são petróleo, esmeralda, areia e Manrope. Quem vê o vídeo do app e depois a página vê dois produtos.
2. O desenho é de "cartaz de show" (caixa alta condensada, zigue-zague de recibo, cartão inclinado). Contradiz o tom pedido: calmo, direto, confiável.
3. A coisa que só o Ampara tem, **o alarme vermelho que escala em 60 segundos para o próximo guardião**, não aparece na página. O vermelho só existe nos pontinhos de "sem resposta".
4. O conteúdo está **desatualizado em relação ao repositório**: diz que o app e a página de emergência "só existem como README", mas há 14 prints reais do app em `app/docs/prints/` (inclusive `11-alarme.png` e `12-passo-a-passo.png`). A página mostra um desenho de chaveiro e um esboço com `--:--` no lugar deles.
5. A "coisa viva" da página é um ping de saúde dos servidores. É ferramenta de quem apresenta, não ideia do produto, e ocupa a primeira tela mostrando três "sem resposta" para quem abrir fora da máquina da demo.

## Crítica (formato da skill)

```
ROUND 1
Seen in one second: a headline em caixa alta enorme sobre cartão claro. Depois, a foto em preto e branco da plataforma.
Idea (one sentence): hoje, "a ficha/recibo de ocorrência" vira o cartão da página (zigue-zague, linhas pontilhadas). Passa no teste do concorrente? Não: qualquer app antifurto poderia usar um recibo.
Live thing: ping de saúde dos três serviços (verificando / respondendo / sem resposta). Fraco: é do apresentador, não do usuário.
Layout words by section: hero=split cartão / problema=split+lista / faixa=full-bleed / como=grade 4 colunas (7 itens) / estado=split lista+cartões / demo=split abas / segurança=split sticky+folha / equipe=3 cartões iguais+ODS / cta=split / rodapé=cartão+palavra gigante
Scores: design 6,8 · usability 7,2 · creativity 6,5 · content 7,5 → overall 6,9
Caps applied: nenhum aplicado. Risco de teto 6,5 em design: as 30+ linhas pontilhadas (leader rows) leem como régua decorativa. Risco de teto 5 em content: o esboço com "--:--" é placeholder visível, e já existe print real para trocar.
```

Notas equivalentes às da skill de revisão mobile: nenhuma foi calculada aqui (esta é a revisão de página). Para a comparação com o app, ver o relatório de `mobile-design-review`.

## 1. O que já funciona (manter)

- **A headline.** "Levaram seu celular. Não levam o resto." Duas linhas, sete palavras, específica, cabe em 390 px. Logo abaixo, "Ele não bloqueia o celular" diz com franqueza o limite do produto. É a melhor frase da página; não mexer.
- **Honestidade como assinatura.** Cada parte tem estado marcado: "Roda hoje", "Em construção", "Só planejado", com data e contagem de testes. A "Folha de segurança" lista os próprios limites ("dívida", "decisão"). Para uma banca e para um público desconfiado, isso é credibilidade rara. É o ativo de conteúdo mais forte.
- **Regra de imagem clara.** Fotos de lugar em preto e branco, capturas do sistema em cor, e a página diz isso. Uma regra visual explicada vale mais que dez fotos.
- **Fotografia específica.** Pinheiros, Linha 9, Avenida do Estado: lugares reais do caso, com crédito e licença no rodapé e em `img/credits.json`.
- **Escala do número.** "30–90" e "13" em tamanho enorme, no lugar de gráfico inventado. O salto de escala entre corpo (20 px) e display (144–240 px) é decisivo.
- **Sem os tells baratos.** Nada de gradiente, sombra em repouso, eyebrow, mono, numeração 01/02, vidro, emoji, ícone em cartão. Passou no lint sem ressalva.
- **Fechamento do rodapé.** O nome "Ampara" em largura total é um fecho desenhado, não um mapa de site.
- **Acessibilidade de base.** Link de pular, foco de 4 px, alvos de 44 a 48 px, `aria-live` no estado dos serviços, `prefers-reduced-motion` tratado, fontes locais (a página roda offline).
- **Demo com abas e capturas reais** (`painel-vermelho.png`, Scalar, Swagger, painel da polícia): mostra o que roda, sem maquete.

## 2. Os "tells" de página genérica

Ordem: o que mais denuncia primeiro.

1. **Tudo em caixa alta condensada (Bebas Neue).** `h1`, `h2`, títulos de cartão, botões, o link de pular. É a fonte de cartaz que os geradores adoram, e grita. O tom do Ampara é o de quem fala baixo e firme com alguém em pânico. Hoje a tipografia faz o oposto. Duas famílias (Bebas + Garamond) e nenhuma é a da marca.
2. **Paleta fora da marca.** `--bg #0f1f10`, `--accent #c6f19d` (lima), faixas alternadas preto / verde-escuro / branco / papel. Nenhuma é petróleo, esmeralda ou areia. O lima + verde-floresta é, hoje, o "visual de ferramenta de dev". A alternância de cores não segue lógica (não conta nada do produto).
3. **Fantasia de recibo.** Zigue-zague por `clip-path` em dois cartões (`.menu`, `.sheet`), cantos chanfrados no hero e no rodapé, cartão do CTA inclinado -2°. Efeito de "papel" aplicado a uma lista de estados e a uma lista de testes não conta nada: é ornamento. Uma ocorrência policial não é um recibo de lanchonete.
4. **Linha pontilhada como papel de parede.** O recurso `leader-row` (nome ..... valor) aparece em mais de 30 linhas: serviços, números, estado das partes, passo a passo. Numa vez é ideia; em trinta vira textura, e dilui o que é importante (a coluna de estado em "Estado de cada parte" some no meio dos pontos).
5. **Seis de nove seções são "split" (texto de um lado, cartão do outro).** Hero, problema, estado, demo, segurança, CTA. O ritmo vira o de um template.
6. **Três cartões iguais** ("O guardião / A polícia / O cidadão") com 300 px de altura, título no topo, texto empurrado para baixo e o miolo vazio. E quatro blocos de ODS com numerais gigantes e pouco texto. Dois momentos de "fileira de cartões" no fim da página.
7. **Grade de 4 colunas com 7 itens** em "Antes, durante e depois": a última linha tem 3 e um buraco. O corpo dentro das colunas fica pequeno (15 a 20 px em coluna estreita) e a legenda cinza também.
8. **A mesma foto quatro vezes.** `pinheiros-linha9.jpg` no hero, na faixa, no passo "O mapa avisa o risco" e no selo do rodapé. No passo do mapa ela não mostra o mapa. O `filter: grayscale(1)` aplicado por CSS uniformiza, mas também achata.
9. **Placeholders à vista.** O desenho do chaveiro (SVG lima num quadrado lima) e o "Passo a passo do guardião" com `--:--` e a nota "Esboço". Eles são honestos, mas existem prints reais para os dois.
10. **Hero com a mídia pequena e a ação no canto.** A foto ocupa 14% da primeira tela; o botão "Ver a demo" fica embaixo dela, no canto direito, enquanto o mesmo "Abrir a demo" já está na barra. No celular, o `h1` fica em 36 px por causa do `nowrap`, pequeno para um hero.
11. **Movimento único.** Um único "sobe 26 px e aparece" em tudo marcado com `data-rv`, desligado abaixo de 1101 px. CSS morto: `[data-print]` e `.slip .last` não têm marcação correspondente.

## 3. A ideia do sujeito: o que só o Ampara tem

Inventário (coisas que nenhum concorrente de "localizar celular" tem):

- A janela de **30 a 90 minutos** em que a vítima está sem aparelho e o criminoso entra nas contas.
- O **guardião**: uma pessoa, não um software. Recebe um alarme insistente e tem **60 segundos** para dizer "Estou ciente", senão o alerta escala para o próximo guardião (até 3).
- O **chaveiro** (ESP32) com um botão e uma luz: um clique no escuro, sem celular.
- O **passo a passo com horário**: Banco, Celular Seguro, Operadora, Senhas, BO, cada um carimbado quando alguém o faz, visível para os outros guardiões.
- A **franqueza**: "Ele não bloqueia o celular. Ele avisa quem pode."
- O **mínimo para a polícia**: área de cerca de 500 m, hora e tipo; sem CPF, nome nem IMEI.
- O **lugar**: Pinheiros, Linha 9-Esmeralda, Avenida do Estado.
- O **vermelho do alarme** (`#E5484D`), que na marca é sempre vermelho e nunca outra cor.

**Frase da ideia:** *Na página, os 90 minutos depois do roubo viram o relógio da página: uma linha do tempo de 0 a 90 em que cada passo (alarme, 60 segundos, banco, Celular Seguro, operadora, senhas, BO) cai no seu minuto, e o vermelho só existe no minuto zero.*

Teste do concorrente: um app de rastreio de celular não tem guardião, 60 segundos nem passo a passo com horário. A frase não serve a ele. Passa.

**A coisa viva, no lugar do ping de saúde:** "Simular o alarme". O visitante aperta o botão do chaveiro (o desenho que hoje está pequeno, em tamanho grande). A seção vira `#E5484D` de ponta a ponta, aparece o texto do print real ("Alerta: … precisa de ajuda", "Estou ciente") e uma contagem de 60 segundos (acelerada ou real, a escolher). Sem resposta, passa para o guardião 2. Ao tocar "Estou ciente", a seção volta ao normal e os cinco passos recebem horário. Regras: usa o conteúdo real do produto, funciona com o polegar no celular, tem fallback sem script (imagem do print 11 e texto), não bloqueia a leitura. O ping de saúde continua, mas como uma faixa discreta do apresentador no rodapé (ou visível só com `?apresentador`).

## 4. Mudanças de maior impacto

Em ordem de retorno. As três primeiras resolvem a maior parte do problema.

1. **Voltar para a marca: paleta e tipo.** Ajuda a página a parecer o app.
   - Cores: `--bg` e as faixas escuras passam a petróleo `#0F4C4A` (e um tom mais fundo dele no lugar do preto); papel `#F4EFE6` (areia) no lugar de `#f3f5ee`/branco; esmeralda `#14B88A` no lugar do lima para "roda hoje" e acentos; `#E5484D` reservado ao alarme e a erros de verdade. Conferir cada par de texto com o teste de contraste (esmeralda sobre petróleo é limítrofe para texto pequeno; usar areia para texto e esmeralda só para preenchimentos e números grandes).
   - Tipo: Manrope como única família (pesos 400, 600, 700, 800 locais em `fonts/`), sentença normal, sem caixa alta. Display em 700 ou 800 com entrelinha 0,95 a 1,05 e tracking levemente negativo. Isso tira o tom de cartaz e põe o de "gente de confiança falando". Manter a regra de duas linhas no `h1`.
   - Pontos de edição: `:root` (tokens), os três `@font-face`, `.display, h1, h2`, e os `font-family: "Bebas Neue"` repetidos em ~20 regras (trocar por um token `--display`).
2. **Pôr o alarme vermelho e o chaveiro no centro, com print real.** Trocar o SVG do chaveiro e o cartão "Esboço" por `11-alarme.png` e `12-passo-a-passo.png` (recortar a barra de status do Android). Construir a coisa viva da seção 3 numa seção própria logo depois do problema, em vermelho de largura total, com altura de tela. Hoje o produto não aparece na página; ele passa a ser a maior imagem da página.
3. **Atualizar o conteúdo ao que o repositório já tem.** "App, Expo: só existe o README", "Página de emergência: só existe o README", "Antes: só planejado, o app ainda não existe" e "A tela cheia depende do app" estão velhos. Verificar com o código (rotas em `app/src/app/`, `web-emergencia/src`) e atualizar os estados e a data de conferência. Pôr as telas reais do app (`10-inicio`, `11-alarme`, `12-passo-a-passo`, `18-checklist`) na seção "Como funciona" no lugar das fotos usadas como ilustração (a do passo "O mapa avisa o risco" não mostra mapa). A honestidade de estado é o ponto forte da página; ela só vale se o estado for o de hoje.
4. **Hero: uma coisa grande e uma ação.** Primeira tela = o `h1` + a frase de apoio + a mídia (foto de Pinheiros ou, melhor, o print do alarme ao lado do `h1`, ocupando perto de 40% da tela) + um único botão ("Ver a demo") logo abaixo da frase, não no canto. Tirar "Serviços locais" daqui. No celular, deixar o `h1` maior (quebra natural em duas linhas sem `nowrap`).
5. **Tirar o ornamento de recibo e a linha pontilhada em massa.** Remover o zigue-zague (`--zig24`, `--zig14`) e a inclinação do CTA. Manter o `leader-row` só onde há "nome ..... valor" de verdade e que o olho deva ler como par (os números do problema, por exemplo). Em "Estado de cada parte", trocar por uma tabela real de três colunas (parte, estado, o que roda) com o estado em esmeralda ("roda"), âmbar discreto ("em construção") e cinza ("planejado"), separados por diferença de tom e espaço, não por pontos.
6. **A linha do tempo de 0 a 90 como espinha da página.** Substituir a seção "Antes, durante e depois" (grade de 4 colunas com 7 itens e buraco) por uma sequência vertical no relógio: 0 min, o clique no chaveiro; 1 min, o alarme (print); 60 s, escala; 5 a 30 min, banco, Celular Seguro, operadora, senhas; depois, o BO e o que a polícia recebe. Cada passo com a captura que prova e a etiqueta de estado. Mantém todo o conteúdo e dá à página um ritmo próprio, diferente de "split, split, split".
7. **Acabar com as fileiras de cartões iguais do fim.** "Guardião / Polícia / Cidadão" vira uma coluna de três faixas largas, cada uma com um papel descrito em uma frase e um pedaço da tela do app em que aquela pessoa age (guardião: alarme; polícia: painel; cidadão: início). Os quatro ODS viram uma linha de texto de duas linhas com as metas, em vez de quatro blocos de 280 px com um numeral.
8. **Fotos: menos repetição, mais intenção.** Usar cada foto no máximo uma vez. Pinheiros no hero ou na faixa (não nos dois); Avenida do Estado ligada ao BO; integração Metrô-Linha 9 ligada ao "Antes". Tirar a foto do selo do rodapé. Se houver tempo, um clipe curto em loop mudo do próprio app (a tela do alarme sendo tocada, do `roteiro-video.md`), que resolve o único WARN do inspector com mídia honesta e do projeto.
9. **Ritmo de movimento com propósito.** Hoje é um único "sobe e aparece". Manter só nos blocos de leitura; no alarme, um movimento de verdade (a seção que se enche de vermelho, a contagem). Ligar também abaixo de 1101 px com `prefers-reduced-motion` respeitado. Apagar o CSS morto (`[data-print]`, `.slip .last`).
10. **Comprimento.** 13,4 telas para uma banca. Depois das mudanças 5 a 7, "Estado de cada parte" e "Folha de segurança" podem ficar em recolher/expandir (`<details>`) com o resumo visível ("4 partes rodam, 4 em construção, 2 planejadas"), em vez de paredes de texto de 15 px. A "Folha de segurança" é boa; mostrar os 13 ataques como número grande e os limites com destaque, e deixar a lista completa aberta por escolha do leitor.

## 5. O que não mexer

- A frase do `h1` e a de apoio; os rótulos de estado e as datas; a lista de limites conhecidos; os créditos das fotos; as capturas coloridas do sistema como prova; o link de pular, os alvos de toque e o `aria-live`.
- Marca: petróleo, esmeralda, areia, alarme sempre vermelho, Manrope, alvo mínimo de 48 dp (ajustar os 44 px da barra e do rodapé para 48 por consistência) e contraste de 4,5:1 (rodar `web-painel-risco/src/contraste.test.ts` como referência dos pares; a página não tem teste próprio, vale criar um pequeno quando os tokens mudarem).

## 6. Ordem sugerida se faltar tempo (entrega 19/11, 23h55)

1. Paleta e tipo da marca (mudança 1): a que mais muda a primeira impressão.
2. Trocar o chaveiro SVG e o esboço pelos prints reais e atualizar os estados (mudanças 2 e 3, sem a simulação viva).
3. Hero com uma ação e sem "Serviços locais" (mudança 4).
4. A simulação "Simular o alarme" (parte da 2) e a linha do tempo (6), se sobrar tempo.
5. As mudanças 5, 7, 8 e 10 são limpeza e podem entrar em seguida.

## 7. Como esta revisão foi feita

- `lint.mjs` sobre `index.html`, `css/` e `js/`; `inspect.mjs` em 1440, 768 e 390 px por servidor local temporário da própria skill (nenhum servidor ficou rodando).
- Prints lidos: primeira tela e três folhas no desktop, primeira tela no celular. As folhas do tablet e do celular, além da primeira tela, não foram lidas uma a uma: os achados de celular vêm da primeira tela e do CSS.
- A página não foi aberta com os serviços de `localhost` no ar, então o estado "respondendo" só foi visto no print do celular, onde o painel respondeu e os outros dois não.
- Não foi rodada a etapa de movimento nem medida a contagem de elementos que se mexem; o julgamento de movimento vem do CSS e do JS.
