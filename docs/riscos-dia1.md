# Riscos do dia 1

| Teste | Resultado | Data | EvidÃªncia | Plano B |
|---|---|---|---|---|
| net-target | PASSOU | 2026-11-14 | SDK 11.0.100 (scoop). `dotnet new console -f net10.0` recusado ("net10.0 não é um valor válido", só net11.0). Com csproj editado para net10.0, compila mas `dotnet run` sai com código 150: "You must install or update .NET to run this application ... Framework: Microsoft.NETCore.App, version 10.0.0 (x64)" (só há runtime 11.0.0). Com net11.0, `dotnet run` imprime "Hello, World!", código 0 | usar net11.0 se o runtime 10 faltar |
| a-emulador-gps | PENDENTE |  |  | app de GPX |
| b-mqtt | PENDENTE |  |  | modo demonstraÃ§Ã£o injeta o mesmo handleEvent |
| c-ssp | PENDENTE |  |  | distrito ou SPSafe |
| d-vm | PENDENTE |  |  | Hyper-V ou Azure |
| e-wokwi | PENDENTE |  |  | simulador Python do Vitor |

Resultado: `PENDENTE`, `PASSOU`, `FALHOU` ou `PULADO`.

Valores lidos pelos planos 02 a 07:

TargetFramework: net11.0
ExpoSDK: PENDENTE
SSP_VEREDITO: PENDENTE
SSP_CELULAR: PENDENTE
MQTT_HOST_EFETIVO: PENDENTE
VM: PENDENTE

## PendÃªncias

- RMs: o Pedro nÃ£o informou nome completo nem RMs. `integrantes.txt` usa "Pedro Martins - RM_____" e "Vitor Cesarino Marchese - RM_____". Confirmar o nome completo do Pedro e os dois RMs antes da entrega.
