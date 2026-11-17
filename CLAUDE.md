# Ampara: instruções para agentes

## Etapa de design (obrigatória antes dos prints finais e dos vídeos)
O Pedro pediu em 16/11: as telas estão saindo sem gosto. Antes de tirar os prints da entrega ou gravar
vídeo, faça esta etapa. Diga em uma linha qual skill está usando.

1. **Auditoria do app** — skill `mobile-design-review` em `app/`. As telas ficam em `app/src/app/` e os
   componentes em `app/src/ui/`; ajuste os caminhos do grep de "tells" (a skill supõe `app/` e
   `components/`). Saída: relatório com Design Score, AI Slop Score e achados por impacto.
2. **Sistema de design** — skill `mobile-design-system` (com `expo-design-system` para as convenções da Expo)
   partindo de `app/src/theme/tokens.ts`. Grave `MOBILE-DESIGN.md` na raiz do app. **Mantenha a marca**:
   petróleo `#0F4C4A`, esmeralda `#14B88A`, areia `#F4EFE6`, alarme `#E5484D` sempre vermelho, Manrope,
   alvo ≥ 48 dp, teste de contraste ≥ 4.5:1 continua passando.
3. **Corrigir só o de alto impacto** — skill `mobile-redesign-screen`, uma tela por vez, nesta ordem:
   alarme do guardião, início da vítima, rota/BO, onboarding. Não mudar rotas, nomes de campo,
   contratos (`docs/superpowers/plans/2026-11-14-00-indice-e-contratos.md`) nem quebrar a suíte.
   Movimento e toque: `expo-animation`; desempenho e área segura: `vercel-react-native-skills`.
4. **Web** — `web-emergencia/` e `web-painel-risco/`: skill `impeccable` (critique e depois polish).
   `apresentacao/`: `design-taste-frontend`.
5. **Ver de verdade** — print antes e depois de cada tela (`adb exec-out screencap -p`, ou
   `app/scripts/prints.sh`), crítica de novo, e só então os prints de `app/docs/prints` da entrega.
   Mostrar ao Pedro o antes/depois.

Prazo: entrega 19/11 23h55. Se faltar tempo, faça 1, 3 nas duas telas mais vistas no vídeo, e 5.
