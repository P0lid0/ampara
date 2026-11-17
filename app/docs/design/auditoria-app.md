# Auditoria de design do app Ampara (Expo)

Skill: `mobile-design-review`, modo só-relatório (nenhum arquivo de código foi editado).
Data: 2026-11-16. Escopo: `app/src/app/**` (telas), `app/src/ui/**` (componentes), `app/src/theme/tokens.ts`.
Entrega: 19/11/2026 23h55.

## Resultado em uma tela

| | Nota |
|---|---|
| **Design Score** | **B** (média 2,90; limitada a B porque há 3 achados de impacto alto em aberto) |
| **AI Slop Score** | **A-** (média 3,6) |

O que as duas notas dizem juntas: o app **não tem cara de template de IA** (zero emoji, zero gradiente, zero índigo, zero hexadecimal solto em tela, texto sempre com rótulo). O problema é outro: **falta hierarquia e composição**. Toda tela é uma pilha de caixas brancas com contorno petróleo de 2 px, botões secundários que têm o mesmo peso visual das caixas, e a única tela que deveria gritar (o alarme do guardião) é um título no meio de um campo vermelho com um botão no meio da tela. É o "sem gosto" que o Pedro apontou: correto, limpo, acessível e sem desenho.

Prioridade de correção, na ordem do CLAUDE.md: (1) alarme do guardião, (2) início da vítima, (3) rota e BO, (4) onboarding. Os achados de maior impacto estão em 1, 2 e na barra de abas.

**Documento de compromissos usado:** não existe `MOBILE-DESIGN.md` nem `design-baseline.json` (primeira execução, não é rodada de regressão). Usei como compromissos declarados o `CLAUDE.md` do projeto (marca, alvo de 48 dp, contraste) e os comentários de `src/theme/tokens.ts`. Desvios deles estão marcados como DRIFT.

---

## O que não pode mudar (marca e acessibilidade já certas)

Estas decisões estão corretas e protegidas por teste. Qualquer redesenho parte delas.

- Marca: petróleo `#0F4C4A`, esmeralda `#14B88A`, areia `#F4EFE6`, alarme `#E5484D` sempre vermelho, Manrope (`tokens.ts:5-12`).
- Alvo de toque mínimo de 48 dp em `Botao`, `Campo`, abas e linhas (`Botao.tsx:51-52`, `Campo.tsx:134`, `tabs/_layout.tsx:20`).
- Texto mínimo de 16, com `allowFontScaling` ligado (`Texto.tsx:9-14`).
- Estado nunca só por cor: `EstadoBadge` e `Campo` com texto e ícone; mapa de risco com padrão de borda além da cor.
- Contraste testado (`theme/contraste.ts`, `paresDeTexto`). Pares que passam: tinta sobre areia, areia sobre petróleo, tinta sobre esmeralda, preto sobre alarme (5,4:1), petróleo sobre areia. Branco sobre esmeralda e branco sobre alarme **reprovam** de propósito.
- Disciplina de cor: 0 hexadecimais em telas e componentes (todos em `tokens.ts`).
- Leitor de tela: rótulos, `accessibilityRole`, regiões vivas, anúncio de 10 em 10 s no alarme, voltar travado no alarme.
- Rotas, nomes de campo e contratos (`docs/superpowers/plans/2026-11-14-00-indice-e-contratos.md`).

---

## Passes executados

- **Passe estático:** feito (grep de tells adaptado a `src/app` e `src/ui`, mais leitura de `alarme.tsx`, `(tabs)/index.tsx`, `(tabs)/ajustes.tsx`, `(tabs)/_layout.tsx`, `rota.tsx`, `bo.tsx`, `onboarding/*`, `guardiao/passo-a-passo.tsx`, `ui/*`).
- **Passe ao vivo:** feito a partir de **15 prints reais** do emulador Android (release, 1080x2400) em `app/docs/design/antes/`. Não rodei o app: não houve navegação ao vivo, só os prints. O `16-mapa-sem-api.png` foi tirado com a API fora do ar. **Não há print de `rota.tsx`, `bo.tsx`, `relato.tsx`, `historico`, `ocorrencia/[id]`, `aceitar` nem do alarme em estados que não sejam "tocando"**: esses foram auditados só pelo código e estão rotulados assim.

### Cobertura de telas (da árvore de rotas)

| Tela | Arquivo | Print | Como foi auditada |
|---|---|---|---|
| Entrar | `app/entrar.tsx` | 01 | print + código |
| Conta | `onboarding/conta.tsx` | 02, 03 | print |
| IMEI | `onboarding/imei.tsx` | 03, 04 | print + código |
| Bancos e operadora | `onboarding/contas.tsx` | 05 | print + código |
| Guardiões | `onboarding/guardioes.tsx` | 06 | print |
| Chaveiro | `onboarding/chaveiro.tsx` | 07 | print + código |
| Consentimento da rota | `onboarding/consentimento.tsx` | 08 | print + código |
| Código de emergência | `onboarding/emergencia.tsx` | 09 | print + código |
| Prevenção | `onboarding/checklist.tsx` | 18 | print |
| Início | `(tabs)/index.tsx` | 10 | print + código |
| Mapa | `(tabs)/mapa.tsx` | 16 | print + código |
| Histórico | `(tabs)/historico.tsx` | nenhum | só código |
| Ajustes | `(tabs)/ajustes.tsx` | 19 | print + código |
| Alarme do guardião | `guardiao/alarme.tsx` | 11 | print + código |
| Passo a passo do guardião | `guardiao/passo-a-passo.tsx` | 12 | print + código |
| Aceitar convite | `guardiao/aceitar.tsx` | nenhum | só código |
| Minha rota | `rota.tsx` | nenhum | só código |
| BO | `bo.tsx` | nenhum | só código |
| Relatar | `relato.tsx` | nenhum | só código |
| Ocorrência | `ocorrencia/[id].tsx` | nenhum | só código |

---

## Grep de tells (resultado e triagem)

| Tell | Resultado | Triagem |
|---|---|---|
| 33 travessão em texto visível | 1 acerto: `ocorrencia/[id].tsx:87` (`${TITULOS[passo]} — ${hora}`) | Procedente, polish (FINDING-025). |
| 1 emoji em JSX | O `grep -P` com faixa astral falhou na plataforma (erro de intervalo); refeito por busca literal: **0 emoji reais**. Mas há **glifos Unicode usados como ícone**: `⚠` em 35 pontos de 21 arquivos, `✕ ■ ◇ ● ○ ✓ ◔` em `EstadoBadge.tsx:155-162`, `◉ ○ ☑ ☐` em `bo.tsx:30,246` | Procedente como variante do tell 1 (FINDING-011). |
| 2 índigo e `LinearGradient` | 0 e 0 | Limpo. |
| 6 hexadecimal em tela | 0 | Limpo (disciplina de token exemplar). |
| 13 ScrollView com `.map(` | 9 arquivos | Triados: `historico.tsx:65,76` (lista de ocorrências sem limite, procedente, FINDING-020); `mapa.tsx:200-204` (pontos e relatos filtrados por janela de tempo e área, dispensado como polish); `bo.tsx`, `passo-a-passo.tsx`, `ocorrencia/[id].tsx`, `checklist.tsx`, `contas.tsx`, `guardioes.tsx`, `relato.tsx` (listas fixas ou de no máximo ~10 itens, dispensados). `rota.tsx` já usa `FlatList`. |
| 14 `paddingTop` mágico | 0 | Limpo. |
| 36 `useNativeDriver: false` | 0 | Limpo (o app não tem animação nenhuma, ver FINDING-013). |
| 32 `Alert.alert` | 3 em `ajustes.tsx:131,154,156` | Dois são confirmação destrutiva (permitido). `ajustes.tsx:156` é mensagem de erro: dispensado, polish. |
| 5 `shadowColor` sem `elevation` | 0 | Limpo (não há sombra). |
| `GestureHandlerRootView` | 0 | Dispensado: nenhuma tela usa gesto nem bottom sheet. |
| 15 chevron em linha não navegável | 0 chevron | Limpo. |
| 19 alvo pequeno | todos `Pressable` com `minHeight`/`minWidth` de 48 | Limpo. |
| 4 chip de ícone, 8 trio de estatística, 9 blur, 10 confete de selo, 11 raio exagerado | 0, 0, 0, 1 selo por cartão, raio 12 em 19 usos e 999 só no selo | Limpo. |
| Safe area (tell 23) | **0 usos** de `useSafeAreaInsets` ou `SafeAreaView` em `src/app` e `src/ui`, apesar de `react-native-safe-area-context` instalado | Procedente (FINDING-002). |

---

## Narração de primeira impressão e Trunk Test (prints reais)

### 11 Alarme do guardião (prioridade 1)
**Narração.** Meu olho vai direto ao título preto enorme "Alerta: Ana SINTETICO precisa de ajuda", e para aí. Abaixo, uma linha pequena ("Página de emergência · 13:48") e um botão cor de areia com contorno verde que parece secundário. O terço de cima e o terço de baixo são vermelho vazio; o botão está no meio da tela, longe do polegar. Parece a tela de erro de um sistema, não um alarme que precisa acordar e orientar alguém.

**Trunk Test.** Q1 (que app?): FAIL parcial, nada diz "Ampara" (`headerShown: false`, `alarme.tsx:201`). Q2 (que tela?): passa, "Alerta". Q4 (como volto?): voltar é travado de propósito (`alarme.tsx:142`), e o único caminho é "Estou ciente"; correto, mas a tela não explica. **PARTIAL** (não é FAIL: o usuário sabe que alguém precisa de ajuda e tem uma ação).

### 10 Início da vítima (prioridade 2)
**Narração.** Vejo cinco caixas brancas de mesma largura, mesmo contorno, mesmo peso. Meu olho vai ao botão verde "Achar meu chaveiro" por ser o único bloco colorido, depois pula para o título "Viu algo na rua?" que é o maior texto. A caixa "Rota" e "Último alerta" parecem rodapé de formulário. "Sem conexão" aparece duas vezes seguidas e um código técnico (`chaveiro-ampara-e2e001`) ocupa uma linha. O app não diz o que é: o cabeçalho diz "Início", não "Ampara".

**Trunk Test.** Q1: PARTIAL (aba raiz sem o nome do app no cabeçalho). Q2 e Q3 passam (cabeçalho e barra de abas). **PARTIAL.**

### Rota e BO (prioridade 3): só código, não há print
**Narração reconstruída do código (não é impressão de tela real).** `rota.tsx`: chips de dia, mapa, controle deslizante, botão "Foi aqui que me roubaram" e, depois, uma lista de horários com uma linha de 48 dp de contorno para cada ponto da rota (pode ter centenas). O botão que fecha o fluxo fica no meio do rolável e some quando a pessoa rola a lista. `bo.tsx`: seis seções empilhadas numa só rolagem (texto, delegacia, compartilhar, retorno, acompanhamento), com caixas de seleção desenhadas por caracteres (`◉ ○ ☑ ☐`).

**Trunk Test (reconstruído).** `rota.tsx` e `bo.tsx` usam o cabeçalho nativo com seta de voltar; Q2 e Q4 passam. **PASS**, pendente de confirmação em print.

### 08 Consentimento da rota / onboarding (prioridade 4)
**Narração.** Vejo o título do cabeçalho ("Sua rota"), a barra de progresso, o título grande ("Guardar a sua rota") e um parágrafo de cinco linhas. Dois botões ficam logo abaixo e o resto da tela, mais da metade, é areia vazia. A promessa que mais importa ("Só você vê") está enterrada no meio do parágrafo.

**Trunk Test.** Q2 passa (com três níveis de título repetindo o assunto). Q3 passa ("Passo 2 de 8"). Q4: sem seta de voltar (`onboarding/_layout.tsx:12`, `headerBackVisible: false`) e sem botão "Voltar" nesta tela. **PARTIAL.**

### Demais telas

| Print | Tela | Q1 | Q2 | Q3 | Q4 | Veredito |
|---|---|---|---|---|---|---|
| 01 | Entrar | PARTIAL (nome só no cabeçalho, sem marca) | PASS | n/a | n/a | PARTIAL |
| 04 | IMEI | n/a | PASS | PARTIAL ("Passo 3 de 4" contradiz "de 8" do resto) | PARTIAL (só botão "Voltar" no corpo) | PARTIAL |
| 05, 06, 07, 09 | Onboarding | n/a | PASS | PASS | PARTIAL (sem seta, sem "Voltar") | PARTIAL |
| 12 | Passo a passo | n/a | PASS | PASS ("1 de 5 feitos") | PASS (seta) | PASS |
| 16 | Mapa | n/a | PASS (título repetido) | PASS (aba) | PASS | PASS |
| 19 | Ajustes | n/a | PASS | PASS | PASS | PASS |

Nenhum FAIL, então nenhum achado de impacto alto vem do Trunk Test.

---

## Notas por categoria

| Categoria | Nota | Conta |
|---|---|---|
| 1. Navegação e IA | C (2,0) | 4,0 − 1 alto − 2×0,5 |
| 2. Anatomia de tela | D (1,0) | 4,0 − 2 altos − 2×0,5 (FINDING-006 e 007) |
| 3. Tipografia | B (3,0) | 4,0 − 2×0,5 |
| 4. Cor e tema | A- (3,5) | 4,0 − 1×0,5 |
| 5. Superfícies e agrupamento | B (3,0) | 4,0 − 2×0,5 |
| 6. Estados | B (3,0) | 4,0 − 2×0,5 |
| 7. Interação e movimento | A- (3,5) | 4,0 − 1×0,5 |
| 8. Formulários | A- (3,5) | 4,0 − 1×0,5 |
| 9. Desempenho | A- (3,5) | 4,0 − 1×0,5 |
| 10. Texto e conteúdo | B (3,0) | 4,0 − 2×0,5 |
| **Média** | **2,90** | |

**Design Score: B** (2,90 dá B por si; o teto de B por achado alto aberto confirma o resultado).
**AI Slop Score: A-** (3,6), só com achados mapeados a um tell numerado: tell 3, tell 1, tell 23, tell 35, tell 37, tell 13.

---

## Achados por impacto

Formato do rubric: `FINDING-NNN [impacto | categoria]`.

### Alto

```
FINDING-001 [alto | anatomia] Alarme do guardião: composição vazia, ação fora da zona do polegar, sem contexto
  onde: app/src/app/guardiao/alarme.tsx:200-215 e 263-267 (tela: justifyContent 'center'; titulo 32/40)
  evidência: print 11-alarme.png. Título em y~1000-1150 de 2400 (42-48 %), botão "Estou ciente" em y~1320-1445
             (55-60 %), ~40 % do topo e ~40 % da base são vermelho vazio. Subtítulo único: "Página de emergência · 13:48".
             Não há onde está a pessoa, nem como ligar para ela, nem o que "ciente" faz (a explicação existe só como
             accessibilityHint, alarme.tsx:212). O botão "Estou ciente" usa a variante 'secundario' (areia com contorno),
             a mesma aparência de qualquer botão de segunda ordem do app, na tela mais importante.
  tell: nenhum numerado (tell 22 não se aplica: interstício é a exceção permitida). Propor novo tell: "ALARME SEM ÂNCORA".
  fix: recompor em três faixas: (1) faixa de marca e hora no topo ("Ampara", "agora 13:48", rótulo de origem em
       linguagem de gente, não "Página de emergência"); (2) bloco do meio com o nome grande, uma frase do que fazer
       ("Toque para avisar que você vai ajudar") e o que já se sabe; (3) botão "Estou ciente" ancorado na base,
       largura total, >= 56 dp, com folga da área segura (FINDING-002). Mantém: fundo alarme, texto preto sobre alarme
       (5,4:1), botão claro com contorno petróleo (contraste já testado), fases e acessibilidade como estão.
```

```
FINDING-002 [alto | anatomia] Nenhuma tela respeita a área segura inferior (barra de gestos do Android)
  onde: todas as telas rolantes com padding fixo, ex.: onboarding/emergencia.tsx:56, onboarding/guardioes.tsx:103,
        guardiao/passo-a-passo.tsx:125; estilos `tela: { padding: espacos.m }` repetido em ~15 arquivos.
        0 usos de useSafeAreaInsets/SafeAreaView em src/app e src/ui (react-native-safe-area-context está no package.json).
  evidência: 09-codigo-emergencia.png: o botão "Salvar" termina em y~2378 de 2400 com a barra de gestos (y~2368) sobre ele.
             06-convite-qr.png: "Atualizar a lista" no mesmo caso. 12-passo-a-passo.png: o botão "Abrir o Celular Seguro"
             fica sob a barra de gestos. Confirmar rolando até o fim em aparelho; nos prints dá para ver a sobreposição.
  tell: #23 EDGE-TO-EDGE AMNESIA
  fix: padding inferior = insets.bottom + espacos.m em todo ScrollView/FlatList de tela (um helper em ui/, ex.
       <Tela> que aplica insets), e no rodapé fixo do alarme. Não muda rotas nem contratos.
```

```
FINDING-003 [alto | navegação] Aba ativa só se distingue por um tom quase igual, sem ícone nem indicador
  onde: app/src/app/(tabs)/_layout.tsx:20-26 (tabBarActiveTintColor petroleo, tabBarInactiveTintColor tinta,
        tabBarIcon: () => null, tabBarIconStyle display none)
  evidência: prints 10, 16, 19. "Início" ativo em petróleo e as outras em tinta: a razão de contraste entre as duas
             cores de rótulo é ~1,7:1 (petróleo L~0,06 contra tinta L~0,014). Mesmo peso (semibold), mesmo tamanho, sem
             pílula nem barra. Quebra a regra do próprio projeto ("estado nunca só por cor") e deixa o usuário sem saber
             onde está sem ler o cabeçalho.
  tell: nenhum numerado. Propor tell: "ABA SEM INDICADOR".
  fix: indicador não-cor na aba ativa (pílula de areia/esmeralda sob o rótulo ou barra superior de 3 dp) e ícone de
       uma família só (ex.: @expo/vector-icons, já parte da Expo). ATENÇÃO: ícone de aba está na lista "nunca mudar em
       silêncio" do redesign-protocol; levar ao Pedro antes. Um indicador de seleção sem ícone já resolve o contraste
       e não mexe em ordem nem rotas.
```

### Médio

```
FINDING-004 [médio | navegação] Onboarding sem seta de voltar e com botão "Voltar" só em parte das telas
  onde: app/src/app/onboarding/_layout.tsx:12 (headerBackVisible: false); "Voltar" no corpo só em imei.tsx:108,143,154;
        ausente em consentimento.tsx, chaveiro.tsx, emergencia.tsx, guardioes.tsx, contas.tsx.
  evidência: prints 05-09 sem seta; print 04 com "Voltar" no corpo. Trunk Test Q4 PARTIAL em 7 telas.
  tell: relacionado ao #27 (voltar manual) no IMEI.
  fix: decidir um modelo só. Como o ProgressoPassos já mostra "Passo X de 8", mostrar a seta do cabeçalho em todos os
       passos (voltar sem perder o que foi salvo) e remover o "Voltar" manual do IMEI, que passa a navegar internamente
       pelos sub-passos. Se voltar for proibido de propósito em algum passo, escrever isso na tela.
```

```
FINDING-005 [médio | navegação] Dois contadores de passo competem no IMEI e a marca não aparece nas abas
  onde: app/src/app/onboarding/imei.tsx:75 (`Passo ${passo + 1} de 4`) contra ui/ProgressoPassos.tsx:80 (de 8);
        títulos de cabeçalho das abas ("Início", "Mapa") sem o nome "Ampara": (tabs)/_layout.tsx:29-32.
  evidência: print 04 ("Passo 3 de 4", sem barra) e prints 05-09 ("Passo X de 8", com barra). Print 10: a palavra
             "Ampara" só aparece no corpo do texto.
  fix: no IMEI usar o mesmo ProgressoPassos e chamar os sub-passos de outra forma ("1 de 4" dentro do passo, em
       legenda secundária) ou fundir; nas abas, mostrar o nome do app no cabeçalho do Início (marca discreta).
```

```
FINDING-006 [médio | anatomia] Entrar: o caminho de emergência fica no mesmo nível de "Criar conta" e a tela tem metade vazia
  onde: app/src/app/entrar.tsx:90-147 (três botões iguais: Entrar, Criar conta, "Estou no aparelho de outra pessoa")
  evidência: print 01. Os três têm mesma largura e altura; os dois últimos têm exatamente a mesma aparência de contorno.
             Metade inferior da tela vazia. "Estou no aparelho de outra pessoa" é o caminho da vítima após o roubo, o
             momento mais crítico da história do produto, e não se destaca nem explica.
  fix: Entrar como ação principal; "Criar conta" como link/texto secundário; "Estou no aparelho de outra pessoa"
       como bloco próprio, com uma frase ("Seu celular foi roubado?") e ação visualmente distinta, ancorado na base.
       Sem mudar o fluxo nem os campos.
```

```
FINDING-007 [médio | anatomia] Onboarding: três níveis de título, parágrafos longos e conteúdo sem ancoragem da ação
  onde: onboarding/consentimento.tsx:99,107-110; emergencia.tsx:57-70; chaveiro.tsx:109-117; guardioes.tsx; ProgressoPassos
  evidência: prints 08, 09, 07. Título do cabeçalho + título grande repetindo o mesmo assunto ("Sua rota" / "Guardar a
             sua rota"; "Código de emergência" / "Seu código de emergência"), parágrafo de 5 a 7 linhas em corpo 18/26,
             e o botão principal fica logo abaixo do texto no alto da tela (08) ou no fim de quatro campos (09).
  tell: nenhum (dentro de #31, não se trata de três slides).
  fix: um nível de título só (o cabeçalho nativo ou o H1, não os dois); parágrafo em 2 a 3 linhas com a promessa
       principal em negrito; ação principal ancorada na base com folga de área segura. Sem cortar o texto legal.
```

```
FINDING-008 [médio | tipografia] Escala tipográfica achatada e sem tokens: H1 = título de cartão = título de seção
  onde: app/src/ui/Texto.tsx:24 (titulo 24/32); tamanhos soltos: bo.tsx:304, rota.tsx:256, passo-a-passo.tsx:202,
        checklist.tsx:85, contas.tsx:145, guardioes.tsx:168 (20/28), bo.tsx:313 e contas.tsx:143 (28), alarme.tsx:266 (32/40),
        guardioes.tsx:171 (40), relato.tsx:218 (20); tokens.ts não tem escala de tipo.
  evidência: print 16: "Mapa" (H1), "Legenda" e "Camadas" têm o mesmo tamanho e peso; print 10: "Rota" e "Viu algo na rua?"
             com o mesmo peso do conteúdo vizinho. Só existem 3 variantes (titulo, corpo, legenda) e 6 tamanhos improvisados.
  tell: nenhum numerado (drift de sistema).
  fix: escala em tokens.ts (exibição 32/40, título de tela 26/34, título de seção 20/28, corpo 18/26, legenda 16/22),
       com `Texto` ganhando as variantes e as telas passando a usá-las; nomes de token existentes ficam. Manter piso de 16.
```

```
FINDING-009 [médio | cor] Interruptor desligado quase invisível e inconsistente entre telas (DRIFT do tokens.ts)
  onde: app/src/app/(tabs)/ajustes.tsx:38-46 (trackColor só { true: petroleo }, thumbColor branco);
        contraste com mapa.tsx:251 que usa false: coresApoio.cinzaChave; tokens.ts:39 declara cinzaChave "mapa e interruptor".
  evidência: print 19: os dois interruptores desligados são um círculo claro sobre trilho cinza claro, sem borda; o estado
             mais importante do app (receber alarmes como guardião) é o mais difícil de ler. Contraste não-texto abaixo de 3:1.
  fix: trackColor false = cinzaChave (como no mapa), thumb branco com borda; ligado = petróleo com texto "Ligado/Desligado"
       ao lado, para não depender só de cor. Já existe o token, só falta ligar.
```

```
FINDING-010 [médio | superfícies] Pilha de cartões idênticos em Início (5) e Ajustes (7)
  onde: (tabs)/index.tsx:149-197 e estilo `caixa` em :204; (tabs)/ajustes.tsx:229-326 e estilo em :329;
        ui/CartaoChaveiro.tsx:206; guardiao/passo-a-passo.tsx:190-197
  evidência: prints 10, 19. Cada caixa: fundo branco, borda 2 px petróleo, raio 12, padding 16, mesma altura de título.
             O cartão do chaveiro (função central) pesa igual a "Último alerta". Sete caixas em Ajustes sem agrupamento.
  tell: #3 THE CARD-STACK SCREEN, #21 SETTINGS AS FLAT LIST (parcial)
  fix: Início: um bloco herói (estado do chaveiro e "Achar meu chaveiro") em superfície petróleo ou esmeralda suave, e o
       resto como lista agrupada com divisores finos, não caixas. Ajustes: seções com título pequeno em caixa-alta leve,
       linhas dentro de uma superfície única, ação destrutiva por último em vermelho (já é a última, `ajustes.tsx:316`).
```

```
FINDING-011 [médio | tipografia] Glifos Unicode usados como ícone (dependem da fonte do aparelho)
  onde: ui/EstadoBadge.tsx:155-162 (⚠ ✕ ■ ◇ ● ○ ✓ ◔); bo.tsx:30,246 (◉ ○ ☑ ☐ em corpo 28); `⚠ ` em 35 pontos de 21 arquivos
        (ex.: Campo.tsx:123, alarme.tsx:228, bo.tsx, rota.tsx:132, consentimento.tsx)
  evidência: nos prints o selo "○ Sem conexão" (10) renderiza por fallback da Manrope, que não tem esses glifos; em
             aparelhos com Noto Color Emoji, ⚠ vira emoji colorido e foge da paleta. Altura e alinhamento variam por fonte.
  tell: #1 THE EMOJI ICON (variante: glifo em vez de ícone)
  fix: um conjunto de ícones vetoriais (Svg já instalado: react-native-svg) com 6 a 8 ícones (aviso, ok, offline, selo...)
       num componente `Icone`, e o `EstadoBadge`, `Campo` e os controles do BO consumindo-o. Manter texto ao lado: o
       estado continua nunca só por ícone.
```

```
FINDING-012 [médio | estados] Carregamento só como texto "Carregando..." e erro do mapa sem tentar de novo
  onde: (tabs)/index.tsx:140,167,195; (tabs)/ajustes.tsx:241 (cartão do Chaveiro); historico.tsx:73; rota.tsx:136;
        guardiao/passo-a-passo.tsx:139; (tabs)/mapa.tsx:189 (só `aviso`, nenhum "Tentar de novo", ao contrário de bo/rota/historico)
  evidência: print 19: o cartão "Chaveiro" fica em "Carregando..." enquanto o resto da tela já carregou; print 16: com a API
             fora, "Não deu para carregar o risco agora." sem ação, e a lista de camadas e a legenda seguem mostrando
             como se houvesse dado.
  tell: #37 SPINNER-ONLY LOADING (variante: texto de carregamento)
  fix: esqueleto do cartão do chaveiro e da lista; no mapa, botão "Tentar de novo" ao lado do aviso e legenda em
       cinza-sem-dado enquanto o risco não vem. Estado vazio e erro já existem, só o carregamento e o retry faltam.
```

```
FINDING-013 [médio | interação] Feedback de toque fraco e inconsistente, e nenhum movimento ou háptico
  onde: ui/Botao.tsx:34-38,63 (só opacity 0.85, sem ripple Android); Pressable sem estado `pressed`:
        historico.tsx:81, bo.tsx:25,235, onboarding/contas.tsx:92, relato.tsx:159, rota.tsx:146,220.
        Nenhuma animação no app: sem Reanimated, sem expo-haptics (só Vibration no alarme, alarme.tsx:128).
  evidência: leitura de código (não dá para ver feedback em print). 7 Pressables sem nenhuma resposta ao toque;
             "Foi aqui que me roubaram" (rota.tsx:190) e "Achar meu chaveiro" confirmam só por texto depois.
  tell: #35 THE OPACITY FLASH
  fix: `android_ripple` e escala de 0,98 no Botao e num `LinhaToque` único usado pelos 7 Pressables; háptico leve de
       confirmação nas ações que mudam estado (ciente, achar chaveiro, marcar momento). Usar `expo-animation` e respeitar
       reduzir movimento. Nenhum movimento no alarme que ameace a leitura.
```

```
FINDING-014 [médio | formulários] Campos de senha sem mostrar/ocultar, sem teclado encadeado e sem tratamento do teclado
  onde: entrar.tsx:122,125; onboarding/conta.tsx:50; ui/Campo.tsx (sem botão de olho, sem returnKeyType/onSubmitEditing);
        emergencia.tsx:56-103 (quatro campos em ScrollView sem KeyboardAvoidingView)
  evidência: print 01 e 09: campos de senha vazios sem forma de conferir o que foi digitado; público de todas as idades,
             incluindo quem digita no escuro. A tela de emergência exige repetir código e palavra: erro de digitação aqui
             trava o acesso depois do roubo. Teclado ao vivo não verificado (print 04 mostra só o IMEI, sem campo coberto).
  tell: #20 KEYBOARDAVOIDING ROULETTE (suspeita, não confirmada)
  fix: botão "Mostrar" acessível dentro do Campo (>= 48 dp), `returnKeyType="next"/"done"` com `onSubmitEditing`
       encadeado, e teste real do teclado nos formulários longos.
```

```
FINDING-015 [médio | desempenho] Lista de ocorrências sem limite dentro de ScrollView
  onde: (tabs)/historico.tsx:65,76 (`ScrollView` com `linhas.map`)
  evidência: leitura de código. O histórico cresce com cada ocorrência; `rota.tsx:208` já usa FlatList corretamente.
  tell: #13 SCROLLVIEW-OF-MAP
  fix: FlatList com `keyExtractor` e `getItemLayout`/altura fixa; o cabeçalho (título e SairEmergencia) vira
       `ListHeaderComponent`. Sem mudar rota nem contrato.
```

```
FINDING-016 [médio | texto] Erro de português no texto principal do Início
  onde: (tabs)/index.tsx:180 ("o que e onde" sem acento: deve ser "o que é e onde")
  evidência: print 10, caixa "Viu algo na rua?". Aparece na tela mais vista do vídeo.
  fix: "Conte em poucas palavras o que aconteceu e onde, sem descrever pessoas." (o que "é" confunde; trocar a frase).
       Verificar também o teste `textos-proibidos.test.ts` antes de editar.
```

```
FINDING-017 [médio | texto] Texto técnico e de demonstração vazando para o usuário
  onde: ui/CartaoChaveiro.tsx:182 (mostra deviceId cru "chaveiro-ampara-e2e001") e :181 (badge "Sem conexão" + texto
        "Sem conexão. Bateria: não informada" repetindo); onboarding/chaveiro.tsx:112 (nota "Na demonstração o código tem
        um final aleatório (chaveiro-ampara-xxxxxx)" visível no onboarding); onboarding/contas.tsx (linhas "Link:
        https://inter.co/canais-de-atendimento/" em texto cru); (tabs)/ajustes.tsx:283 (cartão "Modo demonstração" no mesmo
        nível de Chaveiro e Rota); alarme: "Página de emergência" como rótulo de origem (guardiao/notificacao rotuloOrigem).
  evidência: prints 10, 07, 05, 11, 19.
  fix: mostrar o apelido do chaveiro (ou o código só em "Detalhes"), um único estado, nota de demonstração só com o modo
       demonstração ligado, links como botão "Abrir site", "Modo demonstração" no fim de Ajustes sob "Avançado",
       rótulo de origem em linguagem natural ("Chaveiro", "Página de emergência" vira "Aviso pelo link de emergência").
```

### Polish (listado, não pontuado)

- **FINDING-018 [polish | tipografia]** Título repetido no cabeçalho e no corpo: `(tabs)/mapa.tsx:188` ("Mapa" em cabeçalho e H1), `historico.tsx:66`, `bo.tsx:199-201`, `passo-a-passo.tsx:126-128`.
- **FINDING-019 [polish | superfícies]** Raio, borda e sombra não têm token: `borderRadius: 12` e `borderWidth: 2` repetidos em 19 e ~20 pontos; `tokens.ts` só tem cores, tamanhos mínimos, espaços 8/16/24 e fontes. Espaços fora da escala: 2, 4, 6 e 12 em 9 pontos. Criar `raios`, `bordas` e `espacos` ampliados (nomes atuais ficam).
- **FINDING-020 [polish | superfícies]** O contorno petróleo de 2 px em tudo (cartão, campo, botão secundário, selo) achata a hierarquia: botão secundário e cartão têm o mesmo vocabulário. Distinguir por preenchimento tonal (areia sobre branco) e deixar o contorno para foco e erro.
- **FINDING-021 [polish | cor]** Só há tema claro (`app.config.ts:11`, `userInterfaceStyle: 'light'`, 0 usos de `useColorScheme`). Um alarme vermelho de tela cheia à noite é agressivo; avaliar atenuar o brilho do fundo sem sair do vermelho de marca. Não é pendência de marca; decisão do Pedro.
- **FINDING-022 [polish | interação]** Botão desabilitado com `opacity: 0.5` (`Botao.tsx:64`) reduz o contraste do rótulo; WCAG isenta desabilitado, mas "Enviar à polícia" (`bo.tsx`) depende dele para explicar a pré-condição. Escrever o motivo ao lado.
- **FINDING-023 [polish | navegação]** Entrada duplicada para "Tenho um código de convite": `(tabs)/index.tsx:159-163` e `(tabs)/ajustes.tsx:263`.
- **FINDING-024 [polish | estados]** Rota e BO: a lista de horários (`rota.tsx:216-233`) tem uma linha de 48 dp com contorno por ponto; para uma rota longa é um muro. Agrupar por hora ou recolher.
- **FINDING-025 [polish | texto]** Travessão em texto visível: `ocorrencia/[id].tsx:87` (usar vírgula ou "às").
- **FINDING-026 [polish | interação]** `Alert.alert` para erro de saída em `ajustes.tsx:156` (as outras duas são confirmação destrutiva, permitidas).

---

## Baseline de regressão

Não gravei `design-baseline.json` em disco: a tarefa limitou a escrita aos documentos pedidos, então o JSON fica aqui no relatório. Para a próxima rodada, salve-o em `app/design-baseline.json` (raiz do projeto do app) e a skill passa a reportar o delta primeiro.

```json
{
  "tool": "mobile-design-review",
  "version": 1,
  "date": "2026-11-16",
  "designScore": "B",
  "slopScore": "A-",
  "categories": {
    "navigation": "C",
    "screenAnatomy": "D",
    "typography": "B",
    "colorTheming": "A-",
    "surfaces": "B",
    "states": "B",
    "interactionMotion": "A-",
    "forms": "A-",
    "performance": "A-",
    "copy": "B"
  },
  "findings": [
    { "id": "FINDING-001", "impact": "high", "category": "screenAnatomy", "summary": "Alarme do guardiao: composicao vazia, acao fora da zona do polegar, sem contexto", "status": "open" },
    { "id": "FINDING-002", "impact": "high", "category": "screenAnatomy", "summary": "Sem area segura inferior em nenhuma tela (tell 23)", "status": "open" },
    { "id": "FINDING-003", "impact": "high", "category": "navigation", "summary": "Aba ativa so por tom quase igual, sem icone nem indicador", "status": "open" },
    { "id": "FINDING-004", "impact": "medium", "category": "navigation", "summary": "Onboarding sem seta de voltar e Voltar so em parte das telas", "status": "open" },
    { "id": "FINDING-005", "impact": "medium", "category": "navigation", "summary": "Dois contadores de passo no IMEI; marca ausente nas abas", "status": "open" },
    { "id": "FINDING-006", "impact": "medium", "category": "screenAnatomy", "summary": "Entrar: caminho de emergencia no mesmo nivel de Criar conta; metade vazia", "status": "open" },
    { "id": "FINDING-007", "impact": "medium", "category": "screenAnatomy", "summary": "Onboarding: tres niveis de titulo e paragrafos longos, acao sem ancoragem", "status": "open" },
    { "id": "FINDING-008", "impact": "medium", "category": "typography", "summary": "Escala tipografica achatada e sem tokens", "status": "open" },
    { "id": "FINDING-009", "impact": "medium", "category": "colorTheming", "summary": "Interruptor desligado quase invisivel; cinzaChave nao usado em Ajustes (drift)", "status": "open" },
    { "id": "FINDING-010", "impact": "medium", "category": "surfaces", "summary": "Pilha de cartoes identicos em Inicio e Ajustes (tell 3)", "status": "open" },
    { "id": "FINDING-011", "impact": "medium", "category": "typography", "summary": "Glifos Unicode como icone (tell 1)", "status": "open" },
    { "id": "FINDING-012", "impact": "medium", "category": "states", "summary": "Carregando so em texto; mapa sem tentar de novo (tell 37)", "status": "open" },
    { "id": "FINDING-013", "impact": "medium", "category": "interactionMotion", "summary": "Feedback de toque fraco, sem ripple, sem haptico (tell 35)", "status": "open" },
    { "id": "FINDING-014", "impact": "medium", "category": "forms", "summary": "Senha sem mostrar/ocultar e sem teclado encadeado", "status": "open" },
    { "id": "FINDING-015", "impact": "medium", "category": "performance", "summary": "Historico em ScrollView-de-map (tell 13)", "status": "open" },
    { "id": "FINDING-016", "impact": "medium", "category": "copy", "summary": "'o que e onde' sem acento no Inicio", "status": "open" },
    { "id": "FINDING-017", "impact": "medium", "category": "copy", "summary": "Texto tecnico e de demonstracao vazando", "status": "open" },
    { "id": "FINDING-018", "impact": "polish", "category": "typography", "summary": "Titulo repetido no cabecalho e no corpo", "status": "open" },
    { "id": "FINDING-019", "impact": "polish", "category": "surfaces", "summary": "Raio, borda e espacos sem token", "status": "open" },
    { "id": "FINDING-020", "impact": "polish", "category": "surfaces", "summary": "Contorno de 2 px em tudo achata a hierarquia", "status": "open" },
    { "id": "FINDING-021", "impact": "polish", "category": "colorTheming", "summary": "Sem tema escuro; alarme a noite", "status": "open" },
    { "id": "FINDING-022", "impact": "polish", "category": "interactionMotion", "summary": "Desabilitado so por opacity", "status": "open" },
    { "id": "FINDING-023", "impact": "polish", "category": "navigation", "summary": "Entrada duplicada do codigo de convite", "status": "open" },
    { "id": "FINDING-024", "impact": "polish", "category": "states", "summary": "Lista de horarios da rota longa demais", "status": "open" },
    { "id": "FINDING-025", "impact": "polish", "category": "copy", "summary": "Travessao em texto visivel (tell 33)", "status": "open" },
    { "id": "FINDING-026", "impact": "polish", "category": "interactionMotion", "summary": "Alert.alert para erro de saida (tell 32)", "status": "open" }
  ],
  "unverified": [
    "teclado em aparelho (campos cobertos, KeyboardAvoiding)",
    "fonte do sistema em 1,3x e 2x (quebra de layout, truncamento)",
    "barra de gestos no fim da rolagem (sobreposicao vista em prints 06, 09, 12; confirmar)",
    "rota, BO, relato, ocorrencia, historico, aceitar sem print",
    "alarme nos estados enviando, erro, encerrado e confirmado",
    "modo escuro (nao existe) e brilho do alarme a noite",
    "TalkBack real (so rotulos lidos no codigo)",
    "desempenho de rolagem e do mapa MapLibre em aparelho de entrada",
    "mapa com API no ar (print 16 e com API fora)",
    "emulador unico: 1080x2400; telas pequenas (360x640) nao testadas"
  ]
}
```

---

## Não verificado (explícito)

Passe ao vivo parcial: apenas prints de um emulador. **Não verificados:** teclado em aparelho (campos cobertos), escala de fonte 1,3x e 2x, tela de splash, rolagem real até o fim com a barra de gestos (FINDING-002 vem da sobreposição visível nos prints), desempenho de rolagem e do mapa, modo escuro (não existe), TalkBack real, telas pequenas, estados do alarme além de "tocando", e as telas sem print (rota, BO, relato, ocorrência, histórico, aceitar). A contagem de `⚠` (35 em 21 arquivos) foi feita por busca literal; o `grep -P` de faixa astral falhou nesta plataforma.

Observação: o print `06-convite-qr.png` mostra "Vale por 1439:51"; o código atual já formata em horas (`guardioes.tsx:25`, commit `260fb80`), então o print é anterior à correção e **não** conta como achado.

---

## Ordem de correção recomendada (alavancas do protocolo de redesenho)

A ordem do `redesign-protocol.md`: (1) escala tipográfica e ritmo de espaço, (2) cor em tokens semânticos, (3) estados completos, (4) feedback de toque e movimento, (5) recomposição de tela, (6) navegação (por último, com aprovação).

Aplicada ao prazo (19/11 23h55, e o CLAUDE.md pede: auditoria, as duas telas mais vistas no vídeo, prints antes e depois):

1. **Base (1 passe, destrava tudo):** FINDING-008 (escala de tipo em `tokens.ts` e `Texto`), FINDING-019 (raio, borda e espaço em token), FINDING-002 (componente `<Tela>` com área segura), FINDING-009 (interruptor, já tem token). Baixo risco, nenhuma rota muda.
2. **Alarme do guardião (prioridade 1):** FINDING-001 recomposição, com FINDING-013 (háptico e ripple no "Estou ciente") e FINDING-017 (rótulo de origem em linguagem natural). Skill `mobile-redesign-screen`, depois `expo-animation` para o toque.
3. **Início da vítima (prioridade 2):** FINDING-010 (bloco herói do chaveiro, lista agrupada), FINDING-016 e FINDING-017 (texto), FINDING-012 (esqueleto), FINDING-011 (ícones vetoriais, junto com o `EstadoBadge`).
4. **Barra de abas:** FINDING-003 só com o indicador (sem ícone) até o Pedro aprovar ícones; FINDING-005 (marca no Início).
5. **Rota e BO (prioridade 3):** botão principal ancorado em `rota.tsx` e `bo.tsx`, FINDING-015 (histórico em FlatList), FINDING-024.
6. **Onboarding (prioridade 4):** FINDING-004, 006, 007 (título e ação ancorada), FINDING-014 (mostrar senha).
7. **Fora do prazo, se sobrar tempo:** FINDING-018 a 023, 025, 026.

Cada tela termina com print antes e depois (`adb exec-out screencap -p` ou `app/scripts/prints.sh`) e nova crítica, antes dos prints finais de `app/docs/prints`. Mudanças que exigem aprovação do Pedro: ícones de aba (FINDING-003), qualquer mudança de ordem ou rota de navegação, e nomes de token consumidos (o redesenho só adiciona tokens, não renomeia).
