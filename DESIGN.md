---
name: Ampara (superfícies web)
description: Proteção calma e firme para quem acabou de perder o celular e para o parente que recebe o alarme.
colors:
  petroleo: "#0F4C4A"
  petroleo-pressionado: "#0B3B39"
  esmeralda: "#14B88A"
  areia: "#F4EFE6"
  areia-escura: "#E4DDCF"
  branco: "#FFFFFF"
  tinta: "#12201F"
  texto-apoio: "#3D6563"
  alarme: "#E5484D"
  alarme-texto: "#B3202A"
  sobre-alarme: "#111111"
  ambar: "#F2B84B"
  amarelo-texto: "#8A5A00"
  fundo-ok: "#EAF6F1"
  fundo-atencao: "#FFF6DB"
  fundo-alerta: "#FDECEC"
typography:
  display:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  titulo:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.2
  secao:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
  corpo:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  rotulo:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.3
rounded:
  controle: "8px"
  cartao: "12px"
  bloco: "16px"
  pilula: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  botao-primario:
    backgroundColor: "{colors.petroleo}"
    textColor: "{colors.areia}"
    rounded: "{rounded.controle}"
    height: "48px"
    padding: "0 24px"
  botao-primario-pressionado:
    backgroundColor: "{colors.petroleo-pressionado}"
  botao-secundario:
    backgroundColor: "{colors.branco}"
    textColor: "{colors.petroleo}"
    rounded: "{rounded.controle}"
    height: "48px"
  botao-alarme:
    backgroundColor: "{colors.alarme}"
    textColor: "{colors.sobre-alarme}"
    rounded: "{rounded.bloco}"
    height: "120px"
  campo:
    backgroundColor: "{colors.branco}"
    textColor: "{colors.petroleo}"
    rounded: "{rounded.controle}"
    height: "48px"
  cartao:
    backgroundColor: "{colors.branco}"
    textColor: "{colors.petroleo}"
    rounded: "{rounded.cartao}"
    padding: "16px"
  farol-seguro:
    backgroundColor: "{colors.esmeralda}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.bloco}"
    padding: "24px"
  farol-atencao:
    backgroundColor: "{colors.ambar}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.bloco}"
    padding: "24px"
  farol-alto:
    backgroundColor: "{colors.alarme}"
    textColor: "{colors.sobre-alarme}"
    rounded: "{rounded.bloco}"
    padding: "24px"
  faixa-de-marca:
    backgroundColor: "{colors.petroleo}"
    textColor: "{colors.areia}"
    height: "56px"
---

# Design System: Ampara (superfícies web)

Escopo: `web-emergencia/` (a vítima, no celular emprestado) e `web-painel-risco/` (a vítima ou o parente, olhando o risco). Mesma marca e mesma régua do app (`app/src/theme/tokens.ts`). Este documento é direção: nada aqui foi aplicado ainda ao CSS. As seções "Superfície" no fim dizem o que muda em cada `estilos.css`.

Método: `impeccable` (document, modo scan) a partir dos dois `estilos.css`, do `tokens.ts` do app e das duas críticas de 16/11 (`web-*/docs/design/critica.md`), com `ui-ux-pro-max` como consulta de sistema. Não houve entrevista; as escolhas qualitativas abaixo (norte criativo, referências) são minhas e o Pedro pode trocá-las.

## Overview

**Norte criativo: "A mão no ombro"**

Quem chega a estas telas está assustada, com pressa e quase sempre num aparelho que não é o seu. Quem recebe o alarme é um parente que só quer saber "ela está bem?". A interface precisa se comportar como uma pessoa calma que chegou perto: fala pouco, diz o que fazer agora, não levanta a voz a não ser quando a situação pede. O petróleo dá firmeza e confiança de instituição, a areia tira a frieza do hospital e do banco, o esmeralda diz "protegido", e o vermelho fica guardado para o único momento em que ele precisa gritar.

Hoje as duas telas são corretas e vazias (critica: 22/40 e 24/40; estética 1 e 2 de 4). Falta autoria: marca, hierarquia, um elemento dominante por tela, e um gesto próprio do Ampara (o guardião que protege; o dado que quase vazou e foi barrado). A direção é dar a cada tela **uma coisa grande e uma frase de orientação**, e rebaixar todo o resto.

Não é "startup": sem degradê, sem ilustração fofa, sem emoji, sem cartão com sombra flutuando, sem microcopy engraçadinha. Não é lúdico. Também não é policial: sem escudo militar, sem preto pesado, sem sirene decorativa.

**Key Characteristics:**
- Uma tarefa e um elemento dominante por tela; 20 segundos num celular alheio.
- Cor com função: petróleo = ação e texto, esmeralda = seguro, âmbar = atenção, vermelho = emergência e nada mais.
- Estado nunca só por cor: palavra e ícone junto, sempre.
- Frases curtas, no presente, sem jargão ("aba", "estado", "log", "CPF · registro do sistema").
- Acessibilidade como piso, não como extra: alvo ≥ 48 px, texto ≥ 16 px, contraste ≥ 4,5:1, foco visível, `prefers-reduced-motion`.

### Referências (o que tirar de cada uma)

1. **SOS de Emergência do iPhone (Apple)**: um gesto, uma contagem curta com cancelar claro, confirmação que diz o que aconteceu depois. Vale para o alarme e o sucesso do alarme (não copiar a estética, só o ritmo de decisão).
2. **Padrão Digital de Governo (gov.br)**: linguagem simples, passos numerados ("passo 2 de 3"), campos grandes e rótulos fora do campo, estados de erro que explicam. Vale para o fluxo avisar, marcar local e BO, e para a Delegacia Eletrônica que o usuário reconhece.
3. **Nubank (bloqueio de cartão no app)**: confirmação imediata e tranquilizadora depois de uma ação de crise, sem culpar o usuário, com o próximo passo na mesma tela. Vale para "Seus guardiões foram avisados" e para o farol do painel.
4. Só para a visão executiva: **painéis de resumo do Apple Saúde** (um número grande, uma frase de leitura, comparação com ontem). Referência de hierarquia, não de aparência.

## Colors

Paleta enxuta de quatro cores de marca mais neutros quentes; esmeralda e vermelho são raros, por isso funcionam.

- **Petróleo `#0F4C4A`**: texto principal, faixa de marca, botão primário, bordas de campo, anel de foco. Contraste com areia 8,52:1, com branco 9,75:1. Pressionado `#0B3B39`.
- **Esmeralda `#14B88A`**: o sinal de "protegido". Superfície do farol seguro, selo de confirmação, marcador do ponto escolhido no mapa, ícone sobre petróleo. **Nunca como cor de texto** (2,22:1 sobre areia, 2,54:1 sobre branco) e **nunca texto branco sobre ela** (2,54:1).
- **Areia `#F4EFE6`**: fundo de página. Linhas e divisórias em `areia-escura #E4DDCF` (não carregam informação, sem requisito de contraste).
- **Branco `#FFFFFF`**: cartões, campos, listas. Cartão branco sobre areia é a única elevação.
- **Tinta `#12201F`** (já existe no app): texto sobre esmeralda e sobre âmbar.
- **Texto de apoio `#3D6563`**: substitui todo `opacity: .7/.8` (5,66:1 sobre areia, 6,48:1 sobre branco). Opacidade muda de contraste conforme o fundo; cor própria não.
- **Alarme `#E5484D` (sempre vermelho)**: só "Preciso de ajuda agora", farol de risco alto e o que dispara alerta. Texto sobre ele `#111111` (4,82:1, nunca branco). Texto vermelho sobre claro: `alarme-texto #B3202A` (5,81:1 sobre areia). Linha, ícone ou borda em `#E5484D` sobre areia dá 3,42:1, aceitável para não-texto.
- **Âmbar `#F2B84B`** (já é o `ambar` do app): atenção. Fundo do farol de atenção, com texto `tinta` (9,37:1). `amarelo-texto #8A5A00` continua para texto e borda sobre claro (5,18:1 sobre areia).
- **Fundos de estado** (tintas suaves para blocos, texto petróleo por cima, todos acima de 8:1): `fundo-ok #EAF6F1`, `fundo-atencao #FFF6DB`, `fundo-alerta #FDECEC`.

**Pares aprovados (medidos em 16/11):** petróleo/areia 8,52 · areia/petróleo 8,52 · tinta/esmeralda 6,59 · tinta/âmbar 9,37 · petróleo/âmbar 5,45 · `#111`/alarme 4,82 · alarme-texto/areia 5,81 · alarme-texto/branco 6,65 · alarme-texto/fundo-alerta 5,68 · texto-apoio/areia 5,66 · texto-apoio/fundo-ok 5,85 · texto-apoio/fundo-atencao 6,01 · branco/petróleo-pressionado 12,36.

**Pares proibidos:** petróleo sobre esmeralda (**3,83:1, reprova**; a crítica de web-emergencia sugeriu esse par no item 4, está errada, use `tinta`) · branco sobre esmeralda (2,54) · esmeralda como texto (2,22) · texto-apoio sobre `#C9D6D3` (4,33).

**Anel de foco** (a crítica mostrou que o esmeralda atual falha, 2,2:1 sobre areia): 3 px sólido petróleo, `outline-offset: 2px`, mais um halo branco de 2 px (`box-shadow: 0 0 0 5px #fff`) para aguentar fundo escuro. Sobre petróleo e sobre alarme, o anel é areia/branco. Esmeralda sobre petróleo (3,83:1) serve só como segundo anel decorativo.

**Sem modo escuro nesta etapa.** A areia é a identidade, o teste de contraste só cobre o claro, e o aparelho emprestado raramente está em escuro. Quando entrar, é decisão separada.

## Typography

Manrope, uma família só. Pesos: 400 corpo, 600 ênfase leve, 700 rótulos e títulos, 800 **só** no ato principal (botão do alarme, palavra do farol, número grande). Peso 800 espalhado vira ruído.

Escala com saltos claros (a crítica apontou escala rasa: 24/18/20/16). Mínimo 1rem em tudo, também texto de apoio (regra do `contraste.test.ts` do painel; a emergência hoje usa `.discreto` com 0,875rem e deve subir para 1rem).

| Papel | Tamanho | Peso | Linha | Uso |
|---|---|---|---|---|
| display | 2,25rem (36) | 800 | 1,1 | palavra do farol, "avisados", número do dia |
| número-hero | 3rem (48) | 800 | 1 | só total da visão executiva |
| título | 1,75rem (28) | 700 | 1,2 | título da tela ("Marque onde foi roubado") |
| seção | 1,25rem (20) | 700 | 1,3 | subtítulo de bloco |
| corpo | 1rem (16) | 400 | 1,5 | texto corrido |
| rótulo | 1rem (16) | 700 | 1,3 | campo, botão, etiqueta |
| apoio | 1rem (16) | 400, cor texto-apoio | 1,45 | hora, explicação, dica |

Em telas ≥ 1024 px o título sobe para 2rem. Texto corrido máximo de 62 caracteres por linha. Números em `font-variant-numeric: tabular-nums` (horas, índice, contagens) para não pular.

**Entrega da fonte:** self-host, não CDN. O painel já usa `@fontsource/manrope` (400 e 700, em `main.tsx`); falta 600 e 800. A emergência ainda carrega a Manrope do Google Fonts (`index.html:7-9`), o que manda o IP do aparelho emprestado ao Google, falha sem rede e atrasa a primeira tela; migrar para `@fontsource/manrope` (400, 600, 700, 800, subset latino, `font-display: swap`) e remover os três `<link>`.

## Layout

- **Mobile primeiro.** Referência 390×844. Coluna única, gutter de 16 px, topo e rodapé respeitam `env(safe-area-inset-*)` e o `<meta viewport>` ganha `viewport-fit=cover`.
- **Ritmo de espaço** em múltiplos de 8 (4 só para ajuste fino): 4, 8, 16, 24, 32, 48. Dentro de um grupo 8 a 12; entre grupos 24; entre seções 32 a 48. O espaço agrupa, não é só respiro.
- **Densidade.** Emergência: **baixa**, uma tarefa por tela, uma ação primária visível sem rolar. Painel: **média**, farol dominante primeiro, depois mensagens; executiva é a única parte densa, com leitura guiada.
- **Larguras.** Emergência: coluna de 480 px (560 em ≥ 768 px). Painel: coluna de 720 px; visão executiva em duas colunas a partir de 960 px (container até 1040). Cabeçalho (faixa de marca) em **largura total** em ambos, conteúdo em coluna sob ele.
- **Ação principal.** Em fluxo de tarefa, o botão que conclui fica numa **barra de ação fixa no rodapé** (altura 72 px, fundo areia, linha superior `areia-escura`, `padding-bottom: env(safe-area-inset-bottom)`). Em telas de leitura, no fim do conteúdo, largura total.
- **Botões de ação primária ocupam a largura da coluna** em ≤ 480 px (hoje alguns encolhem ao conteúdo, item 12 da crítica).
- Sem rolagem horizontal em 360 px (mínimo suportado) a 1280 px.

## Elevation & Depth

Plano e tonal. Profundidade vem de **cartão branco sobre areia** e de bloco de cor cheia (farol, confirmação), não de sombra. Nenhuma sombra decorativa. Exceção única: a barra de ação fixa tem um filete superior `1px areia-escura` (e, só durante rolagem, `0 -4px 12px rgba(15,76,74,.08)`).

## Shapes

Cantos 8 px em controles (botão, campo, chip), 12 px em cartões e lista, 16 px nos blocos de destaque (alarme, farol, confirmação), pílula só para chips de horário e etiquetas de estado. Bordas de campo 2 px petróleo; foco troca por anel (não só cor). **Banido:** borda lateral grossa colorida em aviso (tell de IA, `estilos.css:30` da emergência e `:13` do painel): aviso vira ícone + fundo de estado + borda completa de 1 px.

Ícones: SVG inline, traço de 2 px, cantos arredondados, 24 px (28 no farol). Nada de caractere de fonte (`✔`, `!`, `✖`), que muda de forma por aparelho.

## Components

**Faixa de marca.** Petróleo, largura total, 56 px, wordmark "Ampara" em Manrope 800 areia à esquerda com o ícone do app (`app/assets/icon.png`, versão SVG a desenhar) e, à direita, "Sair" (alvo 48 px, texto areia, contorno areia). Na emergência mostra também "Sessão: 24 min" (sessão de 30 min existe e hoje é invisível). Serve de selo de confiança para estranho.

**Botão primário.** Petróleo, texto areia, 48 px, 700. Pressionado `#0B3B39` + `scale(.98)`; desabilitado = fundo `#C9D6D3` com texto petróleo e uma linha de apoio dizendo o que falta (nunca só opacidade); carregando = rótulo muda ("Entrando…") + indicador, botão continua no lugar.

**Botão secundário.** Branco, borda 2 px petróleo, mesma altura. **Botão de alarme.** Único elemento vermelho cheio, 120 px, display 800, `#111` sobre `#E5484D`; só "Preciso de ajuda agora". Ação grave que não é pânico (enviar à polícia, concluir rota) é **petróleo**, com esmeralda+tinta quando precisa se destacar.

**Campo.** Rótulo 700 acima (nunca placeholder como rótulo), campo branco com borda 2 px petróleo, 48 px, texto de ajuda abaixo em apoio. Senha/palavra secreta com botão mostrar/ocultar de 48 px. Erro: borda `alarme-texto`, ícone e mensagem que diz o que tentar.

**Cartão.** Branco, 12 px, padding 16, sem sombra. **Etiqueta de estado:** pílula com fundo de estado, ícone e palavra.

**Bloco de confirmação.** Fundo `fundo-ok`, ícone de check esmeralda num círculo petróleo, título display ("Guardiões avisados"), hora e quantos, uma frase do que acontece agora e **um** botão primário.

**Farol.** Bloco de 16 px de canto, ocupa a largura e domina o primeiro viewport: ícone SVG 28 px, palavra em display 800 ("Seguro", "Atenção", "Risco alto"), uma frase de orientação em corpo e o índice com leitura ("82 de 100: quanto maior, mais exposto"). Verde = esmeralda+tinta, atenção = âmbar+tinta, alto = alarme+`#111`. O verde deixa de ser petróleo (hoje confunde com o cabeçalho).

**Abas.** Segmentadas, 48 px, selecionada petróleo cheio, indicador de contagem/alerta quando há evento novo. **Chip de horário.** Pílula 48 px de alto, selecionado petróleo. **Barra/coluna de gráfico:** maior valor em petróleo, as demais em petróleo a 45% (`#87A5A4`, só decorativo; o número vem escrito).

**Modo demonstração (simulador).** Recolhido por padrão, faixa "DEMONSTRAÇÃO" em `fundo-atencao`, botões secundários (contorno), confirmação textual após disparar.

**Movimento.** 120 a 160 ms, `ease-out`, só `transform`, `opacity` e cor. Estado pressionado em todo toque; sucesso entra com fade+subida de 8 px; contagem regressiva do alarme (se adotada) em barra linear, sem piscar. Tudo some sob `prefers-reduced-motion: reduce`. Nada pisca nem balança: a pessoa já está em sobressalto.

## Do's and Don'ts

**Faça**
- Diga a tarefa no título ("Marque onde foi roubado"), não o nome da tela.
- Mostre etapa ("Passo 2 de 3") e o que acontece depois de cada ação.
- Use vermelho apenas onde alguém precisa agir agora; o resto do alarme é calma.
- Escreva "Guardiões avisados" em vez do enum cru da API; "Sair e apagar meus dados deste aparelho" em vez de "aba".
- Meça contraste de todo par novo e acrescente ao teste antes de mudar o CSS.
- Garanta que uma ação fora do alcance (rota, BO) tenha botão **no próprio aviso** ("Voltar e avisar guardiões").

**Não faça**
- Texto branco sobre esmeralda, ou petróleo sobre esmeralda (3,83:1).
- `opacity` para texto de apoio; cor própria testada.
- Gradiente, glassmorphism, sombra flutuante, borda lateral grossa, emoji, ícone-em-círculo-colorido repetido em grade.
- Marcador de mapa com área de toque de 48 px visível cobrindo a rota (hoje `radius: 24`).
- Dois botões vermelhos na mesma tela; "Enviar à polícia" em vermelho.
- Carregar fonte de CDN de terceiros em página aberta em aparelho alheio.
- Mudar texto verificado pelos testes ("Seguro", "Atenção", "Risco alto", rótulos das abas, "Preciso de ajuda agora") sem atualizar o teste junto.

## Superfície: web-emergencia

Modo: Operate. Persona: vítima em pânico, celular emprestado, 20 segundos. Fluxo: Entrar → Avisar → Marcar o local → BO. Arquivos: `web-emergencia/src/estilos.css` (e, depois, `index.html`). Nada de rota, campo ou contrato muda.

**Mudanças em `estilos.css` (ordem de correção da crítica):**

1. **Tokens (`:root`).** Acrescentar `--petroleo-pressionado`, `--areia-escura`, `--tinta`, `--texto-apoio`, `--ambar`, `--amarelo-texto`, `--fundo-ok/-atencao/-alerta`, a escala de espaço (`--e-1…--e-7`), raios (`--r-controle/-cartao/-bloco`) e a de tipo (`--t-display/-titulo/-secao`). Os seis atuais ficam como estão.
2. **Anel de foco** (`:25`, `:49`): trocar `3px solid var(--esmeralda)` por petróleo 3 px + halo branco. Mesmo para `.botao-link`.
3. **Tipo** (`:19-20`, `:35`, `:45`): h1 vira título 1,75rem/700; `.gigante` e `.grande` usam display 800; `.discreto` sobe de 0,875rem para 1rem e troca `opacity:.7` por `color: var(--texto-apoio)`; `.bo-texto` sobe de 14 px para 1rem.
4. **Faixa de marca nova** (`.marca`): petróleo, largura total, 56 px, com wordmark e "Sair"/sessão; `.tela` passa a ter `padding-top` abaixo dela. Resolve itens 3 e 14 da crítica.
5. **Etapas** (`.etapas`): indicador "Passo N de 3" com três segmentos de 4 px (petróleo/`areia-escura`), texto em apoio.
6. **Barra de ação fixa** (`.acao-fixa`): `position: sticky; bottom: 0`, `padding-bottom: env(safe-area-inset-bottom)`, fundo areia, filete superior; `.tela` ganha `padding-bottom` de 96 px. Leva o "Foi aqui que me roubaram" (com o horário escolhido no rótulo) e "Enviar à polícia". Item 1.
7. **Uso do vermelho**: `.alarme` fica **só** no botão de ajuda. Criar `.primario-destaque` (esmeralda + `tinta`) para "Foi aqui que me roubaram" e usar o primário petróleo em "Enviar à polícia".
8. **Alarme e confirmação** (`.confirmar`, `.confirmado`): `.confirmar` com "Sim, avisar" na largura total (display, 72 px) e "Não" abaixo, menor; `.confirmado` vira bloco `fundo-ok` com ícone, hora e um primário. Decisão de produto pendente: toque único com desfazer de 5 s. Até decidir, manter a confirmação.
9. **Aviso** (`.aviso`, `:30`): remover `border-left: 6px`; ícone + `fundo-atencao` + borda 1 px `amarelo-texto`. Acrescentar o botão de saída dentro do aviso.
10. **Largura dos botões**: `.bloco > button`, `.botao-link`, `.consentimento` + ação: `width: 100%` em ≤ 480 px; remover o `margin-top` do `.botao-link`.
11. **Campos**: `.consentimento input` de 24 para 28 px visíveis; `select` ganha seta própria e rótulo fora; `input[aria-invalid]` com borda `alarme-texto`; botão mostrar/ocultar (`.campo-olho`, 48 px).
12. **Desabilitado**: `button:disabled` deixa de usar `opacity .6`; fundo `#C9D6D3`, texto petróleo, mais `.ajuda-desabilitado` com a razão ("Marque a autorização para enviar").
13. **Lista** (`.lista li`): item vira cartão com `.etiqueta` de estado em pílula e rótulo legível; a lista desce abaixo da ação principal.
14. **Mapa** (`.mapa`, e o `Mapa.tsx` depois): altura `min(46svh, 360px)`; classes `.ponto` (raio 6–8 px, petróleo) com área de toque invisível de 48 px, `.ponto-escolhido` esmeralda com anel petróleo e rótulo da hora; controles de zoom em 48 px; `.chips` em linha rolável horizontal com fade nas bordas (hoje quebram em muitas linhas).
15. **BO** (`.bo-texto`): vira resumo estruturado (`.resumo`: o quê, onde, quando, aparelho) e o texto bruto fica em `<details>`; "Copiar texto" fica na barra fixa.
16. **Estados e movimento**: `button:hover/:active`, `transition: background-color .14s, transform .14s`, `.carregando` com indicador, `@media (prefers-reduced-motion: reduce)` zerando tudo.
17. **Entrada** (`.login`): marca no topo, frase de uma linha ("Avise quem cuida de você"), link "Não achei meu código" com instrução, espaçamento vertical que centraliza o formulário em telas altas. Em ≥ 768 px, `.tela` a 560 px centralizada sob a faixa de marca em largura total, para não parecer página inacabada.
18. **`index.html`**: `viewport-fit=cover`; remover os três `<link>` do Google Fonts e importar `@fontsource/manrope` (400, 600, 700, 800) em `main.tsx`; `<meta name="theme-color" content="#0F4C4A">`.

**O que não muda:** as seis variáveis de cor, Manrope, alvo 48 px, `role="alert"`/`aria-live`, `inputMode="numeric"`, `autoComplete` para aparelho alheio, textos de erro que não revelam se o e-mail existe, coluna única.

## Superfície: web-painel-risco

Modo: Operate (leitura rápida). Persona: vítima ou parente olhando "estou/ela está segura agora?"; visão executiva para quem decide. Arquivo: `web-painel-risco/src/estilos.css` (e `Farol.tsx` para o ícone SVG, depois).

**Mudanças em `estilos.css` (ordem da crítica):**

1. **Tokens (`:root`)**: acrescentar `--ambar #F2B84B`, `--tinta`, `--texto-apoio`, `--petroleo-pressionado`, `--areia-escura`, `--fundo-*`, escala de espaço e de tipo, como na emergência. **`--amarelo #8A5A00` permanece** (vira `amarelo-texto`, usado em texto e borda); o teste atual exige `#FFF`/`--amarelo` ≥ 4,5:1 e continua passando.
2. **Farol** (`:15-21`): `.farol` vira bloco de 16 px, `padding: 24px`, palavra em display 800, com `.farol-orientacao` (frase) e `.farol-indice-legenda`. `.farol-verde` = esmeralda + `var(--tinta)`; `.farol-amarelo` = `var(--ambar)` + `var(--tinta)`; `.farol-vermelho` mantém `color: var(--sobre-alarme)` (o teste procura essa regra literal). O ícone muda de caractere para SVG (28 px). P1-1 e P1-2.
3. **Cabeçalho** (`.topo`, `:5`): sai de dentro do `main` (hoje preso a 720 px com margem negativa), vira faixa de marca em largura total, 56 px, wordmark + nome da visão + "Sair" (48 px). P1-4.
4. **Mensagens** (`:23-25`): `.mensagem` ganha ícone e `.mensagem-hora` em tempo relativo ("há 4 min", `title` com a data completa); `.mensagem-detalhe` vai para `<details>` ("Ver detalhes"); `opacity: .8` troca por `color: var(--texto-apoio)`.
5. **Simulador** (`:31-32`): `.simulador` recolhido (`<details>`), com `.simulador-faixa` "DEMONSTRAÇÃO" em `fundo-atencao`; `.simulador-botoes button` passam a secundário (contorno); `.simulador-status` para "Disparado. O farol atualiza em instantes." P1-3.
6. **Executiva** (`:33-41`): `.executiva-total` vira número-hero 3rem/800 com `.executiva-leitura` ("9 deles às 23h"); `.barra-preenchimento` da maior em petróleo e as demais `#87A5A4`; ordenar por valor no componente; `.horas` ganha rótulo no pico e marcas 0/6/12/18/agora (`.horas-marcas`); `.hora:focus-visible` e `.hora:hover` com anel. Container a 1040 px e `grid-template-columns: 1fr 1fr` em ≥ 960 px (barras à esquerda, por hora à direita).
7. **Foco e estados** (`:8-11`, `:27-30`): `:focus-visible` com anel petróleo 3 px + halo branco; `button:hover/:active`; `button:disabled` sem `opacity`; `input:focus` com anel distinto da borda de repouso; "Entrar" vira "Entrando…".
8. **Tipo e ritmo** (`:3-7`, `:15`, `:24`, `:33`): regras explícitas para `h1` (título), `h2` (seção) e `h3`; espaços pela escala 8/16/24/32/48 e `gap` agrupando.
9. **Abas** (`.aba`): indicador de contagem/alerta; mantém `role="tablist"`.
10. **Login** (`.login`): marca, frase ("Veja se seus dados estão protegidos nas últimas 24 horas"), mostrar/ocultar senha, formulário centralizado verticalmente em telas altas. "Risco Cidadão" deixa de ser título de produto.
11. **Aviso de falha** (`.aviso`): linha pequena fixa no topo do farol sem empurrar o conteúdo; sem borda lateral grossa.
12. **Acessibilidade viva**: `aria-live="polite"` só no farol (não na lista inteira); fonte já self-host (`@fontsource/manrope`), acrescentar 600 e 800.

**Antes de mudar o CSS (obrigatório, o teste de contraste não cobre os pares novos):** acrescentar a `contraste.test.ts` `tinta/esmeralda ≥ 4,5`, `tinta/ambar ≥ 4,5`, `texto-apoio/areia ≥ 4,5`, `texto-apoio/branco ≥ 4,5` e `alarme-texto/fundo-alerta ≥ 4,5`, sem remover os três testes atuais. O teste "nenhum texto abaixo de 16 px" segue valendo para qualquer regra nova. Textos verificados pelos testes de componente ("Seguro", "Atenção", "Risco alto", rótulos das abas) não mudam.

**O que não muda:** as quatro cores, Manrope, alvo 48 px, farol com palavra + ícone, linguagem da vítima ("Uma senha ia aparecer numa resposta pública. Escondemos."), estado vazio tranquilizador, abas com setas de teclado, sem rolagem horizontal em 390 px.

## Coerência com o app

Mesma marca e mesma régua; não precisam ser idênticos. Pontos de contato a manter: `tokens.ts` (`cores`, `coresApoio.ambar`, `tinta`, `alvoMin 48`, `fonteMin 16`, `espacos` 8/16/24). Divergência conhecida e aceita: no app `sobreAlarme` é `#000000`, nas webs `#111111` (4,82:1 passa; não mexer sem motivo). O alarme do guardião e o início da vítima no app devem usar os mesmos papéis de cor (vermelho só no alarme, esmeralda = protegido) para que as três superfícies pareçam um produto.
