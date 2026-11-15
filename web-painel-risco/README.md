# web-painel-risco

Painel Risco Cidadão (React 18.3.1 + Vite): a pessoa vê o próprio índice de risco (farol verde, amarelo ou vermelho) e as mensagens em linguagem simples; o administrador vê a visão executiva das últimas 24 horas. Em modo demonstração, o simulador aciona o fluxo real de proteção com dados sintéticos.

## Como rodar

Pré-requisito: a API (`api/`) no ar em `http://localhost:5080`. Para o simulador aparecer, a API sobe com `AMPARA_DEMO=true`.

```bash
cd web-painel-risco
npm ci
npm run dev          # http://localhost:5174/painel-risco/ (proxy de /api para a 5080)
npx vitest run       # testes
npm run build        # gera dist/ com base /painel-risco/
```

`VITE_API_URL` (ou `EXPO_PUBLIC_API_URL`) aponta outra origem da API; vazio = mesma origem, como a VM serve o painel. O painel sempre acrescenta `/api/v1`.

## Integrantes

- Pedro Martins (RM_____)
- Vitor Cesarino Marchese (RM_____)
