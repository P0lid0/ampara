# Roteiro do vídeo do Painel Risco Cidadão (alvo: 2 a 3 minutos)

Quem grava: Pedro. Dados 100% sintéticos. Este roteiro tem 2 min 45 s de ação; se passar de 3 min, corte a fala do marco 2:05.

## Antes de gravar

1. **Zerar a demonstração** (o índice volta a 0 e o farol, a verde):

   ```bash
   bash cyber/scripts/zerar-demo.sh
   ```

2. **Subir a API em modo demonstração, com o taint ligado** (nunca `Cyber__TaintAtivo=false` na gravação). O filtro de log deixa no terminal só as linhas do simulador, sem o ruído do EF:

   ```bash
   export PATH="$HOME/scoop/apps/dotnet-sdk/current:$PATH" DOTNET_ROOT="$HOME/scoop/apps/dotnet-sdk/current"
   set -a; . ./.env; set +a
   env AMPARA_DEMO=true "Logging__LogLevel__Microsoft.EntityFrameworkCore=Warning" \
     dotnet run --project api/Ampara.Api 2>&1 | grep --line-buffered -A1 "Ampara.Simulador"
   ```

3. **Subir o painel**: `cd web-painel-risco && npm run dev` e abrir `http://localhost:5174/painel-risco/`.
4. **Janelas**: painel aberto no cidadão (`vitima@ampara.demo`, já logado, aba "Meu risco") e, ao lado, o terminal com o log da API. Em outra aba do navegador, o painel logado como `admin@ampara.demo`, na aba "Visão executiva" (as duas contas usam a senha de demonstração do README da API).
5. Se for usar a frase da IA no marco 1:50: definir `ANTHROPIC_API_KEY` no ambiente da API antes de subir. Sem a chave, a frase é a padrão (também serve, e a fala abaixo vale para as duas).
6. Ensaio rápido: clicar em um cenário, ver o farol mexer, rodar `zerar-demo.sh` de novo. O painel atualiza sozinho a cada 5 s; depois do clique ele atualiza na hora.

## Marcos

| Tempo | Tela e clique | Fala |
|---|---|---|
| **0:00** | Painel do cidadão no verde, terminal ao lado ainda vazio. Sem clicar. | "Oi, somos o Pedro e o Vitor, e este é o Ampara: o app que ajuda a vítima de roubo de celular a bloquear o banco e as contas. Como ele guarda IMEI, bancos e rota, a própria API não pode vazar esses dados. Este é o Painel Risco Cidadão: ele mostra, em tempo real e em português simples, quando algo tentou vazar um dado seu." (até 0:15) |
| **0:15** | Apontar o farol **verde, "Seguro", 0/100** e a frase "Nada de estranho nas últimas 24 horas". | "Agora o índice é zero, o farol está verde. O índice vai de 0 a 100 e é a soma do peso dos bloqueios das últimas 24 horas: abaixo de 30 é verde, de 30 a 69 amarelo, e de 70 para cima, vermelho." |
| **0:35** | Clicar **"Acesso indevido"**. O farol vai a **amarelo, "Atenção", 40/100**; aparece o cartão "Alguém tentou entrar em uma área sua sem permissão…". | "Primeiro cenário: alguém tentou usar um código de emergência que não era dele. Isso pesa 40, e o farol já vai para amarelo. O painel diz o que aconteceu e o que fazer, sem termo técnico." |
| **1:00** | Clicar **"Senha na resposta pública"**. O farol continua **amarelo, 65/100**; entra um segundo cartão. | "Segundo cenário: um endpoint público tentou devolver uma senha na resposta. O sistema trocou a resposta por um aviso antes de ela sair. Esse tipo de bloqueio pesa 25: 40 mais 25, 65. Ainda amarelo, perto do limite." |
| **1:25** | Clicar **"Vazar CPF no log"**. O farol vai a **vermelho, "Risco alto", 75/100**. No terminal ao lado aparece a linha com **`[BLOQUEADO:Cpf]`**. Apontar o terminal, depois o farol. | "Terceiro cenário: o código tenta escrever um CPF no log. Olha o terminal: onde estaria o número, está `[BLOQUEADO:Cpf]`. O CPF nunca chegou ao arquivo. Esse bloqueio pesa 10, são 75 pontos, e o farol fica vermelho." |
| **1:50** | Rolar até o cartão mais recente e deixar a frase em destaque (dar zoom no texto do cartão). | "E o cidadão não lê 'erro 500': a IA traduz o evento em duas frases simples, o que aconteceu e o que fazer. O prompt da IA tem só a categoria, o ponto de saída e o tipo da falha. Nunca o dado." |
| **2:05** | Trocar para a aba do **admin**, **"Visão executiva"**. Apontar o total, as barras **por tipo de dado** (CPF 1, senha 2) e **por ponto de saída** (registro do sistema 1, resposta pública 2) e o gráfico por hora. | "Para quem administra a plataforma, a visão executiva: quantos eventos nas últimas 24 horas, por tipo de dado e por ponto de saída, e por hora. Só quem é administrador vê esta tela." |
| **2:30** | Voltar à tela do cidadão em vermelho (ou ao terminal com `[BLOQUEADO:Cpf]`). | "Resumindo: o dado é reconhecido na entrada, acompanhado até cada saída, bloqueado antes de vazar, e explicado para o cidadão em português simples. E o mais importante: **o valor nunca é gravado**. O rastro guarda só de onde veio, qual campo, qual classe e o que foi decidido. Obrigado!" |

## Depois de gravar

- `bash cyber/scripts/zerar-demo.sh` deixa o painel limpo de novo.
- Parar a API e o painel (Ctrl+C em cada terminal).
- Se a gravação for refeita com a chave da IA, regravar também os prints (`node cyber/scripts/prints-painel.mjs`) e o PDF (`node cyber/scripts/gerar-pdf.mjs`).
