# Crítica de design: web-emergencia

Data: 16/11/2026. Skill: `impeccable`, modo critique (só leitura, nada foi editado). Superfície em modo Operate: uma tarefa urgente, em tela de celular emprestado.

## Como foi feita

- Tela de entrada vista no navegador em 390 px e 1280 px (prints em `entrada-390.png` e `entrada-1280.png`, nesta pasta). Não houve login nem envio de formulário.
- Painel, rota/mapa e BO criticados pelo código (`src/telas`, `src/componentes/Mapa.tsx`, `src/estilos.css`), porque exigem sessão.
- Detector mecânico `impeccable detect` rodado uma vez: 1 achado (borda lateral grossa, item 9).
- Degradação declarada: Assessment A e B rodaram no mesmo contexto, sem subagentes isolados, e a sobreposição do detector no navegador não foi injetada. Os achados de tela abaixo vêm do código; só a entrada foi confirmada visualmente.
- Não há `PRODUCT.md` nem `DESIGN.md` no projeto. Recomendo `/impeccable init` e `document` na etapa de correção.

## Nota

| Heurística (0 a 4) | Nota | Por quê |
|---|---|---|
| Visibilidade do estado | 2 | Sem progresso (1 avisar, 2 marcar, 3 BO), sem tempo restante da sessão, "Carregando…" cru |
| Linguagem do usuário | 3 | Textos claros; vazam "estado" cru e "aba" |
| Controle e liberdade | 2 | Beco sem saída nos avisos; confirmação extra no alarme |
| Consistência | 3 | Tokens coerentes; largura e uso do vermelho inconsistentes |
| Prevenção de erro | 2 | Botão desabilitado sem explicação; botão de alvo grande ao lado de "Não" |
| Reconhecimento | 3 | Fluxo curto e legível |
| Flexibilidade | 2 | Muitos toques até o BO; sem atalho |
| Estética e minimalismo | 1 | Correto e vazio: sem marca, sem hierarquia, sem identidade |
| Recuperação de erro | 3 | Mensagens boas e "Tentar de novo" |
| Ajuda | 1 | Nenhum caminho para quem esqueceu código ou palavra secreta |

Total: 22/40. Especificidade de design: baixa. Qualquer app de formulário usaria esta página sem mudar nada. AI Slop Score: baixo (1 tell do detector); o problema aqui é ausência de design, não excesso de clichê.

## O que funciona (manter)

- Paleta e Manrope aplicadas com disciplina; `--alarme-texto` e `--sobre-alarme` mostram atenção a contraste.
- Alvos de 48 px em botões e campos, `inputMode="numeric"`, `autoComplete` pensado para aparelho alheio, `role="alert"` e `aria-live` nos lugares certos.
- Texto de erro que não mente sobre a causa e não revela se o e-mail existe.
- Coluna única de 480 px: certa para o contexto; no desktop a página fica centralizada e legível.

## Achados por impacto

### Alto

1. **O botão que conclui a rota fica abaixo da dobra e some do alcance.** `src/telas/LinhaDoTempo.tsx:207`. Em 390x844 a ordem é título, seletor de ocorrência, chips de dia, mapa de 320 px (`estilos.css:42`), chips de horário (um por ponto, podem passar de 20 e quebrar em várias linhas, `:178-190`) e só então "Foi aqui que me roubaram". A pessoa em pânico precisa rolar duas vezes. Correção: barra de ação fixa no rodapé (com `env(safe-area-inset-bottom)`), com o ponto escolhido ("Marcar 14:32") sempre visível.

2. **Mapa: marcadores de 48 px escondem a própria rota.** `src/componentes/Mapa.tsx:275` usa `radius: 24` em todo ponto; círculos de 48 px de diâmetro se sobrepõem e cobrem a linha de 4 px (`:271`). O comentário na linha 274 diz "raio de 14 px", o código diz 24: divergência. O pino do ponto escolhido usa o ícone azul padrão do Leaflet (`:213`, `:280`), fora da marca, e o círculo do selecionado não muda. Os botões de zoom do Leaflet têm ~30 px, abaixo de 48 dp. Correção: pontos pequenos visíveis (raio 6 a 8) com área de toque maior invisível; selecionado em esmeralda com anel petróleo e rótulo da hora; zoom em 48 px; `role="application"` (`:283`) sem teclado: trocar por região com a lista de horários como alternativa (a lista de chips já faz esse papel, só dizer isso no rótulo).

3. **Sem hierarquia e sem sentido de etapa.** `Painel.tsx:79`, `Login.tsx:39`, `LinhaDoTempo.tsx:121`, `Bo.tsx:65`. O título "Ampara — Emergência" é um h1 de 1,5 rem sem marca, repetido em texto simples; nenhuma tela diz "passo 2 de 3". O visual de entrada (print) é só texto petróleo sobre areia, sem logotipo, sem ícone, sem nada que diga "isto é confiável" a um estranho no celular de outro. Correção: faixa de marca petróleo no topo com o logotipo, indicador de três etapas (Avisar, Marcar o local, BO) e títulos que dizem a tarefa.

4. **O vermelho "alarme" está sendo gasto em ações que não são o alarme.** `LinhaDoTempo.tsx:207` ("Foi aqui que me roubaram") e `Bo.tsx:119` ("Enviar à polícia") usam `.alarme`. Se tudo é vermelho, o botão de emergência perde a exclusividade, e "enviar dados à polícia" é um ato de consentimento, não de pânico. Correção: reservar o vermelho para "Preciso de ajuda agora" e o que dispara alerta; as demais ações primárias em petróleo (esmeralda com texto petróleo, se quiser destaque, porque texto branco sobre esmeralda não passa em 4,5:1).

5. **Anel de foco não passa em contraste.** `estilos.css:25`, `:49`. Esmeralda `#14B88A` sobre areia dá cerca de 2,2:1 e sobre branco cerca de 2,5:1; o mínimo para indicador de foco é 3:1. Quem usa teclado ou leitor de tela no aparelho emprestado perde a posição. Correção: anel petróleo de 3 px com espaçamento, ou duplo (branco + petróleo).

### Médio

6. **Confirmação do alarme: toque extra e salto de layout.** `Painel.tsx:86-93, 97-99`. O botão de 120 px é trocado por um bloco com "Sim, avisar" e "Não" lado a lado, ambos de 48 px (`estilos.css:34`). Em pânico, a posição do dedo muda e a pessoa pode tocar errado; quem avisa pelo celular emprestado pode perder segundos. Decisão de produto a validar: toque único com janela de desfazer (cinco segundos, com contagem) costuma servir melhor que confirmação. Se mantiver, "Sim, avisar" deve ocupar a largura inteira e "Não" ficar abaixo, menor.

7. **Sucesso do alarme sem tranquilização.** `Painel.tsx:83`. "Seus guardiões foram avisados. (14:32)" é o ponto de maior emoção da jornada e aparece como linha de texto, sem ícone de confirmação, sem dizer quantos guardiões, sem dizer o que acontece agora. Ele também fica acima da lista de ocorrências, que compete com o próximo passo. Correção: bloco de confirmação com ícone, hora, "o que fazer agora" e um único botão primário ("Marcar onde foi roubado").

8. **Estado cru na lista.** `Painel.tsx:118` mostra `{o.estado}` direto da API (valor de enum). A lista também tem pouca utilidade para quem está em crise e disputa a atenção com o botão principal. Correção: mapa de rótulos legíveis ("Aberta" vira "Guardiões avisados"), itens como cartões com estado em etiqueta, e a lista rebaixada para depois da ação.

9. **Borda lateral grossa no aviso (tell de IA).** `estilos.css:30`, `border-left: 6px` (achado do detector). Trocar por ícone e fundo suave, ou borda completa fina.

10. **Becos sem saída nos avisos.** `Bo.tsx:68` e `LinhaDoTempo.tsx:215`: "Primeiro avise seus guardiões (botão Preciso de ajuda agora)" cita um botão que está em outra tela, sem ação ao lado. Correção: botão "Voltar e avisar guardiões" no próprio aviso.

11. **Botão desabilitado sem explicação.** `Bo.tsx:119`, `estilos.css:24`. "Enviar à polícia" fica a 60% de opacidade até marcar a caixa; o texto de ajuda não existe e o contraste cai bastante. O checkbox em si mede 24 px (`estilos.css:51`; o rótulo cobre o alvo, mas o controle visível é pequeno). Correção: checkbox de 28 a 32 px visíveis, e uma linha "Marque a autorização para enviar" perto do botão.

12. **Larguras de botão inconsistentes.** Em seções que não são `display: grid` (`Bo.tsx:81`, `:94-101`, "Copiar texto" e "Abrir a Delegacia Eletrônica") o botão encolhe ao conteúdo e fica à esquerda, enquanto "Entrar", "Voltar" e os botões das telas em grade ocupam a largura toda. Em tela estreita, toda ação primária deveria ocupar a largura. `.botao-link` (`estilos.css:48`) também tem `margin-top` próprio que quebra o ritmo.

13. **Bloco de texto do BO difícil de ler e de rolar.** `estilos.css:47`. 14 px monoespaçado com rolagem interna de 320 px dentro da página que também rola: armadilha de rolagem em celular. O texto é longo e traz IMEI. Correção: mostrar resumo estruturado (o quê, onde, quando, aparelho) e deixar o texto bruto recolhido em "Ver texto completo", com "Copiar texto" fixo.

14. **Sair do aparelho emprestado é discreto demais.** `Painel.tsx:125`, `Bo.tsx:129-131`, `LinhaDoTempo.tsx:220-222`. "Sair e apagar tudo desta aba" é o último botão de cada tela, igual aos secundários, e usa o termo "aba", que o público não usa. É a ação de privacidade mais importante num celular alheio. A sessão de 30 minutos (`App.tsx`) não aparece em lugar nenhum. Correção: barra superior permanente com "Sair" e "Sessão: 24 min", e frase "Apaga seus dados deste aparelho".

### Baixo

15. **Entrada (print): ajuda ausente.** `Login.tsx:40-64`. Três campos, nenhum link para quem esqueceu o código ou a palavra secreta, e a mensagem de erro "Dados incorretos." (`:26`) não diz o que tentar. "Palavra secreta" não tem botão de mostrar/ocultar, e digitar em teclado alheio erra mais. Em 1280 px a coluna de 480 px fica centralizada sobre uma tela vazia, sem marca, o que parece página não terminada. Correção: link "Não achei meu código" com instrução, mostrar/ocultar, e marca na faixa do topo.

16. **Sem estado pressionado, sem movimento.** `estilos.css:23-25`. Botões só têm `:focus-visible`; faltam `:active` e `:hover` e qualquer transição de 120 a 160 ms. Feedback de toque é a confirmação de que o app recebeu o comando de quem está sem calma. Trocas de estado ("Carregando…", "Entrando…") são texto cru: usar esqueleto ou indicador. Respeitar `prefers-reduced-motion`.

17. **Área segura e viewport.** `index.html:5` não define `viewport-fit=cover` e `estilos.css:18` não usa `env(safe-area-inset-*)`; com barra de ação fixa no rodapé (item 1) isso precisa entrar.

18. **Escala tipográfica rasa.** `estilos.css:19-20, 35`: 24, 18, 20 e 16 px. Com pouco contraste de tamanho, nada é "o título". Peso 800 está carregado (`index.html:9`), mas só `.grande` o usa. Correção: escala com saltos claros (16 / 20 / 28 / 36) e 800 reservado para o ato principal.

## Perguntas provocativas

- Se a pessoa só tiver 20 segundos no celular de um estranho, qual é a única coisa que a tela deveria deixar fazer? Hoje o botão de ajuda é o único que ganha tamanho, mas o resto do fluxo (marcar e BO) é uma pilha de formulário com o mesmo peso.
- A tela deveria parecer um aplicativo confiável de segurança (petróleo firme, ícone, selo) para convencer um estranho dono do aparelho a entregá-lo a mais um minuto?
- O BO precisa mostrar o texto inteiro antes de enviar, ou um resumo conferível?

## Ordem sugerida para a etapa de correção

1. Rota: barra de ação fixa, marcadores do mapa, rótulos de horário (itens 1 e 2).
2. Marca e hierarquia: faixa de topo, etapas, escala tipográfica, uso do vermelho (itens 3, 4 e 18).
3. Foco, estados e privacidade: anel, desabilitado, sair, sessão (itens 5, 11, 14 e 16).
4. Painel: sucesso do alarme, lista e rótulos (itens 6 a 8).
5. BO e entrada: resumo, larguras, ajuda (itens 12, 13 e 15).

Restrições da marca respeitadas em todas as sugestões: petróleo `#0F4C4A`, esmeralda `#14B88A`, areia `#F4EFE6`, alarme `#E5484D` sempre vermelho, Manrope, alvo mínimo de 48 px, contraste mínimo de 4,5:1 (testes em `web-painel-risco/src/contraste.test.ts` e `app/src/theme/__tests__`).
