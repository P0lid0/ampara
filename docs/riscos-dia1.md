# Riscos do dia 1

| Teste | Resultado | Data | Evidência | Plano B |
|---|---|---|---|---|
| net-target | PASSOU | 2026-11-14 | SDK 11.0.100 (scoop). `dotnet new console -f net10.0` recusado ("net10.0 não é um valor válido", só net11.0). Com csproj editado para net10.0, compila mas `dotnet run` sai com código 150: "You must install or update .NET to run this application ... Framework: Microsoft.NETCore.App, version 10.0.0 (x64)" (só há runtime 11.0.0). Com net11.0, `dotnet run` imprime "Hello, World!", código 0 | usar net11.0 se o runtime 10 faltar |
| a-emulador-gps | PASSOU | 2026-11-14 | `bash qa/spikes/verificar-gps-background.sh` sai com código 0 (asserções 1-8): WHPX usable, AVD guardiao_vitima sobe, APK release `br.fiap.ampara.spike` (Expo SDK 58.0.25, expo-location + expo-task-manager) em segundo plano recebeu 14 linhas AMPARA_PONTO a partir de 10 `adb emu geo fix` sintéticos; último ponto lat -23.5690483, lng -46.6956501 (destino -23.5690490, -46.6956515). Três achados: (1) com `Accuracy.Balanced` o emulador entrega 0 pontos (2 execuções), com `Accuracy.High` entrega; o spike usa High. (2) O build Android estoura o limite de 260 caracteres do ninja do CMake 3.22 no Windows (LongPathsEnabled=0) por causa de react-native-screens e safe-area-context; sem Expo Router o build passa em `C:\a\gps` (cópia sem node_modules), então o spike não usa Expo Router: `index.js` + `App.tsx`. O app de produção do plano 05 precisa de Expo Router ou de caminho curto/LongPathsEnabled na máquina de build. (3) JDK 17 do scoop falha em `Pipe.open` (`UnixDomainSockets.connect: Invalid argument`) com o Temp curto do Windows; contornado com `JAVA_TOOL_OPTIONS="-Djava.io.tmpdir=C:/ampara-tmp -Djdk.net.unixdomain.tmpdir=C:/ampara-tmp"`. Build release do zero ~15 min (x86_64 só), incremental ~1 min | app de GPX |
| b-mqtt | PASSOU | 2026-11-14 | broker.hivemq.com:1883, paho-mqtt 2.x: 5 testes passaram (CONNACK 0, SUBACK em events/status, ida e volta do evento type test, status retido recebido por quem assina depois, comando ack em cmd). Contra 127.0.0.1 os 5 falham (recusa de conexão), então o teste sabe falhar. Firmware do Vitor tem o broker fixo | modo demonstração injeta o mesmo handleEvent |
| c-ssp | PASSOU | 2026-11-14 | SPDadosCriminais_2025.xlsx (abas JAN-JUN_2025 e JUL-DEZ_2025) abriu e foi perfilada (`docs/dados-ssp-colunas.md`). Achou LATITUDE, LONGITUDE, DATA_OCORRENCIA_BO, RUBRICA, NOME_MUNICIPIO, BAIRRO. Coordenadas válidas na capital: 76,9% nas primeiras 20000 linhas da aba JAN-JUN_2025 (amostra, não o ano todo). Sem coluna de objeto celular: RUBRICA/DESCR_CONDUTA como proxy | distrito ou SPSafe |
| d-vm | PENDENTE |  |  | Hyper-V ou Azure |
| e-wokwi | PENDENTE |  |  | simulador Python do Vitor |

Resultado: `PENDENTE`, `PASSOU`, `FALHOU` ou `PULADO`.

Valores lidos pelos planos 02 a 07:

TargetFramework: net11.0
ExpoSDK: 58.0.25
SSP_VEREDITO: GRADE_500M
SSP_CELULAR: PROXY
MQTT_HOST_EFETIVO: broker.hivemq.com
VM: PENDENTE

## Pendências

- RMs: o Pedro não informou nome completo nem RMs. `integrantes.txt` usa "Pedro Martins - RM_____" e "Vitor Cesarino Marchese - RM_____". Confirmar o nome completo do Pedro e os dois RMs antes da entrega.
