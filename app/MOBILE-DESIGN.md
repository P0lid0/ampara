# Ampara: sistema de design do app (MOBILE-DESIGN.md)

Status: **PROPOSTA, aguardando aprovação do Pedro.** Nenhum arquivo de código foi alterado (`tokens.ts`, `contraste.ts` e todo `.tsx` ficam como estão). O diff exato está na seção "Mudanças propostas em tokens.ts".
Data: 2026-11-16. Entrega: 19/11/2026 23h55.
Skills: `mobile-design-system` (proposta SAFE/RISK) com `expo-design-system` (convenções: um ponto de entrada de tema, componentes com variante/estado, extrair só com 2+ usos).
Base: `app/src/theme/tokens.ts`, `app/src/ui/*.tsx` e `app/docs/design/auditoria-app.md` (Design Score B, AI Slop Score A-, 17 achados de impacto alto ou médio).

## 1. Leitura do app

| Item | Decisão |
|---|---|
| Tipo de app | Segurança pessoal (roubo de celular). Dois papéis: a vítima e o guardião (parente) acionado por alarme. |
| Estado emocional | Pânico (vítima, guardião no alarme) e calma administrativa (BO, ajustes, onboarding). A mesma marca precisa servir às duas. |
| Público | Todas as idades. Fonte do sistema grande, mãos trêmulas, tela suja, pouca luz. |
| Plataforma | Android primeiro (emulador, `adb`, `android/` versionado); Expo SDK 58, React Native 0.88, expo-router. Estilo: `StyleSheet` com `tokens.ts`, sem NativeWind. |
| Tema | Só claro (`userInterfaceStyle: 'light'`). |
| Dials | Variação baixa-média (a marca é fixa, a composição varia), movimento mínimo e funcional, densidade baixa a média. Tom: calmo, direto, confiável. Não startup, não lúdico. |
| Estado atual | Disciplina de token exemplar (0 hexadecimais em tela), acessibilidade forte e protegida por teste. Falta: hierarquia, composição, área segura, escala de tipo, feedback de toque. |

**Alinhamento com o `DESIGN.md` da raiz (superfícies web).** Ele existe e usa a mesma marca, mas com tons derivados de valor diferente (areia-escura `#E4DDCF`, texto-apoio `#3D6563`, alarme-texto `#B3202A`, sobre-alarme `#111111`). Aqui os tons do app foram calculados contra o `contraste.ts` do app e a regra "preto sobre alarme" do app é `#000000` (há teste). Os nomes são parecidos de propósito; **os valores divergem** e devem ser unificados em uma rodada própria (sugestão: o app mantém os dele, a web ajusta ou prova os dela), não nesta.

O sistema abaixo é **aditivo**: nenhum nome de token existente muda (`cores.*`, `tamanhos.*`, `fontes.*`, `espacos.p/m/g`, `coresApoio`, `coresRisco`), como manda o protocolo de redesign.

## 2. Proposta SAFE / RISK

### SAFE (a linha de base que o público espera e que já existe)

- **A marca como está.** Petróleo `#0F4C4A`, esmeralda `#14B88A`, areia `#F4EFE6`, alarme `#E5484D` (sempre vermelho), tinta `#12201F`, preto sobre alarme. Uma cor de destaque (esmeralda para a ação principal), uma família de neutros quentes (areia).
- **Manrope** (400, 600, 700), a única família. Legível, humana, sem cara de produto de tecnologia.
- **Tema claro só.** O contraste está testado só para o claro; um tema escuro novo no meio de um prazo de três dias multiplica os pares a provar (ver seção 9).
- **Raio 12** (já usado em 19 lugares), selo em pílula.
- **Alvo de toque de 48 dp, fonte mínima de 16**, `allowFontScaling` sempre ligado.
- **Estado nunca só por cor**, rótulo sempre escrito.
- **Superfícies planas**, sem sombra, exceto uma barra de ação ancorada (seção 5).
- **Feedback de toque com recursos do React Native** (`android_ripple`, `Pressable`, `Vibration`), sem dependência nova.

Por que seguro é o certo aqui: quem usa o app está em pânico ou foi roubado. Inovação visual não ajuda; previsibilidade ajuda. O ganho de qualidade vem de hierarquia e composição, não de estilo novo.

### RISKS (4, cada um com ganho e custo)

```
RISK 1: Bloco herói em petróleo no Início (e no estado do chaveiro)
gain:   quebra a pilha de cinco caixas iguais (achado 010); o estado do chaveiro e "Achar meu chaveiro"
        passam a ser a coisa mais pesada da tela
cost:   uma superfície escura num app claro. Texto sobre ela só em areia (8,5:1); esmeralda sobre petróleo
        dá 3,8:1, vale para ícone e forma, NUNCA para texto
```

```
RISK 2: Fim do contorno petróleo de 2 px em tudo; hierarquia por preenchimento
gain:   botão secundário deixa de pesar como cartão (achado 020); o contorno de 2 px passa a significar
        "campo de digitar", e o de 3 px, "erro ou foco"
cost:   o limite do botão secundário (areiaFunda sobre areia, 1,14:1) deixa de ser legível só pela forma;
        mitigado por contorno de 1 px petróleo e pelo rótulo (7,5:1). Exige olhar real em tela suja
```

```
RISK 3: Ícones vetoriais (react-native-svg, já instalado) no lugar de glifos Unicode, e indicador não-cor na aba ativa
gain:   acaba com o ⚠ que vira emoji colorido em alguns aparelhos e com as bolinhas fora da Manrope
        (achado 011); a aba ativa passa a se distinguir sem depender de tom (achado 003)
cost:   um componente novo (Icone, 6 a 8 ícones desenhados à mão) e retrabalho em EstadoBadge, Campo e BO.
        Ícone NO MEIO da barra de abas fica fora desta proposta: está na lista "nunca mudar em silêncio"
```

```
RISK 4: Ação principal ancorada na base (barra de ação) em toda tela de fluxo
gain:   o botão que fecha o fluxo fica sob o polegar e não some com a rolagem (alarme, rota, BO, onboarding)
cost:   conteúdo rola por baixo da barra: exige espaço inferior = barra + área segura, e a barra precisa subir
        com o teclado. Com fonte em 2x o rótulo quebra em duas linhas e a barra cresce; testar no aparelho
```

### Validação de coerência (conflitos sinalizados, não corrigidos em silêncio)

1. **Esmeralda sobre petróleo (RISK 1) × regra "esmeralda nunca texto"**: 3,83:1 reprova para texto. Resolução: no herói, texto em areia; esmeralda só no botão primário (o rótulo do botão é tinta, 6,6:1) e em formas.
2. **"Alarme sempre vermelho" × texto de erro legível**: alarme `#E5484D` sobre areia dá 3,42:1 e reprova. Resolução já prevista no próprio `tokens.ts` (escurecer o TEXTO): token `alarmeTexto` `#A3262B` (6,4:1 sobre areia) só para texto e rótulo destrutivo em fundo claro. Nunca como fundo. O fundo de alarme continua `#E5484D`.
3. **Tinta sobre alarme reprova (4,29:1)**: o texto sobre o fundo de alarme é sempre `sobreAlarme` (preto, 5,37:1), nunca tinta, nunca branco (3,91:1) e **nunca com opacidade reduzida** (reduz o contraste abaixo de 4,5:1).
4. **Fonte mínima de 16 × `fontSize: 10` e `40` soltos no código**: o `Texto` já faz `Math.max(…, 16)`, então o 10 vira 16 em silêncio e pode quebrar layout. Resolução: toda tela passa a usar variante da escala; zero `fontSize` solto.
5. **Manrope só tem 400, 600 e 700 carregados**: a escala usa só esses pesos. Peso 500 ou 800 seria sintetizado pelo sistema.
6. **Alvo de 48 dp × ação ancorada (RISK 4)**: a ação principal sobe para 56 dp e a do alarme para 64 dp; os demais ficam em 48.
7. **Estado só por cor × ícones novos (RISK 3)**: o ícone acompanha o texto, nunca o substitui.

## 3. Tokens semânticos (tema claro)

Cada valor da tabela é um token em `tokens.ts` (existente ou proposto). O papel semântico é o nome que a tela deve pensar; o token é o nome no código.

| Papel | Token | Valor | Uso | Contraste testado |
|---|---|---|---|---|
| fundo de tela | `cores.areia` | `#F4EFE6` | `sceneStyle` de toda tela | base |
| superfície elevada | `cores.branco` | `#FFFFFF` | cartão, campo, barra de abas | base |
| superfície tonal | `cores.areiaFunda` (novo) | `#E8E1D2` | botão secundário, esqueleto, linha pressionada | petróleo 7,5:1, tinta 12,9:1, textoSuave 5,5:1 |
| superfície de destaque | `cores.petroleo` | `#0F4C4A` | bloco herói, cabeçalho | areia 8,5:1 |
| texto principal | `cores.tinta` | `#12201F` | corpo e títulos | areia 14,6:1, branco 16,8:1 |
| texto de apoio | `cores.textoSuave` (novo) | `#4A5B59` | legenda secundária, rótulo de aba inativa | areia 6,3:1, branco 7,2:1 |
| texto de marca | `cores.petroleo` | `#0F4C4A` | link, rótulo do botão secundário | areia 8,5:1, branco 9,8:1 |
| ação principal | `cores.esmeralda` | `#14B88A` | fundo do botão primário (rótulo `tinta`, 6,6:1) | tinta 6,6:1 |
| fundo de sucesso | `cores.esmeraldaSuave` (novo) | `#DDF3EA` | selo "Feito" e "Conectado" | tinta 14,4:1, petróleo 8,4:1 |
| alarme (fundo) | `cores.alarme` | `#E5484D` | tela de alarme, selo "Aberta", botão de perigo | preto 5,4:1 |
| texto sobre alarme | `cores.sobreAlarme` | `#000000` | todo texto sobre `alarme` | 5,4:1 |
| texto de erro | `cores.alarmeTexto` (novo) | `#A3262B` | erro de campo, "Apagar conta", aviso | areia 6,4:1, branco 7,3:1, alarmeSuave 6,0:1 |
| fundo de erro | `cores.alarmeSuave` (novo) | `#FBE3E4` | aviso de erro em tela clara | tinta 13,7:1 |
| borda de campo | `cores.petroleo` | `#0F4C4A` | contorno de campo (limite de controle) | 9,8:1 sobre branco |
| divisor e cartão | `cores.bordaSuave` (novo) | `#CFC8B8` | 1 px decorativo; **nunca** limite de controle | decorativo |
| interruptor desligado | `coresApoio.cinzaChave` | `#767676` | trilho off (Ajustes e mapa) | 4,0:1 areia, 4,5:1 branco (precisa 3:1) |

Regras de cor que valem para todas as telas:

1. Hexadecimal só em `tokens.ts` (já vale e é testado em `acessibilidade.test.tsx`).
2. Texto sobre `alarme`: só `sobreAlarme`, opacidade 1.
3. Esmeralda nunca é cor de texto (2,2:1 sobre areia, 2,5:1 sobre branco).
4. `alarmeTexto` só como texto sobre areia, branco, `areiaFunda` (5,6:1) ou `alarmeSuave`; nunca como fundo.
5. Cor nunca é a única pista de estado: rótulo escrito, mais ícone ou forma.
6. Limites de controle (contorno de campo, trilho de interruptor, silhueta de botão sobre fundo) precisam de 3:1 (WCAG 1.4.11). O botão primário esmeralda sobre areia dá 2,2:1, mas o rótulo (6,6:1) o identifica; sobre petróleo dá 3,8:1.

## 4. Escala de tipo e limites da fonte do sistema

Família única Manrope. Os pesos são `fontFamily` (regular, semibold, bold), nunca `fontWeight`. Todas as variantes têm piso de 16 e `allowFontScaling` ligado. `teto` é o `maxFontSizeMultiplier`; `sem teto` significa que o texto de leitura nunca é travado.

| Variante | Tamanho / linha | Peso | Teto de escala | Onde |
|---|---|---|---|---|
| `exibicao` (nova) | 32 / 40 | bold | 1,3 | nome na tela de alarme; mais nada |
| `titulo` | 26 / 34 (hoje 24 / 32) | bold | 1,6 | título de tela, UM por tela |
| `secao` (nova) | 20 / 28 | bold | 1,6 | título de seção e de cartão |
| `corpo` | 18 / 26 | regular | sem teto | texto corrido |
| `corpoForte` (nova) | 18 / 26 | semibold | sem teto | promessa em destaque, valor |
| `rotulo` (nova) | 16 / 22 | semibold | 1,6 | rótulo de campo, de botão, de aba, de selo |
| `legenda` | 16 / 22 | regular | sem teto | apoio, ajuda, erro |

Notas:

- A razão entre `titulo` (26) e `secao` (20) é 1,3, o suficiente para hierarquia sem chamar atenção. Hoje `titulo` 24 e os 20 soltos têm razão 1,2 e o H1 "Mapa" pesa igual a "Legenda" (print 16).
- `exibicao` tem teto de 1,3 porque o nome comprido ("Ana Sintetico precisa de ajuda") a 2x quebra em muitas linhas e empurra a ação para fora da tela; com o teto, o corpo da tela continua escalando livremente.
- Linha de 1,3 a 1,45 do corpo, texto corrido com no máximo 3 linhas nas telas de decisão.
- **Regras de layout para fonte grande** (Android permite até 2x): nunca `height` fixa em texto, só `minHeight`; botão quebra o rótulo em linhas e cresce; linhas de lista crescem; barra de ação ancorada cresce até um terço da tela e depois rola junto. Rótulo de aba: hoje "Histórico" a 2x não cabe em um quarto de 360 dp; a aba passa a usar `tabBarLabel` customizado com `Texto` e teto de 1,3 (o `tabBarAllowFontScaling` só liga e desliga, não limita).
- Testar sempre em 1,0x, 1,3x e 2,0x. O relatório de auditoria lista isso como não verificado.

## 5. Espaçamento, raio, borda, elevação

| Escala | Valores | Observações |
|---|---|---|
| `espacos` | xs 4, **p 8**, pm 12, **m 16**, **g 24**, gg 32, xg 48 | `p`, `m`, `g` não mudam. Margem lateral da tela: `m` (16). Entre seções: `g` (24). Dentro de um grupo: `p` (8). Os 2, 4, 6 e 12 soltos viram `xs` e `pm`; o 2 e o 6 viram 4 ou 8. |
| `raios` | p 8, **m 12**, g 16, pilula 999 | `m` é o padrão atual. `g` só no herói e na folha. Selo e chip em pílula. |
| `bordas` | fina 1, padrao 2, foco 3 | 1: divisor, cartão, selo, botão secundário. 2: campo. 3: erro e foco. |
| `elevacao` | nenhuma, barra | O app é plano. A única sombra é a barra de ação ancorada: `0 -2px 8px rgba(18, 32, 31, 0.10)`. |
| `tamanhos` | alvoMin 48, fonteMin 16, alvoAcao 56, alvoAlarme 64 | os dois primeiros não mudam (há teste). |

Elevação: o `expo-design-system` pede um par iOS/Android; como a RN 0.88 aceita `boxShadow` nas duas plataformas, o token é uma string só (sem `shadowColor` solto, tell 5 da auditoria). Confirmar o desenho em aparelho Android de entrada.

Área segura: toda tela com rolagem ou barra ancorada soma `useSafeAreaInsets().bottom` ao espaço inferior (achado 002). Proposta de componente `Tela` em `ui/` (envolve `ScrollView`, aplica margem, insets e o espaço da barra de ação); extrair só porque 15 telas repetem o mesmo estilo, regra de extração do `expo-design-system`.

## 6. Movimento e háptica

Postura: **funcional, curta e sem enfeite.** Nenhum movimento que ameace a leitura em tela de pânico.

| Momento | Movimento | Háptica |
|---|---|---|
| Toque em botão ou linha | `android_ripple` (`areiaFunda` sobre fundo claro; esmeralda a 25 % sobre o herói petróleo) e escala 0,98 enquanto pressionado (instantâneo, pelo estilo de `Pressable`, sem biblioteca) | nenhuma |
| "Estou ciente" (alarme) | nenhum; a sirene para (`Vibration.cancel()`), a tela muda de fase | `Vibration.vibrate(15)` depois do cancelamento, uma vez |
| "Achar meu chaveiro", "Foi aqui que me roubaram" | feedback de toque + estado "carregando" no botão | uma batida de 15 ms ao iniciar |
| Aparecer conteúdo (lista, aviso) | fade de 200 ms com `Animated` do próprio RN (`useNativeDriver: true`) | nenhuma |
| Esqueleto de carregamento | blocos `areiaFunda` com pulso de opacidade 0,6 a 1 em 1,2 s (parado se "reduzir movimento") | nenhuma |
| Erro | nenhum movimento; aviso `alarmeSuave` com texto e ícone, região viva `assertive` | nenhuma |
| Troca de aba e de passo | a transição padrão do expo-router; nada customizado | nenhuma |

Regras:

- Respeitar `AccessibilityInfo.isReduceMotionEnabled()`: com ele ligado, `movimento.*` vira 0 e o pulso do esqueleto fica estático.
- Tela de alarme: **zero animação**. O vermelho cheio, a sirene e a vibração já são a urgência; movimento extra atrapalha ler o nome.
- Háptica só confirma uma ação que mudou estado. Nunca em navegação, nunca em erro, nunca repetida.
- **Dependências**: `react-native-reanimated`, `react-native-gesture-handler` e `expo-haptics` **não estão** no `package.json`. A proposta funciona sem elas (RN core). Adicioná-las exige novo build nativo (`android/` é versionado, `expo run:android`) e foi deixado como decisão do Pedro (seção 10). Se um dia entrarem, a skill `expo-animation` governa o uso.

## 7. Componentes: contrato por variante e estado

Seguem o contrato do `expo-design-system` (variante, estado, `style` por último). Só o que já existe em `app/src/ui/` é tocado, mais dois componentes novos que se justificam por uso em 2+ telas.

| Componente | Mudança proposta (para a fase de redesenho, não agora) |
|---|---|
| `Texto` | Variantes novas `exibicao`, `secao`, `corpoForte`, `rotulo` lidas de `tipo`; `maxFontSizeMultiplier={tipo[v].teto ?? undefined}`; `titulo` passa a 26/34. Piso de 16 e `allowFontScaling` ficam (há teste). |
| `Botao` | `primario` (esmeralda, rótulo tinta), `secundario` (fundo `areiaFunda`, rótulo petróleo, borda `fina` petróleo), `perigo` (alarme, preto), **novas**: `sobreAlarme` (fundo areia, rótulo tinta, sem borda; silhueta areia sobre alarme 3,4:1; `minHeight` 64) e `texto` (link petróleo sublinhado, 48 dp, para "Criar conta"). Pressionado: ripple + escala 0,98, não só `opacity`. Desabilitado: sem `opacity` no rótulo; fundo `areiaFunda` e rótulo `textoSuave`, com o motivo escrito ao lado. |
| `Campo` | Contorno `bordas.padrao` petróleo, erro `bordas.foco` `alarme` + aviso em `alarmeTexto` sobre `alarmeSuave`, ícone vetorial no lugar do `⚠`. Botão "Mostrar" na senha (48 dp), `returnKeyType` encadeado. |
| `EstadoBadge` | Pílula, `bordas.fina`, ícone vetorial + texto. `online` e `feito` em `esmeraldaSuave` com texto tinta; `aberta` segue alarme com preto. Pares todos em `paresDeTexto`. |
| `ProgressoPassos` | Sem mudança de lógica; trilho `areiaFunda`, preenchimento petróleo, texto "Passo X de 8" mantido. Um contador só (o IMEI usa sub-passos como legenda, não "Passo 3 de 4"). |
| `CartaoChaveiro` | Vira o miolo do bloco herói do Início; mostra apelido, não o `deviceId` cru. |
| `Tela` (novo) | Margem lateral `m`, `insets.bottom`, espaço da barra de ação, `KeyboardAvoidingView`. |
| `BarraAcao` (novo) | Fundo branco, `elevacao.barra`, `Botao` principal de `alvoAcao` (56), `insets.bottom + m`. No alarme: sem sombra e sem fundo próprio. |
| `Icone` (novo) | Svg: aviso, ok, offline, selo, relógio, voltar; traço 2, `cor` por prop; sempre ao lado de texto. |
| `Interruptor` (uso, não componente novo) | `trackColor { false: cinzaChave, true: petroleo }`, `thumbColor` branco, texto "Ligado" ou "Desligado" ao lado. |

Não envolver o `Switch` nativo nem os cabeçalhos do expo-router em wrapper só para passar pelo sistema: o nativo já carrega o desenho (regra do `expo-design-system`).

## 8. Regras por arquétipo de tela

Ordem de execução (CLAUDE.md do projeto): alarme do guardião, início da vítima, rota e BO, onboarding. Em todas: rotas, nomes de campo e contratos intocados; fundo `areia` exceto onde indicado; margem `m`; texto na escala da seção 4.

### 8.1 Alarme do guardião (`guardiao/alarme.tsx`): urgência e orientação

Fundo `alarme` de borda a borda (incluindo a área da barra de status, `StatusBar` com ícones escuros). Texto SÓ `sobreAlarme`, opacidade 1. Três faixas verticais (corrige achado 001):

| Faixa | Conteúdo | Tipo |
|---|---|---|
| Topo | "Ampara" à esquerda, hora ("agora, 13:48") à direita, rótulo de origem em linguagem de gente | `rotulo` |
| Meio (ocupa o espaço livre, alinhado ao topo do meio, não ao centro) | Nome da pessoa e "precisa de ajuda" | `exibicao` (32/40, teto 1,3) |
|  | Uma frase do que fazer: "Toque em Estou ciente para avisar que você vai ajudar." | `corpoForte` |
|  | O que já se sabe (de onde veio o aviso) | `corpo` |
| Base | `BarraAcao` sem sombra: `Botao` variante `sobreAlarme`, largura total, 64 dp, `insets.bottom + 16` | `rotulo` a 20 pt (variante de botão do alarme) |

Regras:

- Uma ação principal por fase; os estados `enviando`, `erro`, `encerrado`, `confirmado` e `ausente` ocupam a **mesma** faixa da base e o mesmo botão `sobreAlarme`. Erro: texto em `sobreAlarme` com ícone de aviso e região viva `assertive`; nunca `alarmeTexto` sobre alarme.
- Sem movimento, sem gradiente, sem sombra, sem cartão. Voltar travado (como hoje) e dito na tela.
- Háptica: uma de 15 ms ao confirmar, depois de cancelar a sirene. O padrão da sirene não muda.
- Anúncio de leitor de tela a cada 10 s e rótulos como hoje.
- Contraste: preto sobre alarme 5,37:1; silhueta do botão areia sobre alarme 3,42:1.
- **Atenção a teste**: o título hoje é "Alerta: {nome} precisa de ajuda"; mudar o texto exige conferir `guardiao/__tests__` e `textos-proibidos.test.ts` antes.

### 8.2 Início da vítima (`(tabs)/index.tsx`): calma, e o essencial primeiro

| Zona | Conteúdo |
|---|---|
| Cabeçalho | Nome "Ampara" discreto (marca), fundo petróleo, texto areia (achado 005). |
| Bloco herói (RISK 1) | Superfície `petroleo`, raio `g`, padding `g`. Apelido do chaveiro (`secao`, areia), UM selo de estado (`EstadoBadge`), UMA frase de estado, botão primário esmeralda "Achar meu chaveiro" (56 dp). Estado "sem conexão" aparece uma vez só. |
| Lista agrupada | UMA superfície branca, raio `m`, divisores `bordaSuave` de 1 px (nada de caixas soltas): Rota, Último alerta, Tenho um código de convite. Linhas de 48 dp com `Icone` + texto + seta só se navega. |
| "Viu algo na rua?" | Bloco com `secao` e botão `secundario`. Texto corrigido ("o que é e onde" sem erro). |
| Carregando | Esqueleto de `areiaFunda`, não "Carregando…". Erro com "Tentar de novo". |

Barra de abas: fundo branco; aba ativa com barra superior de 3 dp petróleo, rótulo `rotulo` bold e cor petróleo; inativa em `textoSuave` (7,2:1). Pista de seleção NÃO é só cor (a barra e o peso carregam). Sem ícones até o Pedro aprovar. Rótulo com teto 1,3.

### 8.3 Rota e BO (`rota.tsx`, `bo.tsx`): tarefa longa, decisão calma

| Tela | Regras |
|---|---|
| Rota | Mapa no topo; controle de tempo logo abaixo; **ação principal ancorada** (`BarraAcao`): "Foi aqui que me roubaram". Lista de horários em `FlatList` agrupada por hora, recolhida por padrão (não uma linha de 48 dp com contorno por ponto). |
| BO | Título de tela (`titulo`) e seções com `secao`; cada seção numa superfície branca com `bordas.fina` `bordaSuave`. Caixas de seleção e botões de opção desenhados com `Icone` (não `◉ ○ ☑ ☐`), linha inteira tocável de 48 dp. Ação "Enviar à polícia" ancorada, com o motivo escrito quando desabilitada. Mensagem de erro em `alarmeSuave`/`alarmeTexto`. |
| Ambas | Sem repetir o título do cabeçalho no corpo. Seta de voltar do cabeçalho mantida. Estado vazio, carregando e erro com ação. Nada de `Alert.alert` para erro. |

### 8.4 Onboarding (`onboarding/*`): um passo por vez, sem pressa

- **Um nível de título só** (`titulo`); o cabeçalho nativo mostra só o nome do app ou "Passo X de 8", não repete o assunto.
- Parágrafo de 2 a 3 linhas em `corpo`; a promessa principal ("Só você vê") em `corpoForte` logo no começo.
- `ProgressoPassos` no topo (texto "Passo X de 8" mais barra). Um contador só.
- **Ação principal ancorada** (`BarraAcao`, 56 dp) e "Voltar" como seta do cabeçalho em todos os passos (achado 004); onde voltar é proibido de propósito, dizer na tela.
- Campos: `Campo` com contorno 2 px; teclado encadeado; senha com "Mostrar"; formulário longo (emergência) dentro de `Tela` com `KeyboardAvoidingView`.
- Tom: frases curtas, voz ativa, sem jargão ("chaveiro" explicado na primeira vez; sem `chaveiro-ampara-xxxxxx` na tela).
- Sem movimento além da transição padrão.

### 8.5 Fora da lista de prioridade (só direção)

- **Entrar**: "Entrar" como ação principal; "Criar conta" como `texto`; "Estou no aparelho de outra pessoa" em bloco próprio, na base, com a frase "Seu celular foi roubado?".
- **Ajustes**: seções com título pequeno, linhas dentro de UMA superfície, interruptor com texto "Ligado/Desligado", "Modo demonstração" no fim em "Avançado", ação destrutiva por último em `alarmeTexto`.
- **Mapa**: células de risco como hoje (`coresRisco`, nível escrito, padrão na borda); botão "Tentar de novo" ao lado do aviso.

## 9. Tema escuro: não adotado agora

Veredito: **não cabe sem risco antes de 19/11.** Motivos: (1) o contraste só está provado para o claro, e o escuro dobra os pares a provar; (2) `userInterfaceStyle: 'light'` e a marca é a areia; (3) o alarme é vermelho cheio nos dois temas, então o escuro não resolve o incômodo à noite (achado 021); (4) a regra "alarme sempre vermelho" proíbe escurecer o fundo.

Se um dia entrar: pares claro/escuro por papel semântico na seção 3, `useTema()` com `useColorScheme`, os mesmos testes de contraste rodando nos dois conjuntos, e o alarme **continua `#E5484D`** com preto. Pergunta aberta para o Pedro, sem pendência de marca: aceitar o alarme igual de noite (o app é para emergência) ou estudar um modo "noite" só de brilho de tela.

## 10. Decisões para o Pedro aprovar

1. **RISK 1 a 4** (herói petróleo, tonal em vez de contorno, ícones vetoriais com indicador de aba, ação ancorada): aprovar, ou trocar pela versão SAFE (herói claro com contorno atual; contorno 2 px mantido; glifos mantidos; botão no fim do conteúdo). A troca fica registrada aqui.
2. **`titulo` 24/32 vira 26/34**: muda todas as telas que usam a variante. Alternativa SAFE: manter 24/32 e usar só `secao` (20) para a hierarquia.
3. **Ícones na barra de abas**: não propostos (lista "nunca mudar em silêncio"). Só o indicador não-cor.
4. **Dependência nativa** (`expo-haptics`, `react-native-reanimated`, `react-native-gesture-handler`): não adotar nesta entrega; a proposta usa RN core. Se aprovar, exige novo build do Android.
5. **Texto do alarme** ("Alerta: X precisa de ajuda" para uma frase com ação): exige ajustar testes.
6. **Escuro** (seção 9): confirmar a não adoção.

## 11. Mudanças propostas em tokens.ts

Só **adições**; nenhum nome existente muda e nenhuma cor da marca muda. Os 8 testes de `contraste.test.ts` e o de hexadecimal fora de `tokens.ts` (`acessibilidade.test.tsx`) continuam válidos. `NomeCor = keyof typeof cores` passa a incluir os seis tons novos (os tipos de `paresDeTexto` aceitam). **Não aplicado**; o diff abaixo foi gerado contra o arquivo atual e está salvo em `app/docs/design/tokens.proposta.diff` (aplicar da raiz do repositório com `git apply app/docs/design/tokens.proposta.diff` depois da aprovação).

Resumo do que entra:

| Grupo | Tokens |
|---|---|
| `cores` | `areiaFunda`, `esmeraldaSuave`, `alarmeSuave`, `alarmeTexto`, `textoSuave`, `bordaSuave` |
| `tamanhos` | `alvoAcao` 56, `alvoAlarme` 64 |
| `espacos` | `xs` 4, `pm` 12, `gg` 32, `xg` 48 (junto aos `p`, `m`, `g`) |
| novos grupos | `tipo`, `raios`, `bordas`, `elevacao`, `movimento`, `haptica` |
| `coresApoio` | só um comentário em `cinzaChave` |

```diff
--- a/app/src/theme/tokens.ts
+++ b/app/src/theme/tokens.ts
@@ -9,6 +9,13 @@
   tinta: '#12201F',
   sobreAlarme: '#000000',
   branco: '#FFFFFF',
+  // Tons derivados da marca (MOBILE-DESIGN.md). As quatro cores da marca não mudam.
+  areiaFunda: '#E8E1D2', // superfície tonal: botão secundário, esqueleto, linha pressionada
+  esmeraldaSuave: '#DDF3EA', // fundo de "feito" e "conectado"
+  alarmeSuave: '#FBE3E4', // fundo de aviso de erro em tela clara
+  alarmeTexto: '#A3262B', // texto de erro e de ação destrutiva sobre areia ou branco (alarme puro dá 3,4:1)
+  textoSuave: '#4A5B59', // texto de apoio (legenda secundária)
+  bordaSuave: '#CFC8B8', // divisor e contorno decorativo de 1 px; nunca limite de controle
 } as const;
 
 export type NomeCor = keyof typeof cores;
@@ -17,6 +24,8 @@
 export const tamanhos = {
   alvoMin: 48,
   fonteMin: 16,
+  alvoAcao: 56, // ação principal ancorada na base
+  alvoAlarme: 64, // "Estou ciente" e ações da tela de alarme
 } as const;
 
 // Famílias carregadas por @expo-google-fonts/manrope no _layout.
@@ -27,16 +36,63 @@
 } as const;
 
 export const espacos = {
+  xs: 4,
   p: 8,
+  pm: 12,
   m: 16,
   g: 24,
+  gg: 32,
+  xg: 48,
+} as const;
+
+// Escala de tipo. `teto` é o maxFontSizeMultiplier: null = sem teto (texto de leitura nunca é travado).
+// O piso de 16 vale para todas as variantes (o componente Texto já garante).
+export const tipo = {
+  exibicao: { fontSize: 32, lineHeight: 40, fontFamily: fontes.bold, teto: 1.3 },
+  titulo: { fontSize: 26, lineHeight: 34, fontFamily: fontes.bold, teto: 1.6 },
+  secao: { fontSize: 20, lineHeight: 28, fontFamily: fontes.bold, teto: 1.6 },
+  corpo: { fontSize: 18, lineHeight: 26, fontFamily: fontes.regular, teto: null },
+  corpoForte: { fontSize: 18, lineHeight: 26, fontFamily: fontes.semibold, teto: null },
+  rotulo: { fontSize: 16, lineHeight: 22, fontFamily: fontes.semibold, teto: 1.6 },
+  legenda: { fontSize: 16, lineHeight: 22, fontFamily: fontes.regular, teto: null },
+} as const;
+
+export const raios = {
+  p: 8,
+  m: 12, // padrão atual (19 usos)
+  g: 16, // bloco herói e folha
+  pilula: 999, // selo e chip
+} as const;
+
+export const bordas = {
+  fina: 1, // divisor, cartão, selo
+  padrao: 2, // campo e botão secundário
+  foco: 3, // erro e foco
+} as const;
+
+// Superfícies planas; só a barra de ação ancorada ganha sombra (boxShadow vale nas duas plataformas).
+export const elevacao = {
+  nenhuma: 'none',
+  barra: '0 -2px 8px rgba(18, 32, 31, 0.10)',
+} as const;
+
+// Movimento funcional e curto (ms). Com "reduzir movimento" ligado, as durações viram 0.
+export const movimento = {
+  toque: 100,
+  entrada: 200,
+  saida: 150,
+} as const;
+
+// Háptica com o Vibration do React Native (ms), sem dependência nova. O padrão da sirene continua no alarme.
+export const haptica = {
+  confirmar: 15,
 } as const;
 
 // Cores de apoio fora da marca (mapa e interruptor). Hexadecimal só vive neste arquivo.
 export const coresApoio = {
   ambar: '#F2B84B',
   cinzaSemDado: '#9AA3A2',
-  cinzaChave: '#767676',
+  cinzaChave: '#767676', // trilho do interruptor desligado (mapa e Ajustes): 4,0:1 sobre areia
 } as const;
 
 // Preenchimento das células de risco: a cor só reforça, o nível sempre vem escrito e no padrão da borda.
```

### Mudança acompanhante em `contraste.ts` (para o teste cobrir os pares novos)

`paresDeTexto` hoje cobre cinco pares e deixa de fora `tinta` sobre `branco` e `petróleo` sobre `branco`, que o app já usa em campos e cartões. Pares a acrescentar (os números são razões WCAG calculadas com a mesma fórmula do `contraste.ts`):

```ts
// texto sobre fundo (>= 4.5)
{ nome: 'tinta sobre branco', texto: 'tinta', fundo: 'branco' },                      // 16,8
{ nome: 'petróleo sobre branco', texto: 'petroleo', fundo: 'branco' },                // 9,8
{ nome: 'textoSuave sobre areia', texto: 'textoSuave', fundo: 'areia' },              // 6,3
{ nome: 'textoSuave sobre branco', texto: 'textoSuave', fundo: 'branco' },            // 7,2
{ nome: 'textoSuave sobre areiaFunda', texto: 'textoSuave', fundo: 'areiaFunda' },    // 5,5
{ nome: 'tinta sobre areiaFunda', texto: 'tinta', fundo: 'areiaFunda' },              // 12,9
{ nome: 'petróleo sobre areiaFunda', texto: 'petroleo', fundo: 'areiaFunda' },        // 7,5
{ nome: 'tinta sobre esmeraldaSuave', texto: 'tinta', fundo: 'esmeraldaSuave' },      // 14,4
{ nome: 'petróleo sobre esmeraldaSuave', texto: 'petroleo', fundo: 'esmeraldaSuave' },// 8,4
{ nome: 'alarmeTexto sobre areia', texto: 'alarmeTexto', fundo: 'areia' },            // 6,4
{ nome: 'alarmeTexto sobre branco', texto: 'alarmeTexto', fundo: 'branco' },          // 7,3
{ nome: 'alarmeTexto sobre areiaFunda', texto: 'alarmeTexto', fundo: 'areiaFunda' },  // 5,6
{ nome: 'alarmeTexto sobre alarmeSuave', texto: 'alarmeTexto', fundo: 'alarmeSuave' },// 6,0
{ nome: 'tinta sobre alarmeSuave', texto: 'tinta', fundo: 'alarmeSuave' },            // 13,7
```

Mais uma lista `paresNaoTexto` (>= 3:1, WCAG 1.4.11) com teste próprio: areia sobre alarme (3,42, silhueta do botão do alarme), esmeralda sobre petróleo (3,83, botão no herói), `cinzaChave` sobre areia (3,97, trilho do interruptor), petróleo sobre branco (9,75, contorno de campo). Reprovam de propósito e devem ficar fora de qualquer lista de aprovação: tinta sobre alarme (4,29), branco sobre alarme (3,91), esmeralda sobre areia ou branco (2,2 e 2,5), petróleo sobre alarme (2,49), alarme sobre areia como texto (3,42).

### Mudança acompanhante em `Texto.tsx` (descrição)

```ts
// variantes lidas de tipo; teto null vira undefined
const { teto, ...estilo } = tipo[variante];
<Text allowFontScaling maxFontSizeMultiplier={teto ?? undefined} style={[base, estilo, externo, { fontSize: tamanho }]} />
```

O piso de 16 (`Math.max`) e `allowFontScaling` ficam; o teste `Texto.test.tsx` segue válido porque `maxFontSizeMultiplier` não desliga a escala. `accessibilityRole="header"` vale para `exibicao`, `titulo` e `secao`.

## 12. Como provar que o sistema funcionou (depois de aprovado)

1. `npm test` e `npm run typecheck` em `app/` verdes; `contraste.test.ts` com os pares novos.
2. Grep: zero hexadecimal e zero `fontSize`/`borderRadius`/`borderWidth` literal em `src/app` e `src/ui` (exceto comentário justificado).
3. Print antes e depois de cada tela (`adb exec-out screencap -p` ou `app/scripts/prints.sh`) em 1,0x, 1,3x e 2,0x de fonte, com barra de gestos visível: o botão final não pode ficar sob ela.
4. Rodar de novo `mobile-design-review` e comparar com o baseline da auditoria (Design Score B, AI Slop A-): meta B+ ou A- com os 3 achados altos (001, 002, 003) fechados.
5. Mostrar o antes/depois ao Pedro antes dos prints finais de `app/docs/prints`.

## 13. Registro de RISK (para as próximas sessões)

| # | Risco | Status |
|---|---|---|
| 1 | Bloco herói petróleo no Início | proposto, aguarda aprovação |
| 2 | Hierarquia por preenchimento, contorno de 2 px só em campo | proposto, aguarda aprovação |
| 3 | Ícones vetoriais e indicador de aba (sem ícone na aba) | proposto, aguarda aprovação |
| 4 | Ação principal ancorada na base | proposto, aguarda aprovação |

Se algum for recusado, trocar pela versão SAFE da seção 10 e anotar a troca nesta tabela; não manter em silêncio.

Onde ficam os arquivos de tema: `app/src/theme/tokens.ts` (único ponto de entrada de tokens), `app/src/theme/contraste.ts` (razão e pares testados). Componentes em `app/src/ui/`. Auditoria de origem: `app/docs/design/auditoria-app.md`.
