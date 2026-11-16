# Crítica de design depois do polish: web-painel-risco

Data: 16/11/2026. Skill: `impeccable`, modo critique, só leitura (nenhum código alterado). Superfície em modo Operate (painel de leitura rápida). Comparada com `critica.md` (24/40).

## Método

- DEGRADADO, contexto único: a tarefa proibia subagentes, então a revisão de design (A) e a evidência do detector (B) rodaram em sequência no mesmo contexto. A revisão A foi escrita antes de ler a saída do detector.
- Detector `impeccable detect --json web-painel-risco/src web-painel-risco/index.html`: 0 achados (antes: 0). O detector lê marcação e não vê hierarquia, ordem de foco nem cor no CSS; por isso a revisão manual pesa mais aqui.
- Navegador: entrada vista ao vivo na 5174 em 390 px e 1280 px (sem rolagem horizontal: 390/390 e 1280/1280; alvos de 48 px medidos; Manrope empacotada, carregando por `@fontsource`). Não enviei formulário.
- Visão do cidadão e visão executiva avaliadas pelas capturas do polish (`docs/design/depois/*.png`, 390 e 1280, com dados sintéticos, já que a API 5080 não estava no ar) e pelo código lido (`estilos.css`, `Farol`, `Mensagens`, `Simulador`, `VisaoExecutiva`, `Abas`, `App`, `Login`, `rotulos.ts`).
- O polish do painel está commitado (`cc5d745`).
- Sem `PRODUCT.md`: o detector de contexto pediu `init`. Há `DESIGN.md` na raiz.

## Veredito de especificidade

Subiu de "sem autoria" para "tem voz". O farol agora é um bloco cheio com palavra, índice, barra de escala, orientação e "O que fazer agora"; a aba ativa tem ponto esmeralda; o simulador vive numa caixa âmbar com selo "DEMONSTRAÇÃO"; a frase "Quase vazou o seu CPF… Bloqueamos antes de sair" ficou em destaque. Ainda é a mesma gramática de cartão branco em toda parte, mas a marca (logo, esmeralda, petróleo em ação) aparece onde importa. AI Slop Score: baixo.

## Nota

| # | Heurística (0 a 4) | Antes | Agora | Por quê |
|---|---|---|---|---|
| 1 | Visibilidade do estado | 3 | 3 | "Atualiza sozinho a cada 5 segundos", "Disparado: … O farol atualiza em instantes." Falta "atualizado há X s" real |
| 2 | Linguagem do usuário | 3 | 3 | Tempo relativo ("há 1 h") e detalhes técnicos recolhidos. "senha" em minúscula ao lado de "CPF" e "Saúde" |
| 3 | Controle e liberdade | 1 | 3 | "Sair" fixo no cabeçalho em todas as telas |
| 4 | Consistência | 3 | 3 | Verde do farol é esmeralda e já não se confunde com o cabeçalho. Eixo do gráfico mistura "horas atrás" e hora do relógio (item 3) |
| 5 | Prevenção de erro | 3 | 3 | Simulador recolhido e rotulado. Os quatro botões ficam desabilitados juntos durante o envio |
| 6 | Reconhecimento | 3 | 3 | Escala do índice explicada ("Quanto maior o número, mais exposto você está") |
| 7 | Flexibilidade | 2 | 2 | Sem período nem filtro; aceitável para o escopo do vídeo |
| 8 | Estética e minimalismo | 2 | 3 | Hierarquia clara: farol, depois mensagens, depois demonstração |
| 9 | Recuperação de erro | 3 | 3 | Mensagens claras; falha de rede discreta, sem empurrar a tela |
| 10 | Ajuda | 1 | 2 | Orientação por estado e "O que fazer agora"; sem ajuda no login, sem "esqueci a senha" |

Total: 28/40 (antes 24/40, +4). Os ganhos estão em controle (Sair), estética e ajuda.

## O que melhorou (dos achados anteriores)

| Antes | Estado | Evidência |
|---|---|---|
| P1-1 Farol não parece farol, verde some na marca | Resolvido | Bloco cheio, 2,25 rem, verde esmeralda com texto `#12201F`, âmbar com texto escuro, vermelho com `#111` (4,82:1); barra de escala e legenda (`estilos.css:farol-*`, `Farol.tsx`) |
| P1-2 Informa e nunca orienta | Resolvido | Frase de orientação por estado e "O que fazer agora" no vermelho; tempo relativo; rodapé técnico atrás de "Ver detalhes" |
| P1-3 Simulador competindo com a tela real | Resolvido | `<details>` recolhido, selo "DEMONSTRAÇÃO", botões em contorno, confirmação "Disparado: …" |
| P1-4 Sem Sair, cabeçalho sem marca | Resolvido | Faixa em largura total com marca, nome da visão e Sair de 48 px |
| P2-1 Executiva sem leitura | Resolvido em boa parte | Número de 3 rem com leitura ("9 deles às 15h, o pico do dia"), barras em ordem decrescente com a maior em destaque, eixo 0 a 9, pico rotulado, marcas de hora, duas colunas a partir de 960 px |
| P2-2 Manrope não empacotada | Resolvido | `@fontsource/manrope` 400/600/700/800 em `main.tsx` |
| P2-3 Escala tipográfica | Resolvido | Tokens `--t-hero/display/titulo/secao`, h1 definido |
| P2-4 Estados interativos | Resolvido | Foco duplo petróleo + halo, `:hover`, `:active`, "Entrando" com spinner |
| P2-5 Login seco | Resolvido em parte | Frase de contexto, Mostrar/Ocultar, garantia "A sessão fecha quando você fecha esta janela"; ainda sem ajuda |
| P3 ícones como caracteres | Resolvido | SVG (`Icones.tsx`) |

## Achados que restam, por impacto

Nenhum é bloqueio. Tudo médio ou baixo.

### Médio

1. **O farol vermelho contradiz as mensagens que estão logo abaixo.** `Farol.tsx` ("Detectamos tentativas graves de expor seus dados", índice 82/100, "O que fazer agora… avise um guardião… peça ajuda") sobre três mensagens que dizem "Bloqueamos antes de sair", "Escondemos", "Foi cifrado" (`depois/cidadao-390.png`). Para a vítima (e para a banca no vídeo) a leitura é: está tudo vermelho, mas nada vazou, e o painel manda pedir ajuda. É uma decisão de tom, não de pixel. Opções: a orientação do vermelho distinguir "barramos tudo" de "algo passou" (usar `decisao === "Permitido"` que `Mensagens.tsx:20` já distingue com ícone), ou o texto do vermelho abrir com "Barramos todas." quando for o caso.
2. **O gráfico por hora e a leitura ao lado falam línguas diferentes.** `VisaoExecutiva.tsx`: a leitura diz "às 15h" (relógio de Brasília), o eixo diz "23 h, 18 h, 12 h, 6 h, agora" e a nota "Horas atrás, no horário de Brasília". Quem lê "23 h" pensa em 23 horas da noite. Rotular o eixo como "há 23 h", "há 18 h" ou usar horas do relógio nos dois lugares; se o pico é "agora", dizer "agora" na leitura.
3. **Gráfico: dica de mouse em tela de toque e 24 paradas de Tab.** "Passe o mouse ou foque uma coluna para ver o valor" aparece em 390 px, onde não há mouse; as 24 colunas têm `tabIndex={0}` (`VisaoExecutiva.tsx:57`). No celular não há como ler um valor que não seja o pico; no teclado, 24 Tabs para atravessar o gráfico. Correção: tocar na coluna mostra o valor (ou lista alternativa recolhida "Ver por hora"), e o gráfico vira um único `tab stop` com setas para mover entre colunas, como `Abas.tsx` já faz.
4. **Cabeçalho e conteúdo desalinhados em 1280 px.** Medido ao vivo: o logo começa em x=136 (`.topo-interno`, 1040 px) e o conteúdo da visão do cidadão e do login em x=296 e x=430 (colunas de 720 e 420 px). Na visão executiva (1040 px) alinha; nas outras duas parece que o cabeçalho e a página são de grades diferentes. Alinhar `.topo-interno` à largura da coluna da vez (ou assumir 720 como largura padrão e só ampliar a executiva).

### Baixo

5. **Executiva sem comparação.** "32 eventos nas últimas 24 h" não diz se é muito. Já há leitura do pico; falta "x% a mais que ontem" ou, se não houver dado, assumir que o painel é de leitura e dizer isso.
6. **"Ver detalhes" repetido sem contexto.** Três links iguais por mensagem para leitor de tela; `aria-label` com o início da frase da mensagem resolve.
7. **Capitalização dos rótulos.** `rotulos.ts`: "CPF", "IMEI", "senha", "Saúde". Padronizar (Senha, Saúde, CPF, IMEI).
8. **Cabeçalho do simulador cabe mal em 390 px.** O selo "DEMONSTRAÇÃO" e "Simular um ataque" disputam a linha e o segundo texto quebra em duas (`depois/cidadao-390.png`); aceitável, mas "Simular" sozinho cabe.
9. **Sem título para a lista de mensagens.** Entre o farol e as mensagens não há `h2` ("O que aconteceu"); o leitor de tela pula direto para uma lista sem nome.
10. **Login sem ajuda.** "Entrar" é o único caminho; um "Esqueci a senha" (mesmo que só diga como pedir a um guardião) fecha a heurística 10.
11. **Metade vazia no login em 390 px.** Aceitável, a frase de contexto e a garantia seguram; só registro.

## Pontos fortes a manter

- Contraste testado (`contraste.test.ts`): pares do verde e do âmbar escurecido com texto escuro, vermelho com `#111`, `--alarme-texto` para texto vermelho sobre areia.
- Estado nunca só por cor: palavra, ícone e índice no farol; ícone na aba ativa além da cor.
- Informação recolhida na hora certa: detalhes técnicos e demonstração fechados por padrão, abertos por escolha; "O que fazer agora" só quando há o que fazer.
- Fonte empacotada: a marca não some em outro aparelho.

## Personas

- Pessoa em pânico: vê "Risco alto" e a instrução do que fazer; a contradição do item 1 pode atrasá-la, porque as mensagens abaixo dizem que tudo foi barrado.
- Parente acionado ("ela está segura agora?"): o verde esmeralda e "Você não precisa fazer nada" respondem em um segundo.
- Gestor na apresentação: leitura clara do total e do pico; o eixo em "horas atrás" (item 2) e a falta de comparação (item 5) pedem uma explicação falada.
- Idoso / baixa visão: alvos de 48 px, foco forte, texto de 16 px mínimo. Os 24 Tabs do gráfico (item 3) são o ponto mais custoso.

## Ordem sugerida

1. Coerência entre o farol vermelho e as mensagens bloqueadas (item 1).
2. Eixo do gráfico e leitura ao lado na mesma linguagem; valor por toque (itens 2 e 3).
3. Alinhar cabeçalho e coluna em telas largas (item 4).
4. Rótulos, `aria-label` de "Ver detalhes", título da lista, ajuda no login (itens 6 a 10).

Restrições respeitadas: petróleo `#0F4C4A`, esmeralda `#14B88A`, areia `#F4EFE6`, alarme `#E5484D` só no risco alto, Manrope, alvo mínimo de 48 px, contraste mínimo de 4,5:1.
