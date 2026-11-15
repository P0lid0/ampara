# cyber

Código e testes de ataque de Cyber (o PDF de Cyber não entra no repositório).

## Como rodar

Suíte de ataques (13 ataques contra a API real; só banco, Claude e rede são falsos, tudo sintético):

```bash
export PATH="$HOME/scoop/apps/dotnet-sdk/current:$PATH" DOTNET_ROOT="$HOME/scoop/apps/dotnet-sdk/current"
dotnet test cyber/Ampara.Cyber.Ataques
```

Passou = linha `Aprovado!  – Com falha: 0`. A cada execução a tabela `id | vetor | esperado | resultado`
é regravada em `cyber/evidencias/ataques.md` (usada no PDF). Um filtro (`--filter`) só troca as linhas dos
ataques que rodaram. O ataque A10 (frame SignalR) é de prioridade P2: `--filter "prioridade!=P2"` o deixa de fora.

Os testes do motor de PII, do taint e do painel estão em `api/Ampara.Tests` (`dotnet test api/Ampara.sln` roda tudo).

## Integrantes

- Pedro
