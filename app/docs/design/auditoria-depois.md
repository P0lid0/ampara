# Auditoria de design do app Ampara, depois do redesenho (Expo)

Skill: `mobile-design-review`, modo só-relatório. Nenhum arquivo de código foi editado; este documento é a única escrita.
Data: 2026-11-16. Escopo: `app/src/app/**`, `app/src/ui/**`, `app/src/theme/**`. Entrega: 19/11/2026 23h55.
Comparação: `app/docs/design/auditoria-app.md` (antes: **Design B, AI Slop A-**, 3 achados altos, 14 médios, 9 de polimento).
Compromissos usados para apontar DRIFT: `app/MOBILE-DESIGN.md`, `CLAUDE.md` do projeto, marca e regras de acessibilidade.

## Resultado em uma tela

| | Antes | Depois (só código) |
|---|---|---|
| **Design Score** | B (2,90, teto de B por 3 altos) | **A-** (3,6) |
| **AI Slop Score** | A- (3,6) | **A** (3,8) |
| Achados altos abertos | 3 | **0 confirmados** (1 suspeita média-alta, FINDING-D01, que só aparelho resolve) |
| Achados médios abertos | 14 | **6** |

**Leia a nota com a ressalva certa.** É nota de código, sem APK novo e sem print. A skill dá teto de B enquanto houver alto aberto; não há nenhum confirmado, então o teto não se aplica. Mas o que o antigo relatório mais pesou (composição do alarme, hierarquia do Início, área segura) é visual, e a nota só se sustenta se os prints confirmarem. Se o print do alarme ou do Início mostrar problema, a nota cai: trate o A- como teto provisório, não como entrega aceita.

Verificação feita nesta rodada (evidência, não declaração): `npx tsc --noEmit` sai 0; `npx jest --ci` na segunda rodada: **55 suítes, 687 testes, todos verdes**. Na primeira rodada completa houve 2 falhas (uma em `onboarding/__tests__/guardioes.test.tsx:62`, um `findByText` que estourou; a outra suíte não identifiquei), a máquina estava carregada e o mesmo arquivo passou isolado (11 suítes, 122 testes) e na rodada completa seguinte. Trato como teste lento sob carga, não como regressão, mas vale ficar de olho (`findByText` sem `timeout` explícito).

---

## Delta contra o baseline (primeiro, como manda a skill)

Não havia `design-baseline.json` em disco; usei o JSON embutido em `auditoria-app.md` como baseline.

### Categorias

| Categoria | Antes | Depois | Por quê |
|---|---|---|---|
| 1. Navegação e IA | C (2,0) | **A- (3,5)** | seta de voltar nos passos (`onboarding/_layout.tsx:15`), indicador não-cor na aba, contador único (`ProgressoPassos`) |
| 2. Anatomia de tela | D (1,0) | **A- (3,5)** | alarme em 3 faixas, `BarraAcao` com área segura em 7 telas, `TelaPasso` nas 9 de entrada/onboarding; sobra `aceitar.tsx` |
| 3. Tipografia | B (3,0) | **A- (3,5)** | escala em `tokens.ts:tipo`, `Texto` lê dela; sobra um glifo `⚠` (`aceitar.tsx:107`) |
| 4. Cor e tema | A- (3,5) | **A (4,0)** | 0 hexadecimal em tela, `alarmeTexto`, `textoSuave`, interruptor com `cinzaChave` e texto "Ligado/Desligado" |
| 5. Superfícies | B (3,0) | **A (4,0)** | herói petróleo, grupo único com divisores, tonal no secundário, contorno de 2 px só em campo |
| 6. Estados | B (3,0) | **A- (3,5)** | esqueleto e retry no mapa; carregamento ainda em texto em 5 pontos |
| 7. Interação e movimento | A- (3,5) | **A- (3,5)** | ripple, escala 0,98, háptica (Botao, Interruptor, alarme, relato); mas Reanimated instalado e sem uso |
| 8. Formulários | A- (3,5) | **A- (3,5)** | "Mostrar", `returnKeyType` encadeado; entra a suspeita do teclado (D01) |
| 9. Desempenho | A- (3,5) | **A- (3,5)** | `historico.tsx` ainda em ScrollView com `.map` |
| 10. Texto e conteúdo | B (3,0) | **A- (3,5)** | acento do Início corrigido, demo em "Avançado"; sobram `deviceId` cru e "Link:" cru |
| **Média** | 2,90 | **3,6** | |

Conta: 4,0 menos 0,5 por médio aberto da categoria; polimento não desconta.

### Achados antigos (26)

| Antes | Situação | Evidência |
|---|---|---|
| 001 alarme sem composição | **resolvido no código**, falta print | `alarme.tsx`: topo (Ampara, hora), meio (`exibicao` + `FRASE_ACAO`), base com `BarraAcao semSombra` e `Botao sobreAlarme` 64 dp; háptica forte após calar a sirene |
| 002 sem área segura | **resolvido, exceto uma tela** | `BarraAcao.tsx` soma `insets.bottom`; alarme usa `insets.top`; `aceitar.tsx` ficou de fora (novo D06) |
| 003 aba só por tom | **resolvido** | `(tabs)/_layout.tsx:11-27`: barra de 3 dp + peso bold + `textoSuave`; sem ícone na barra, como o Pedro decidiu |
| 004 onboarding sem voltar | **resolvido**, resíduo em polish | `headerBackVisible: true`; IMEI mantém "Voltar" manual dos sub-passos |
| 005 dois contadores / sem marca | **quase**: contador único sim; cabeçalho do Início segue "Início" | `ProgressoPassos.tsx`; `(tabs)/_layout.tsx:56` |
| 006 Entrar sem hierarquia | **resolvido** | `entrar.tsx:194-197`: "Seu celular foi roubado?" em bloco próprio; "Criar conta" como `texto` |
| 007 onboarding 3 títulos | **resolvido** | `TelaPasso`: um `titulo`, contador, ação ancorada; cabeçalho só "Ampara" (`_layout.tsx:10`) |
| 008 escala de tipo | **resolvido** | `tokens.ts` `tipo`; só sobra `Botao.tsx:103` (`fontSize: 20`) |
| 009 interruptor | **resolvido** | `Interruptor.tsx` |
| 010 pilha de cartões | **resolvido** | `index.tsx`: herói + `grupo` único; `ajustes.tsx` em `Grupo` com `TituloGrupo` |
| 011 glifos Unicode | **resolvido, exceto 1** | `Icone.tsx` (svg) em `EstadoBadge`, `Campo`, BO; resta `aceitar.tsx:107` |
| 012 carregamento só texto | **parcial** | esqueleto em Início/Ajustes/Mapa, mas com texto "Carregando..." junto; sem pulso |
| 013 toque sem feedback | **resolvido** | ripple + escala em `Botao`; `pressed` em todos os `Pressable` de linha |
| 014 senha e teclado | **resolvido no código**, falta aparelho | `Campo` `revelavel`; `returnKeyType` em `entrar`, `conta`, `chaveiro`; ver D01 |
| 015 histórico ScrollView-de-map | **aberto** | `historico.tsx:~110` (`(linhas ?? []).map`) |
| 016 "o que e onde" | **parcial** | `index.tsx:224` corrigido; `relato.tsx:165` ainda diz "o que e onde" |
| 017 texto técnico | **parcial** | demo foi para "Avançado"; origem do alarme em linguagem natural; restam `ajustes.tsx:254` e `contas.tsx:121` |
| 018 título repetido | não reavaliado | polish |
| 019 tokens de raio/borda | **quase**: 9 literais restam (ver Polimento) | |
| 020 contorno 2 px em tudo | **resolvido** | `Botao`: secundário `areiaFunda` + 1 px |
| 021 sem tema escuro | decisão do Pedro (sem escuro) | fechado |
| 022 desabilitado por opacity | **resolvido** | 0 `opacity:` em `src/app` e `src/ui` |
| 023 convite duplicado | **aberto** | `index.tsx:202` e `ajustes.tsx` |
| 024 lista de horários da rota | **aberto** | `rota.tsx` `LinhaHorario`: uma linha por ponto, sem agrupar por hora |
| 025 travessão | **aberto** | `ocorrencia/[id].tsx:103` |
| 026 `Alert.alert` de erro | **aberto** | `ajustes.tsx:175` |

Resolvidos de vez: 001, 003, 004, 006 a 010, 013, 020, 021, 022 (e 002, 005, 011, 014, 016 quase). Novos: D01 a D06 abaixo.

---

## Grep de tells (resultado e triagem)

| Tell | Resultado | Triagem |
|---|---|---|
| 1 emoji / glifo | 1 em JSX: `aceitar.tsx:107` (`⚠ ${aviso}`); `contas.tsx:145` é só comentário | Procedente (D05). Antes: 35 pontos. |
| 2 índigo / `LinearGradient` | 0 / 0 | Limpo |
| 3 pilha de cartões | Início: herói + grupo + bloco de relato (aviso de guardiões só condicional); Ajustes em `Grupo` | Limpo |
| 5 sombra sem `elevation` | 0 `shadowColor`; `boxShadow` só em `BarraAcao` | Limpo (sombra confirmar em aparelho de entrada) |
| 6 hexadecimal em tela | 0 em `src/app` e `src/ui` | Limpo |
| 7 pílula flutuante | `BarraAcao` está no fluxo, não `position: absolute` | Limpo |
| 13 ScrollView com `.map` | `historico.tsx` (lista de ocorrências sem limite): **procedente** (D04). Demais: `relato`, `bo`, `passo-a-passo`, `ocorrencia/[id]`, `contas`, `guardioes`, `mapa` são listas fixas ou limitadas (`slice(0, 10)` no mapa) e foram dispensadas | |
| 14 `paddingTop` mágico | 0 | Limpo |
| 15 chevron fora de linha navegável | 3 usos do ícone `voltar` rotacionado, todos em linhas que empurram tela | Limpo |
| 19 alvo pequeno | `Botao`, `Campo`, linhas e abas com `minHeight` de 48 ou mais; o "olho" do `Campo` tem 96x48 | Limpo |
| 22 `justifyContent: 'center'` em tela de dados | só dentro de componentes (botão, selo, esqueleto do mapa); alarme não centraliza mais | Limpo |
| 23 área segura | `BarraAcao` (7 telas) e `alarme.tsx`; **`aceitar.tsx` sem** | Procedente (D06) |
| 27 voltar manual | `imei.tsx:76` (sub-passos) | Dispensado como polish: navega entre sub-passos, não duplica o cabeçalho |
| 32 `Alert.alert` | 3: dois de confirmação destrutiva (permitido); `ajustes.tsx:175` é erro | Polish (026 aberto) |
| 33 travessão | 1: `ocorrencia/[id].tsx:103` | Polish (025 aberto) |
| 35 flash de opacidade | 0 `opacity:`; ripple + escala | Limpo |
| 36 `useNativeDriver: false` | 0 (não há `Animated`) | Limpo |
| 37 só spinner / texto de carregamento | `index.tsx:154,198`, `historico.tsx:82`, `ajustes.tsx:265`, `ocorrencia/[id].tsx:82` | Procedente (D02, variante) |

---

## Achados por impacto

### Alto
Nenhum confirmado em código. A suspeita D01 abaixo vira alto se o aparelho confirmar.

### Médio

```
FINDING-D01 [médio, suspeita | formulários] Barra de ação pode compensar o teclado duas vezes
  onde: app/src/ui/BarraAcao.tsx:13-40 (marginBottom = altura do teclado) contra
        app/android/app/src/main/AndroidManifest.xml:38 (windowSoftInputMode="adjustResize")
  evidência: leitura de código. Com adjustResize o Android já encolhe a janela; somar `marginBottom: teclado`
             pode deixar a barra flutuando acima do teclado com um vazio igual à altura dele, ou empurrá-la
             para fora em tela baixa. Vale para as 9 telas em TelaPasso e para BO, relato, rota e ocorrência.
             Em edge-to-edge (Android 15+) o comportamento muda de novo.
  tell: #20 KEYBOARDAVOIDING ROULETTE (suspeita)
  fix: NÃO corrigir às cegas. Provar no emulador com o teclado aberto em `entrar`, `emergencia` e `conta`
       (print). Se duplicar, remover o `marginBottom` e deixar o adjustResize agir, ou usar
       `KeyboardAvoidingView`/`KeyboardStickyView` num ponto só. Este é o ponto de maior risco da entrega
       porque trava o botão "Salvar" do código de emergência, o mais crítico do produto.
```

```
FINDING-D02 [médio | estados] Carregamento ainda em texto, sem pulso no esqueleto
  onde: (tabs)/index.tsx:154 e :198; (tabs)/historico.tsx:82; (tabs)/ajustes.tsx:265; ocorrencia/[id].tsx:82
  evidência: o esqueleto de `areiaFunda` existe em Início, Ajustes e Mapa, mas vem junto de "Carregando..."; em
             Histórico e Ocorrência é só spinner + texto. MOBILE-DESIGN.md 6 prometia pulso de opacidade 0,6 a 1.
  tell: #37 (variante)
  fix: esqueleto de linha em Histórico e Ocorrência, tirar o texto onde já há esqueleto (deixar só o rótulo de
       acessibilidade em região viva). Pulso só se for com reduzir-movimento respeitado.
```

```
FINDING-D03 [médio | interação] Reanimated e Gesture Handler adotados e sem uso; movimento prometido não existe
  onde: package.json (react-native-reanimated 4.7.1, react-native-gesture-handler ~3.3.0); `_layout.tsx:5`
        (só GestureHandlerRootView); 0 usos de Animated/Reanimated/useReducedMotion em src.
  evidência: grep. O Pedro aprovou as duas dependências, mas nenhuma tela entra, sai ou pulsa; a tabela de
             movimento de MOBILE-DESIGN.md 6 (fade de 200 ms, pulso do esqueleto, reduzir movimento) não foi feita.
             Custo: peso de build nativo sem retorno.
  fix: ou implementar o mínimo (fade de entrada de lista/aviso com `reduzirMovimento`, pulso do esqueleto) via
       skill `expo-animation`, ou registrar em MOBILE-DESIGN.md que ficou fora e não vender "animação" no vídeo.
       Alarme continua sem movimento, de propósito.
```

```
FINDING-D04 [médio | desempenho] Histórico segue em ScrollView com .map (antigo 015)
  onde: (tabs)/historico.tsx (`(linhas ?? []).map` dentro de ScrollView)
  tell: #13
  fix: FlatList com keyExtractor; título e SairEmergencia em ListHeaderComponent. Sem mudar rota nem contrato.
       O teste `historico.test.tsx` usa testID por linha: manter o `linha-ocorrencia-${id}`.
```

```
FINDING-D05 [médio | texto e tipografia] Resíduos de texto técnico e de glifo
  onde: (tabs)/ajustes.tsx:254 (`chaveiro.deviceId` cru "chaveiro-ampara-xxxxxx" na linha do Chaveiro);
        onboarding/contas.tsx:121 (`Link: ${c.link}`, URL crua em texto); relato.tsx:165 ("o que e onde" sem
        acento, antigo 016); guardiao/aceitar.tsx:107 (`⚠ ${aviso}` em vez de `Icone`, tells 1 e 3).
  fix: apelido ou "Detalhes" para o código; botão "Abrir site" no lugar do link cru (manter o `accessibilityLabel`
       com o link, os testes dependem); "Diga só o que aconteceu e onde."; `Aviso`/`Icone alerta` em `aceitar`.
       Conferir `textos-proibidos.test.ts` antes de mexer em texto.
```

```
FINDING-D06 [médio | anatomia] aceitar.tsx ficou fora do sistema (sem BarraAcao, sem área segura)
  onde: guardiao/aceitar.tsx:99-139 (ScrollView puro, botão "Aceitar convite" no fim do conteúdo)
  evidência: único fluxo de tarefa que não usa `TelaPasso`/`BarraAcao`; mesmo problema do antigo 002 e do RISK 4
             (ação principal que some com a rolagem e cai sob a barra de gestos).
  tell: #23
  fix: `BarraAcao` com "Aceitar convite" e os secundários, `TelaPasso`-like para o título; rotas e contratos intactos.
```

### Polimento (listado, não pontuado)

- **P-01** Literais que escaparam dos tokens: `ProgressoPassos.tsx:19-22` (`gap: 4`, `borderRadius: 4`, `borderWidth: 1`), `passo-a-passo.tsx:274-275` (segunda barra de progresso quase igual à de `ProgressoPassos`: extrair/reusar), `LeitorCodigo.tsx:66` e `MapaBase.tsx:153,161,166` (`borderRadius: 12`, `borderWidth: 2`, `3`), `mapa.tsx:357` (`borderRadius: 4`), `Botao.tsx:103` (`fontSize: 20`, deveria ser variante `rotuloAlarme` em `tipo`), `Campo.tsx:comOlho` (`paddingRight: 104` mágico). Os `borderWidth` de `mapa.tsx:41-44` são o padrão de borda do risco e ficam.
- **P-02** `Campo.tsx`: o botão "Mostrar/Ocultar" é `Pressable` sem ripple nem `pressed`.
- **P-03** O cabeçalho do Início continua "Início"; MOBILE-DESIGN.md 8.2 pedia "Ampara" discreto (a marca já aparece no herói e no alarme).
- **P-04** IMEI: seta do cabeçalho e "Voltar" de sub-passo coexistem; a seta sai do IMEI inteiro, o "Voltar" volta um sub-passo. Explicar ou unificar.
- **P-05** Convite duplicado: `index.tsx:202` e `ajustes.tsx` (antigo 023).
- **P-06** `rota.tsx` `LinhaHorario`: uma linha de 48 dp por ponto da rota; MOBILE-DESIGN.md 8.3 pedia agrupar por hora e recolher (antigo 024).
- **P-07** `ocorrencia/[id].tsx:103` travessão; `ajustes.tsx:175` `Alert.alert` de erro (antigos 025 e 026).
- **P-08** **Documentação desatualizada (DRIFT).** `MOBILE-DESIGN.md` ainda diz "PROPOSTA, aguardando aprovação", "Nenhum arquivo de código foi alterado", seção 13 com os 4 RISK "aguarda aprovação" e a seção 10 item 4 "não adotar nesta entrega" (expo-haptics, Reanimated e Gesture Handler já estão no `package.json` e no código). Atualizar status e registrar: RISK 1 a 4 aprovados, `titulo` 26/34, texto do alarme virou frase com ação, sem escuro.

---

## Narração de primeira impressão e Trunk Test (reconstruídos do código, NÃO são impressão de tela)

| Tela | Leitura do código | Trunk Test |
|---|---|---|
| Alarme (`alarme.tsx`) | De cima para baixo: "Ampara" e "Às 13:48", ícone de alerta 40, nome em 32/40, uma frase do que fazer, origem em linguagem de gente, botão areia de 64 dp de largura total ancorado na base. Tudo preto sobre vermelho, sem animação. Nada concorre com o nome; o botão não é mais secundário | Q1 PASS (marca no topo), Q2 PASS, Q4 PASS (voltar travado e dito na tela). **PASS**, pendente de print |
| Início (`index.tsx`) | Herói petróleo no topo (chaveiro, selo, frase, "Achar meu chaveiro" esmeralda), depois UMA superfície com Rota, Último alerta e convite, depois "Viu algo na rua?". Uma coisa pesa mais que as outras | Q1 PARTIAL (cabeçalho "Início", marca só no herói), Q2 e Q3 PASS. **PARTIAL**, só o print decide |
| Rota e BO | Ação principal em `BarraAcao`; cabeçalho nativo com seta | **PASS** pendente de print; rota longa continua com muros de linhas (P-06) |
| Onboarding | `TelaPasso`: "Passo X de 8" + barra, um título, ação ancorada, seta no cabeçalho | **PASS** pendente de print |
| Entrar | Ação principal; "Criar conta" em texto; bloco "Seu celular foi roubado?" | **PASS** pendente de print |

---

## O que só o print (ou o aparelho) confirma

Não houve APK novo, emulador ou captura nesta rodada. **Não verificado:**

1. Composição real do alarme (peso do nome, folga do botão, brilho do vermelho com texto preto) e dos estados enviando, erro, encerrado e confirmado.
2. Se o herói petróleo do Início realmente "puxa o olho" sem parecer uma faixa pesada em tela de 360 dp; contraste do selo "Conectado/Sem conexão" sobre petróleo (o selo usa `esmeraldaSuave`/`areia`, par testado, mas é a primeira vez em fundo escuro).
3. **D01**: botão ancorado com o teclado aberto (`entrar`, `conta`, `emergencia`, `chaveiro`).
4. Barra de gestos: `BarraAcao` soma `insets.bottom`, mas se o app roda em edge-to-edge só o print mostra sobreposição.
5. Fonte do sistema em 1,3x e 2x: rótulo da aba com teto de 1,3, barra de ação crescendo, `exibicao` com teto; `Campo` com "Mostrar" (`paddingRight: 104`) a 2x.
6. `boxShadow` da `BarraAcao` em Android de entrada.
7. Silhueta do botão `secundario` (`areiaFunda` sobre `areia`, 1 px petróleo) em tela suja; limite de 3:1 para forma.
8. Indicador da aba ativa (barra de 3 dp) legível à distância de braço.
9. Telas sem print nem antes (rota, BO, relato, ocorrência, histórico, aceitar) agora também sem print depois.
10. TalkBack real, desempenho de rolagem e do mapa, telas de 360x640.

## Baseline para a próxima rodada

Não gravei `design-baseline.json` (a tarefa limitou a escrita a este documento). Para a próxima rodada, salvar em `app/design-baseline.json`:

```json
{
  "tool": "mobile-design-review",
  "version": 1,
  "date": "2026-11-16",
  "mode": "static-only-after-redesign",
  "designScore": "A-",
  "slopScore": "A",
  "categories": {
    "navigation": "A-", "screenAnatomy": "A-", "typography": "A-", "colorTheming": "A",
    "surfaces": "A", "states": "A-", "interactionMotion": "A-", "forms": "A-",
    "performance": "A-", "copy": "A-"
  },
  "findings": [
    { "id": "FINDING-D01", "impact": "medium", "category": "forms", "summary": "BarraAcao compensa teclado com adjustResize: possivel dupla compensacao (suspeita)", "status": "open" },
    { "id": "FINDING-D02", "impact": "medium", "category": "states", "summary": "Carregamento em texto, sem pulso no esqueleto (tell 37)", "status": "open" },
    { "id": "FINDING-D03", "impact": "medium", "category": "interactionMotion", "summary": "Reanimated e Gesture Handler sem uso; movimento prometido ausente", "status": "open" },
    { "id": "FINDING-D04", "impact": "medium", "category": "performance", "summary": "Historico em ScrollView com map (tell 13)", "status": "open" },
    { "id": "FINDING-D05", "impact": "medium", "category": "copy", "summary": "deviceId cru, Link cru, 'o que e onde', glifo em aceitar (tells 1)", "status": "open" },
    { "id": "FINDING-D06", "impact": "medium", "category": "screenAnatomy", "summary": "aceitar.tsx sem BarraAcao nem area segura (tell 23)", "status": "open" }
  ],
  "resolvedSinceLast": ["FINDING-001", "FINDING-003", "FINDING-004", "FINDING-006", "FINDING-007", "FINDING-008", "FINDING-009", "FINDING-010", "FINDING-013", "FINDING-020", "FINDING-022"],
  "unverified": ["alarme em todos os estados", "heroi petroleo em 360 dp", "teclado com BarraAcao", "barra de gestos", "fonte 1,3x e 2x", "boxShadow em Android de entrada", "silhueta do botao secundario", "TalkBack", "telas sem print"]
}
```

## Ordem de correção recomendada (o que resta, com 3 dias)

1. **Gerar o APK e tirar os prints do alarme, do Início e do teclado aberto** (D01 decide se há um alto novo). Sem isso a nota é provisória.
2. D06 (`aceitar.tsx` na `BarraAcao`) e D05 (4 textos), baratos e visíveis no vídeo.
3. D04 (FlatList no histórico) e D02 (esqueleto no Histórico e na Ocorrência).
4. D03: decidir entre fade mínimo com `reduzir movimento` ou assumir "sem animação" em `MOBILE-DESIGN.md`; P-08 atualiza o documento de qualquer forma.
5. Polimento P-01 a P-07 só se sobrar tempo.

Depois, rodar de novo a crítica com prints e mostrar o antes/depois ao Pedro (`app/docs/design/antes/` contra os novos), como pede o `CLAUDE.md`.
