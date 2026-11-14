# Riscos do dia 1

| Teste | Resultado | Data | Evidência | Plano B |
|---|---|---|---|---|
| net-target | PASSOU | 2026-11-14 | `dotnet new console -f net10.0` recusado (só net11.0 disponível); `-f net11.0` + `dotnet run` imprimiu "Hello, World!", código 0 (SDK 11.0.100 do scoop) | usar net11.0 se o runtime 10 faltar |
| a-emulador-gps | PENDENTE |  |  | app de GPX |
| b-mqtt | PENDENTE |  |  | modo demonstração injeta o mesmo handleEvent |
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

## Pendências

- RMs: o Pedro não informou nome completo nem RMs. `integrantes.txt` usa "Pedro Martins - RM_____" e "Vitor Cesarino Marchese - RM_____". Confirmar o nome completo do Pedro e os dois RMs antes da entrega.
