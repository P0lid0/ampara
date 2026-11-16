# Crítica de design: web-painel-risco

Data: 16/11/2026. Skill: `impeccable`, modo critique (só leitura; nenhum arquivo de código foi alterado).

Método: DEGRADADO, contexto único. Não havia ferramenta de subagente nesta sessão, então a revisão de design (A) e a evidência do detector (B) rodaram em sequência no mesmo contexto. A revisão A foi escrita antes de consultar o detector.

Evidência: código lido por inteiro (`src/estilos.css`, 7 componentes, `App.tsx`, `rotulos.ts`, `contraste.test.ts`) e tela vista em 390 px e 1280 px no navegador (servidor já no ar na 5174; não subi nem parei processo). A API não estava no ar (5080 sem resposta), então as chamadas `/api/v1/seguranca/*` foram simuladas no navegador com dados sintéticos (farol vermelho, 3 eventos, executiva com 32 eventos). Sem PRODUCT.md nem DESIGN.md no projeto; a marca vem do `CLAUDE.md` do Ampara.

Detector (`impeccable detect --json src/componentes index.html`): 0 achados. O detector lê só marcação, não o CSS, então ele não vê os problemas de cor e hierarquia abaixo. Não há overlay no navegador (critique só leitura, sem live-server).

Modo da superfície: Operate (painel de leitura rápida). Heurísticas 7 e 10 pontuadas normalmente porque há login, abas e simulador.

## Veredito de especificidade

O painel é correto e acessível, mas não tem autoria. Trocando o texto do cabeçalho, serve para qualquer produto de segurança. Tudo é o mesmo cartão branco de cantos 12 px, a mesma barra petróleo, o mesmo botão petróleo. A marca aparece como duas cores chapadas (petróleo e areia) e uma fonte. Não há logo, esmeralda quase não aparece, o alarme só aparece no farol vermelho. O que é próprio do Ampara (um parente que protege, um dado que quase vazou e foi barrado) não está na tela: a frase "Bloqueamos antes de sair" é a melhor coisa do painel e está em peso de corpo, 16 px, embaixo do farol.

## Nota de saúde (Nielsen)

| # | Heurística | Nota | Problema principal |
|---|-----------|------|--------------------|
| 1 | Visibilidade do estado | 3 | Há "Carregando…" e aviso de falha, mas sem "atualizado há X s"; o simulador não confirma que disparou (só o farol muda, até 5 s depois) |
| 2 | Linguagem do mundo real | 3 | Texto da vítima é bom; o rodapé de cada mensagem ("CPF · registro do sistema · bloqueado") e "Risco Cidadão" ainda soam técnicos |
| 3 | Controle e liberdade | 1 | Não existe botão Sair; só a sessão que expira leva ao login |
| 4 | Consistência | 3 | Sistema coeso, mas verde do farol = cor do cabeçalho e dos botões |
| 5 | Prevenção de erro | 3 | Simulador mistura gatilhos de demo com a visão real do cidadão |
| 6 | Reconhecimento | 3 | Abas rotuladas; a escala do índice (82/100 é bom ou ruim?) não é explicada |
| 7 | Flexibilidade | 2 | Sem filtro nem período; aceitável para o escopo, abas têm setas de teclado |
| 8 | Estética e minimalismo | 2 | Limpo, porém sem hierarquia: tudo pesa igual |
| 9 | Recuperação de erro | 3 | Mensagens claras e em português; falha de rede some só quando a próxima chamada passa |
| 10 | Ajuda | 1 | Nenhuma explicação do farol, do índice ou do que fazer em risco alto |
| **Total** | | **24/40** | **Aceitável (60%)** |

## O que funciona

- Contraste tratado de verdade: `#111` sobre o alarme (4,82:1), `--alarme-texto` para texto vermelho, amarelo escurecido para aguentar texto branco, tudo coberto por teste (`src/contraste.test.ts`). O farol também não depende só de cor: tem palavra e ícone (`Farol.tsx:3-7`).
- Linguagem da vítima sem jargão e com tom calmo ("Uma senha ia aparecer numa resposta pública. Escondemos."), mais o estado vazio tranquilizador (`Mensagens.tsx:6`).
- Estrutura sólida: abas com papéis ARIA e setas de teclado (`Abas.tsx:11-19`), alvos de 48 px (`estilos.css:8`), sem rolagem horizontal em 390 px (medido: 390/390) e em 1280 px, foco devolvido ao título no login expirado (`Login.tsx:12-14`).

## Achados por impacto

### P1-1. O farol não parece um farol, e o verde some na marca
`estilos.css:15-21`, `Farol.tsx:3-7`.
O verde do farol é `var(--petroleo)` (`estilos.css:18`), a mesma cor do cabeçalho e dos botões. Resultado: "Seguro" parece só mais um bloco da interface, não um sinal. O amarelo é `#8A5A00`, um marrom que não lê como amarelo. O único estado que se destaca é o vermelho. Na tela de 390 px o farol ocupa uma faixa de 80 px de altura com 24 px de texto, menos do que o título da página pesa visualmente, e o índice "82/100" fica solto à direita sem dizer se alto é bom ou ruim.
Impacto: para quem está em pânico (ou para o parente) o estado precisa ser lido em um segundo, de longe. Hoje a leitura depende de ler a palavra.
Correção: tornar o farol o elemento dominante da tela: bloco cheio, texto maior (2rem ou mais), palavra + uma frase de orientação sob ela ("Bloqueamos 3 tentativas. Você não precisa fazer nada."). Verde com esmeralda (`#14B88A` com texto escuro `#0F4C4A`, checar 4,5:1, ver o `contraste.test.ts` que hoje só cobre vermelho e amarelo), amarelo realmente amarelado com texto escuro, vermelho como está. Escrever o sentido do índice ("82 de 100: quanto maior, mais exposto") ou trocar por uma escala visual. Comando: `/impeccable colorize`, depois `/impeccable layout`.

### P1-2. Falta de um próximo passo: o painel informa e nunca orienta
`VisaoCidadao.tsx:43-47`, `Mensagens.tsx:9-20`.
Com "Risco alto" na tela, o usuário não sabe o que fazer: nenhum botão, nenhum link para a ação do app, nenhuma explicação. Cada mensagem termina em um rodapé técnico (`mensagem-detalhe`, `estilos.css:25`) que repete o que a frase já disse ("Quase vazou o seu CPF… Bloqueamos antes de sair" e abaixo "CPF · registro do sistema · bloqueado").
Impacto: duplica leitura sem agregar, e deixa a vítima sem saída. Para o público (todas as idades), é o ponto que mais corrói confiança.
Correção: uma linha de ação sob o farol conforme o estado (verde: nada a fazer; amarelo: o que conferir; vermelho: o que fazer agora e quem acionar). Esconder o rodapé técnico atrás de "Ver detalhes" e trocar a data absoluta ("16/11/2026, 14:41") por tempo relativo ("há 4 min") com a data completa no `title`/`dateTime`. Comando: `/impeccable clarify`.

### P1-3. Os botões do simulador competem com a tela real e falam como ataque de verdade
`Simulador.tsx:30-44`, `App.tsx:58-59`, `estilos.css:31-32`.
Os 4 botões de ação (a coisa mais clicável da tela, petróleo cheio de 48 px, mesmo peso do botão Entrar) ficam logo abaixo das mensagens do cidadão, com rótulos como "Vazar CPF no log". Em 390 px o simulador ocupa quase metade da rolagem. Quem abre o painel em demonstração não distingue o que é dado real do que é gatilho de teste, e há risco de clique acidental por um idoso. Também não há confirmação visual do disparo.
Impacto: confunde o que é real, alarma sem necessidade, e na hora da apresentação o clique no simulador não dá resposta imediata (o farol só muda no próximo ciclo de 5 s, `VisaoCidadao.tsx:7`).
Correção: mover o simulador para um painel recolhido ("Modo demonstração") visivelmente separado, com estilo secundário (contorno, não cheio), faixa "DEMONSTRAÇÃO" e confirmação de que enviou ("Disparado. O farol atualiza em instantes."). Disparar a atualização do farol assim que o POST volta (`aoSimular` já faz, só falta o texto de estado). Comando: `/impeccable layout`, `/impeccable clarify`.

### P1-4. Não há como sair, e o cabeçalho não carrega a marca
`App.tsx:47`, `estilos.css:5`.
O cabeçalho é um texto de 16 px em barra petróleo; nada de logo, nada de "Sair". O único caminho ao login é a expiração. Em 1280 px a barra petróleo fica presa à coluna de 720 px (`estilos.css:4-5`) e termina no meio da página, com a areia dos dois lados, parecendo um bloco e não um cabeçalho. Em um painel usado em aparelho compartilhado (a vítima pode estar no computador de outra pessoa) isso é falha de controle e de privacidade.
Correção: cabeçalho em largura total com marca do Ampara, nome da visão e botão "Sair" com alvo de 48 px; conteúdo continua em coluna. Comando: `/impeccable layout`, `/impeccable polish`.

### P2-1. Visão executiva: números sem leitura e gráficos sem hierarquia
`VisaoExecutiva.tsx:8-26` e `:79-97`, `estilos.css:33-41`.
O total ("32 eventos nas últimas 24 h") tem 24 px, quase o mesmo peso dos subtítulos. O gestor não sabe se 32 é muito, pouco ou pior que ontem: sem comparação, sem tendência. As barras seguem a ordem que vem do servidor, não do maior para o menor (na tela simulada, "IMEI 9" fica depois de "Saúde 3"), e todas têm a mesma cor petróleo, então o "pior" nunca se destaca. O gráfico por hora tem 24 colunas sem eixo de valor (o maior "9" não aparece em lugar nenhum), sem rótulo nas colunas e sem estado de foco ou toque, só texto invisível via `aria-label`. Nada usa o alarme ou o esmeralda para guiar o olho.
Correção: transformar o total em número grande (3rem) com uma linha de leitura ("9 deles às 23h"); ordenar as barras por valor decrescente; destacar a maior em destaque e as demais em tom atenuado; rotular o pico do gráfico por hora e adicionar marcas de hora (0, 6, 12, 18, agora). Comando: `/impeccable layout`, `/impeccable colorize`.

### P2-2. Fonte da marca não é entregue ao navegador
`estilos.css:3`, `index.html:3-12`.
`font-family: "Manrope"` é declarado, mas não há `@font-face`, `<link>` de fonte nem pacote (`@fontsource`) no projeto. Nesta máquina a Manrope aparece porque está instalada no sistema; em qualquer outro aparelho (a banca da FIAP, o celular de um parente) o painel cai em `system-ui` e a marca some. Em 390 px o texto está bonito apenas por acaso.
Correção: empacotar a Manrope (peso 400, 600, 700, subset latino) e carregar com `font-display: swap`. Comando: `/impeccable typeset`.

### P2-3. Escala tipográfica e espaçamento sem ritmo
`estilos.css:3-7`, `:15`, `:24`, `:33`.
Há só dois tamanhos além do corpo (1,25 rem no h2, 1,5 rem no farol e no total). O `h1` do login não tem regra (herda o padrão do navegador, 2em), enquanto as telas logadas começam em `h2` sem `h1` (`App.tsx:47` usa `<header>` e não título). Subtítulos `h3` da visão executiva (`VisaoExecutiva.tsx:12`) também sem regra: herdam 1,17 em. A hierarquia vem do peso, não do tamanho, e os espaços (24 px entre tudo) não separam grupos de itens.
Correção: definir tokens de tipo (corpo 1rem, apoio 0,875 não é permitido pelo teste de 16 px, então manter 1rem e variar peso/cor; título 1,5; destaque 2 a 3rem) e um ritmo de espaço (8/16/24/40). Comando: `/impeccable typeset`.

### P2-4. Estados interativos incompletos
`estilos.css:8-11`, `:27-30`.
Não há `:hover`, `:active` nem `:focus-visible` próprios: o foco depende do anel padrão do navegador, que sobre botão petróleo e aba contornada fica fraco. O campo de entrada usa borda petróleo de 2 px também em foco, então foco e repouso são idênticos. `button:disabled` só baixa a opacidade para 0,6 (o texto areia sobre petróleo a 60% perde contraste e não diz "aguarde"). "Entrar" não muda de rótulo enquanto envia.
Correção: anel de foco de 3 px em esmeralda com recuo de 2 px; estado ativo; "Entrando…" durante o envio. Comando: `/impeccable polish`, `/impeccable harden`.

### P2-5. Login seco
`Login.tsx:34-48`, `estilos.css:12`.
Tela de 390 px: um título, dois campos e um botão no topo, e 60% da tela vazia. Sem logo, sem frase do que é o painel, sem ver senha, sem "esqueci a senha". O título "Risco Cidadão" é nome de módulo, não de produto. Para quem chega por link de um parente, não explica por que está ali.
Correção: marca + uma frase ("Veja se seus dados estão protegidos nas últimas 24 horas"), olho para mostrar a senha, e o formulário um pouco mais abaixo e centralizado em telas altas. Comando: `/impeccable onboard`, `/impeccable layout`.

### P3. Observações menores
- `Farol.tsx:5-7`: ícones são caracteres (`✔`, `!`, `✖`), que mudam de forma conforme a fonte do sistema; trocar por SVG inline.
- `estilos.css:25`, `:41`: `opacity: .8` para texto de apoio; melhor uma cor própria testada, já que a opacidade muda de contraste conforme o fundo.
- `VisaoCidadao.tsx:43`: o aviso "Não consegui atualizar agora" (`VisaoCidadao.tsx:43`) aparece acima do farol e empurra a tela inteira; melhor uma linha pequena e fixa, sem deslocar o conteúdo.
- `VisaoCidadao.tsx:42`: toda a região do farol e das mensagens é `aria-live="polite"` com atualização a cada 5 s; o leitor de tela pode reler listas inteiras. Restringir o live ao farol.
- `Abas.tsx`: abas sem indicação de contagem ou de alerta (a vítima não vê que há eventos sem entrar na aba).
- Tela larga: a coluna de 720 px centralizada deixa 560 px de areia vazia nos dois lados em 1280 px; para a visão executiva, usar duas colunas (barras à esquerda, gráfico por hora à direita).

## Personas

**Pessoa em pânico, sem familiaridade (Jordan):** abre o painel e vê o bloco vermelho com "Risco alto 82/100"; não há botão, nem frase do que fazer; o rodapé "CPF · registro do sistema · bloqueado" não ajuda. Vai ligar para alguém em vez de agir. Abaixo, "Vazar CPF no log" parece um comando real.

**Idoso / baixa visão (Sam):** alvos de 48 px e contraste estão bons, mas o foco é o anel padrão fraco, o texto de apoio com `opacity .8` é pequeno (16 px) e sem peso, e o `aria-live` amplo vai reler listas a cada 5 s no leitor de tela.

**Gestor na apresentação (Alex):** 32 eventos sem comparação, barras fora de ordem, gráfico sem valores; precisa interpretar sozinho. Sem filtro de período nem exportação.

**Parente acionado (persona do projeto):** quer saber "ela está segura agora?" em uma olhada; o farol verde se confunde com o cabeçalho e a hora vem como data completa, não "há 4 min".

## Perguntas para decidir

1. O índice é "quanto maior, pior"? Se sim, o rótulo do farol e a escala precisam dizer isso; se não, "82/100" em "Risco alto" é incoerente.
2. O simulador deve aparecer para o cidadão, ou só em modo demonstração, em área separada?
3. A visão executiva é para quem decide ou para quem opera? Se for para quem decide, o número do dia e a comparação vêm antes das barras.

## Ordem sugerida de correção (com o prazo de 19/11)

1. Farol e orientação (P1-1, P1-2): maior ganho na demonstração do vídeo.
2. Cabeçalho com marca e Sair; simulador separado (P1-4, P1-3).
3. Fonte empacotada (P2-2): 10 minutos e remove o risco de a marca sumir na banca.
4. Executiva (P2-1), estados e foco (P2-4), login (P2-5).
5. Tipografia e ritmo (P2-3), observações P3.

Restrições a preservar: petróleo `#0F4C4A`, esmeralda `#14B88A`, areia `#F4EFE6`, alarme `#E5484D` sempre vermelho, Manrope, alvo de 48 dp, contraste 4,5:1 (adicionar ao `contraste.test.ts` os novos pares do verde e do amarelo antes de mudar), testes de `src/*.test.tsx` sem quebrar (os textos "Seguro", "Atenção", "Risco alto" e os rótulos das abas são verificados).
