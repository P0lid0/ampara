# app

App do cidadão e do guardião (Expo SDK 58 + TypeScript + Expo Router): cadastro, guardiões, alarme, mapa, histórico de rota e BO.

> README provisório; a versão final (ficha da CitizenTech, como rodar, APK e prints) chega no fim do plano 05.

## Verificação

```bash
cd app
npm install
npx jest          # testes
npx tsc --noEmit  # tipos
```

Configuração: copie `.env.example` para `.env` (`EXPO_PUBLIC_API_URL`; vazio usa `http://10.0.2.2:5080`).

## Integrantes

- Pedro
