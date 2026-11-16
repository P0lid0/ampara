# Crítica de design depois do polish: web-emergencia

Data: 16/11/2026. Skill: `impeccable`, modo critique, só leitura (nenhum código alterado). Superfície em modo Operate: uma tarefa urgente, num celular emprestado. Comparada com `critica.md` (22/40).

## Método

- DEGRADADO, contexto único: a tarefa proibia subagentes, então a revisão de design (A) e a evidência do detector (B) rodaram em sequência no mesmo contexto. A revisão A foi escrita antes de ler a saída do detector.
- Detector `impeccable detect --json web-emergencia/src web-emergencia/index.html`: 0 achados (antes: 1, a borda lateral de 6 px, que sumiu).
- Navegador: tela de entrada vista ao vivo na 5173 em 390 px e 1280 px (sem rolagem horizontal: 390/390 e 1280/1280; alvos de 48 a 56 px medidos; Manrope 400/700/800 carregada). Não enviei formulário nem fiz login.
- As telas com sessão (painel, confirmação, avisado, rota, BO) foram avaliadas pelas capturas feitas no polish (`docs/design/depois/*.png`, 390 e 1280) e pelo código lido por inteiro. Não foram refeitas ao vivo porque exigem login e a API (5080) não estava no ar.
- As mudanças do web-emergencia estão no working tree, ainda sem commit (o último commit da pasta é `394c005`; `git status` mostra 11 arquivos modificados). A crítica vale para o que está em disco.
- Sem `PRODUCT.md`: o detector de contexto pediu `init`. Há `DESIGN.md` na raiz; usei esse e o `CLAUDE.md`.

## Nota

| # | Heurística (0 a 4) | Antes | Agora | Por quê |
|---|---|---|---|---|
| 1 | Visibilidade do estado | 2 | 3 | Passo N de 3, "Sessão: N min" na faixa, spinner e "Enviando…". Falta aviso quando a sessão está perto de acabar |
| 2 | Linguagem do usuário | 3 | 3 | "Aberta" ainda é o enum cru; "BO" e "IMEI" sem glossário; `aria-label` do Sair ainda diz "aba" |
| 3 | Controle e liberdade | 2 | 3 | Voltar em todas as telas, Sair fixo na faixa, "Não" abaixo e de largura inteira. Sem desfazer depois do alarme |
| 4 | Consistência | 3 | 3 | Escala e botões coerentes. Dois primários de mesmo peso no BO (item 2) |
| 5 | Prevenção de erro | 2 | 3 | Botão desabilitado com frase e `aria-describedby`; checkbox de 32 px; vermelho só no alarme |
| 6 | Reconhecimento | 3 | 3 | Fluxo curto, etapas visíveis |
| 7 | Flexibilidade | 2 | 2 | Mesmo número de toques até o BO; sem atalho. Aceitável em Operate de uso único |
| 8 | Estética e minimalismo | 1 | 3 | Marca, hierarquia e uma ação por tela. Falta resolver a metade vazia das telas curtas |
| 9 | Recuperação de erro | 3 | 3 | Mensagens boas, "Tentar de novo", "Voltar e avisar guardiões" no aviso da rota |
| 10 | Ajuda | 1 | 2 | "Não achei meu código" na entrada. Nada fora dela; "Dados incorretos." continua sem dizer o que tentar |

Total: 28/40 (antes 22/40, +6). Especificidade de design: média para alta. A faixa petróleo com o sinal esmeralda, o passo N de 3, o botão vermelho gigante e a barra fixa esmeralda já pertencem a este produto; o cabeçalho "Sessão: 30 min" é uma ideia própria do contexto de aparelho alheio. AI Slop Score: baixo (detector limpo, sem gradiente, sem cartão aninhado).

## O que melhorou (dos 18 achados anteriores)

| Antes | Estado | Evidência |
|---|---|---|
| 1 Botão de concluir abaixo da dobra | Resolvido | `.acao-fixa` com `env(safe-area-inset-bottom)` e "Ponto escolhido 15:54" sempre visível (`LinhaDoTempo.tsx:253-272`, `estilos.css:acao-fixa`) |
| 2 Marcadores de 48 px escondem a rota | Resolvido | Ponto de raio 6 visível + área de toque de 24 invisível; escolhido esmeralda com anel petróleo e rótulo da hora; zoom de 48 px (`Mapa.tsx`) |
| 3 Sem hierarquia nem etapas | Resolvido | Faixa de marca, `Etapas`, h1 de 28 px |
| 4 Vermelho em ação que não é o alarme | Resolvido | "Foi aqui que me roubaram" em esmeralda com texto escuro; "Enviar à polícia" em petróleo; vermelho só no alarme |
| 5 Foco sem contraste | Resolvido | Anel petróleo de 3 px com halo branco (`:focus-visible`) |
| 6 Confirmação do alarme | Parcial | "Sim, avisar" em largura inteira, "Não" abaixo; ainda há dois toques e o botão some da posição do dedo |
| 7 Sucesso sem tranquilização | Resolvido | Bloco com selo, hora, instrução e botão único "Marcar onde foi roubado" |
| 8 Estado cru na lista | Parcial | Etiqueta com ícone e lista abaixo da ação; o texto ainda é `{o.estado}` do servidor |
| 9 Borda lateral grossa | Resolvido | Detector 0 achados |
| 10 Becos sem saída | Parcial | Rota tem "Voltar e avisar guardiões"; `Bo.tsx` com `!ocorrenciaId` ainda mostra só a frase (há "Voltar" no topo) |
| 11 Botão desabilitado mudo | Resolvido | "Marque a autorização para enviar." + checkbox de 32 px |
| 12 Larguras de botão | Resolvido | `.botao-link { width: 100% }` |
| 13 Bloco de texto do BO | Resolvido | `details` "Ver o texto completo", sem rolagem interna, fonte do app |
| 14 Sair discreto, termo "aba" | Parcial | Sair na faixa com contador; falta dizer na tela que apaga os dados deste aparelho (`aria-label` ainda "aba") |
| 15 Entrada sem ajuda | Resolvido | Mostrar/ocultar, "Não achei meu código" com saída concreta (ligar para um guardião) |
| 16 Sem `:active`, sem movimento | Resolvido | `:hover`, `:active` com escala 0,98, 140 ms, `prefers-reduced-motion` |
| 17 Área segura e viewport | Resolvido | `viewport-fit=cover` e `env(safe-area-inset-*)` |
| 18 Escala rasa | Resolvido | 28 / 24 / 20 / 16, 800 só nos atos principais |

## Achados que restam, por impacto

Nenhum é bloqueio de entrega. Tudo abaixo é médio ou baixo.

### Médio

1. **Foco se perde a cada troca de tela e de fase.** `Painel.tsx` (botão "Preciso de ajuda agora" some ao confirmar; "Sim, avisar" some ao avisar), `App.tsx` (Login para Painel, Painel para Rota para BO). Não há `focus()` nem `autoFocus` em lugar nenhum do código (grep: só `focusable="false"` nos ícones). Quem usa teclado ou leitor de tela cai no `body` e recomeça do topo; o `role="alertdialog"` da confirmação não recebe foco, então não cumpre o contrato. Correção: ao entrar em confirmando, mover o foco para "Avisar meus guardiões agora?" ou para o botão "Não" (nunca "Sim"); ao avisar, foco no título do bloco "Seus guardiões foram avisados"; ao trocar de tela, foco no `h1`.
2. **Dois primários de mesmo peso no BO.** `Bo.tsx:156-166` fixa "Copiar texto" (petróleo, 56 px) na base; "Enviar à polícia" (petróleo, 48 px, o ato com consequência) fica dentro do cartão, e em 390 px a barra o cobre pela metade enquanto o checkbox ainda está visível (`depois/7-bo-390.png`). A pessoa não sabe qual é o passo principal. Correção: a barra fixa leva o ato principal ("Enviar à polícia", habilitado ao marcar a autorização), e "Copiar texto" passa a secundário (contorno) dentro do bloco do texto.
3. **O botão principal do Início está na parte alta da tela.** `depois/2-painel-390.png`: o vermelho ocupa y 235 a 355 de 844; a metade de baixo fica vazia e é a zona do polegar. É a ação mais urgente do produto. Correção: ancorar "Preciso de ajuda agora" na base, com área segura, como a barra fixa já faz nas outras duas telas e como foi aprovado para o app (RISK 4); o texto de apoio e as ocorrências sobem.
4. **O mapa ocupa 38% da altura e captura o dedo.** `.mapa { height: clamp(240px, 38svh, 360px) }`, mais cabeçalho e barra fixa: em 390x844 sobram poucos pixels de página para rolar fora do mapa, e arrastar começando no mapa move o mapa, não a página. Correção: `touch-action: pan-y` até o primeiro toque no mapa, ou um modo "tocar para mover o mapa"; a lista de horários continua como alternativa (o `aria-label` já a cita).
5. **Sessão: o contador não avisa e a perda é seca.** `FaixaDeMarca.tsx` mostra "Sessão: N min" e `App.tsx` devolve ao login ao vencer, apagando o texto do BO. Falta uma frase aos 3 min ("A sessão termina em 3 min. Copie o texto do BO agora") com `role="status"`. O texto da faixa some abaixo de 360 px (`@media max-width: 359px`) sem alternativa.

### Baixo

6. **"Aberta" cru e ambíguo.** `Painel.tsx:151` imprime o enum. Para quem está em crise, "Aberta" não diz "seus guardiões já foram avisados". Mapa de rótulos: Aberta, "Alarme ativo"; Encerrada, "Resolvida"; Cancelada, "Cancelada".
7. **Sair não diz o que apaga.** Texto visível "Sair"; o `aria-label` fala em "aba", termo que o público não usa. Trocar por "Sair e apagar meus dados deste aparelho" (cabe no `title` e no leitor de tela; visível, uma frase de apoio na primeira vez).
8. **"Dados incorretos." sem saída.** `Login.tsx:26-27`. Acrescentar "Confira o e-mail, o código de 6 números e a palavra secreta" e `aria-live` já existe. A ajuda "Não achei meu código" não cobre quem esqueceu a palavra secreta.
9. **Desalinhamento de 16 px a partir de 768 px.** `depois/5-rota-1280.png`: "Ponto escolhido" começa em x=353, o título em x=369. `.acao-fixa-miolo` e `.tela` têm 560 px, mas a barra tem 16 px de padding a mais. Igualar.
10. **Peso 600 declarado e usado sem estar carregado em 390 px.** O navegador marcou Manrope 600 como `unloaded` na entrada; é usado em `.consentimento`, `.escolhido`, `.faixa-sessao`. Sai o mais próximo (700), o que é aceitável; só vale conferir que não haja salto de layout quando o 600 carregar.
11. **Metade vazia nas telas curtas.** Entrada, painel e "Momento marcado" terminam a meio da tela em 390x844. Resolvido em parte pelo item 3.

## Pontos fortes a manter

- Contraste e alvos tratados com disciplina: botões de 48 a 56 px, `--sobre-alarme` `#111` sobre vermelho, esmeralda só com texto escuro, foco duplo.
- Cada tela tem um verbo no título e uma ação primária visível sem rolar (rota e BO) com área segura.
- Linguagem que não mente nem revela dados ("Dados incorretos.", frase da API em `detalheCidadao`) e estado nunca só por cor (ícone + palavra em etiqueta, rótulo da hora no mapa).
- A faixa "Sessão: N min" transforma uma regra de segurança em informação à vista.

## Personas

- Pessoa em pânico, celular de um estranho (20 segundos): entra, vê um botão vermelho que diz o que faz, confirma, vê "foram avisados" e um único próximo passo. Perde tempo só no alcance do polegar (item 3) e se usar leitor de tela (item 1).
- Dono do celular emprestado, desconfiado: o contador de sessão e o Sair visível ajudam; falta a frase que diz que nada fica no aparelho (item 7).
- Idoso, baixa visão: texto de 16 px mínimo, alvos grandes, sem texto em opacidade reduzida. Item 1 é o que mais pesa para leitor de tela.

## Ordem sugerida

1. Foco nas transições e na confirmação (item 1).
2. Ação principal ancorada na base do Início e do BO (itens 2 e 3).
3. Rótulos e textos de ajuda: "Aberta", Sair, erro de login (itens 6 a 8).
4. Mapa em toque e aviso de fim de sessão (itens 4 e 5).

Restrições respeitadas: petróleo `#0F4C4A`, esmeralda `#14B88A`, areia `#F4EFE6`, alarme `#E5484D` só no alarme, Manrope, alvo mínimo de 48 px, contraste mínimo de 4,5:1.
