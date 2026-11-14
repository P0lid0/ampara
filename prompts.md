# Registro de uso de IA (prompts)

Formato de cada entrada: `## AAAA-MM-DD — Task N — autor`, seguido do prompt em citação. A IA (Claude Code) foi usada como copiloto; a equipe revisou e sabe explicar cada parte.

## 2026-11-14 — Plano — Pedro

> Monorepo do Ampara (GS CitizenTech): organizar o repositório com app, web de emergência, API em C#, Ponte Polícia, ML, infra, cyber e qa, incluir o repositório de IoT do Vitor como submódulo e escrever o plano de implementação de fundação com os testes de risco do dia 1.

## Prompts do Vitor

# Registro de uso de IA

A regra da GS pede que os prompts usados fiquem registrados aqui. A IA foi usada como copiloto; a equipe revisou e sabe explicar cada parte do código.

## Ferramenta

Claude Code (Anthropic).

## Prompts

### 1. Estrutura da parte IoT

> I am responsible for making the iot part of this project, the core idea is make a charm that the user can have on their keys that can block their phone with a click and send a alert to the police and trust worth contacts the user would setup on a app. I am only responsible for iot so only develop that.

(Enviado junto com o PDF do desafio.)

Resultado: firmware do ESP32, circuito do Wokwi, contrato MQTT com o app e simulador do app em Python.

### 2. Risco (c): colunas reais da planilha SSP (Task 2 da fundação)

> Executar a Task 2 do plano de fundação: escrever `qa/spikes/ssp/colunas.py` com testes primeiro (achar cabeçalho, validar coordenadas, classificar colunas, veredito, perfil e Markdown sem valores de célula), baixar a planilha SSP-SP de 2025 depois do ok do Pedro, rodar sobre o arquivo real e registrar `SSP_VEREDITO` e `SSP_CELULAR` em `docs/riscos-dia1.md`.

Resultado: módulo e testes em `qa/spikes/ssp/`, `docs/dados-ssp-colunas.md` gerado, veredito `GRADE_500M` (76,9% de coordenadas válidas numa amostra de 20000 linhas) e `SSP_CELULAR: PROXY`.

### 3. Risco (b): MQTT no broker.hivemq.com (Task 3 da fundação)

> Executar a Task 3 do plano de fundação: escrever `qa/spikes/mqtt/test_hivemq.py` (conexão, assinatura, ida e volta do evento, status retido e comando ack) com paho-mqtt 2.x, provar que falha contra um broker inexistente, rodar contra o `broker.hivemq.com` e registrar `b-mqtt` e `MQTT_HOST_EFETIVO` em `docs/riscos-dia1.md`.

Resultado: 5 testes passando no HiveMQ público; só mensagens `type: "test"` sintéticas, com `deviceId` aleatório.

### 4. Risco (a): rota no emulador e localização em segundo plano (Task 4 da fundação)

> Executar a Task 4 do plano de fundação: escrever `qa/spikes/verificar-gps-background.sh` (WHPX, AVD, APK instalado, permissões, app em segundo plano, 10 `adb emu geo fix` sintéticos, pelo menos 8 linhas `AMPARA_PONTO` e último ponto perto do destino), ver falhar na asserção 3, criar o app Expo descartável `qa/spikes/gps-background` com `expo-location` e `expo-task-manager`, compilar o APK release, ver passar e registrar `a-emulador-gps` e `ExpoSDK` em `docs/riscos-dia1.md`.

Resultado: script e app em `qa/spikes/`, 14 pontos recebidos em segundo plano no emulador `guardiao_vitima`; rota 100% sintética (estação Pinheiros como ponto inicial); achados de build e de precisão registrados em `docs/riscos-dia1.md`.

### 5. Risco (d): VM Ubuntu 24.04 em QEMU com WHPX (Task 5 da fundação)

> Executar a Task 5 do plano de fundação: escrever `infra/spike/verificar-vm.sh` (QEMU e qemu-img, SHA-256 da imagem, WHPX sem erro, login na serial em 300 s, SSH com chave imprimindo `ampara-vm`, cloud-init done, poweroff), ver falhar, instalar o QEMU pelo scoop e baixar a imagem cloud do Ubuntu 24.04 depois do ok do Pedro, criar `run-vm.sh`, `user-data.tpl` e `meta-data` com seed NoCloud por HTTP, ver passar e registrar `d-vm` e `VM` em `docs/riscos-dia1.md`.

Resultado: VM sobe com QEMU+WHPX, login em cerca de 62 s, SSH em `localhost:2222`, `VM: QEMU+WHPX`; imagem, disco e chaves ficam fora do git em `infra/vm/`.

### 6. Amostra real do chaveiro e fechamento do dia 1 (Task 6 da fundação)

> Executar a Task 6 do plano de fundação: escrever `qa/spikes/mqtt/chaveiro_real.py` com testes primeiro (`validar_evento` com os 8 campos do contrato e `main` que assina só o deviceId, valida o evento, manda `ack` e confere 15 s sem retransmissão), rodar contra o Wokwi do Vitor ou, se ele estiver indisponível, gravar `e-wokwi` = PULADO e agendar a prova real para o plano 08; depois rodar o fechamento do dia 1.

Resultado: validador e CLI em `qa/spikes/mqtt/` (4 testes passando), `e-wokwi` = PULADO com a prova real agendada para o plano 08 e seção `## Amostra real do chaveiro` criada em `docs/riscos-dia1.md`; `main` exercitado só com publicação sintética no HiveMQ público.

<!-- Acrescente aqui os próximos prompts usados pela equipe. -->
