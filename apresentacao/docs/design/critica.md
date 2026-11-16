# Crítica final da página de apresentação (16/11/2026)

Skill: `design-taste-frontend` (direção "O produto em ação", marca mantida do app). Partida: `revisao.md`. Antes: `antes/`. Depois: `depois/`.

## Decisões

- **Ideia:** na página, os 90 minutos depois do roubo viram o relógio da página; o vermelho só existe no alarme (hero e simulação). Concorrente de rastreio de celular não tem guardião, 60 segundos nem passo a passo carimbado, então a frase não serve a ele.
- **Coisa viva:** "Simular o alarme" (tempo real, ou 6 vezes mais rápido): botão do chaveiro, contagem de 60 s, escada Marina, Paulo, Helena, "Estou ciente", passos carimbados com a hora e o tempo depois do alarme. Fallback sem script: print real. O ping dos serviços foi para o rodapé (`?apresentador` fixa a barra).
- **Marca:** petróleo, esmeralda, areia, Manrope local (400, 600, 700, 800). Alarme `#E5484D` só no alarme; texto `#111111` sobre ele; `#B3202A` só para o rótulo "60 s".
- **Conteúdo:** app e página de emergência passaram de "só README" para "roda"; telas reais do app em vez do desenho e do esboço com `--:--`; tabela real de estado (10 partes); folha de segurança em recolher, só os limites abertos.
- **Tirado:** Bebas e Garamond, recibo com zigue-zague, cartão inclinado, linhas pontilhadas em massa, três cartões iguais, ODS em quatro blocos, a mesma foto quatro vezes.

## Medição (inspector, 1440, 768 e 390)

Antes: 0 FAIL, 1 WARN; 13,4 telas; 13 imagens; mídia do herói 14%.
Depois: 0 FAIL; 13,9 telas; 18 imagens; herói com 2 linhas nos três tamanhos. WARN que ficam: areia lida como creme (é a areia da marca), 14 tamanhos de fonte (parte são os da tela do app dentro dos fragmentos), sem vídeo (não há clipe honesto do app; ver pendências), margem direita de 58 px dentro da folha de segurança (texto dentro de superfície tingida).

## Notas da última rodada

Design 8,0 · usabilidade 8,2 · criatividade 8,0 · conteúdo 8,6. Falta: um clipe curto do alarme do app em loop (resolve o único WARN de mídia), o clipe de verdade do chaveiro quando o protótipo existir, e refazer `preparar-midia.py` depois que os prints do app forem refeitos.
