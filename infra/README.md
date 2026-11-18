# infra: VM Linux do Ampara (Operating Systems)

Uma VM Ubuntu Server 24.04 que se provisiona sozinha no primeiro boot e hospeda a aplicação web do Ampara (API em C#, Ponte Polícia em Python, painéis web e nginx), com monitoramento de CPU, memória e disco como serviço systemd, auditoria com auditd e testes de falha. Tudo é feito por scripts Bash e cloud-init: nenhum passo manual dentro da VM.

## Ficha da CitizenTech

| Campo | Valor |
|---|---|
| Nome | **Ampara** — "Levaram seu celular. Não levam o resto." |
| Cidade e bairro | São Paulo, capital: eixo da CPTM Linha 9-Esmeralda (Pinheiros como estação crítica) e corredores de quebra-vidro (ex.: Av. do Estado) |
| Cidadão beneficiado | Quem anda com o celular em SP (passageiro de trem/metrô, motorista parado no trânsito) e o **guardião** (parente ou amigo que age por ele na hora) |
| Problema, em uma frase | Depois de um roubo de celular, a vítima fica de 30 a 90 minutos sem aparelho e em choque até chegar em casa ou no trabalho, e é nessa janela que os criminosos entram no banco e nas contas. |
| Como funciona | Antes: o app guarda o que a vítima não lembraria na hora (IMEI, bancos, operadora, guardiões) e a rota dos últimos 7 dias. Durante: um clique no chaveiro (ESP32) ou um código digitado em outro aparelho dispara um alarme insistente no celular do guardião, que segue um passo a passo de bloqueio enquanto a vítima ainda está a caminho. Depois: por outro aparelho, a vítima marca na rota onde e quando foi roubada e o Ampara gera o BO com o IMEI; a ocorrência, minimizada e com consentimento, vai para um painel da polícia (simulado), e o andamento volta ao cidadão. Um mapa mostra o risco previsto por um modelo treinado com dados da SSP-SP e relatos das últimas 2 horas com proteção contra abuso. O Ampara não bloqueia o celular: avisa quem pode bloquear contas e linha. |
| O que cada parte faz | **App** (Expo): cadastro, guardiões, alarme, mapa, histórico de rota, BO. **Página de emergência** (web): acesso por outro aparelho. **API Ampara** (C#/.NET): regras, dados, tempo real, escuta do chaveiro por MQTT, motor PII e taint. **Ponte Polícia** (Python/FastAPI): recebe ocorrências minimizadas e mostra pontos quentes à polícia. **ML** (Python): risco por área e horário. **Chaveiro** (ESP32/Wokwi, Vitor): botão de pânico que fala por MQTT com a API. **VM Linux**: provisiona e mantém tudo no ar. **Painel Risco Cidadão**: bloqueios de segurança traduzidos por IA. |
| Link do repositório | https://github.com/P0lid0/ampara |
| Indicador de impacto | minutos entre o roubo e o primeiro bloqueio confirmado pelo guardião; % de BOs gerados com IMEI válido; tempo para gerar o BO |
| ODS conectados | **11, 10, 9** (na lista do briefing) e **16** (adicional, fora da lista do briefing) |

## Integrantes

- Guilherme (RM 554962)
- Pedro Martins (RM 555556)
- Fabrício (RM 558216)
- Vitor Cesarino Marchese (RM 554893)
- Matheus (RM 555447)

## Como a VM é criada

O Windows só cria o disco, serve o seed do cloud-init por HTTP (a VM enxerga o computador como `10.0.2.2`) e inicia o QEMU com aceleração WHPX. Dentro da VM, o cloud-init no primeiro boot extrai o repositório e roda `infra/vm/provisiona.sh`, que executa `01-infra.sh`, `02-app.sh`, `03-monitor.sh` e `04-auditoria.sh` em ordem. Cada script é idempotente e grava início, fim e código de saída em `/var/log/ampara/execucao.log`.

Pré-requisitos no Windows: QEMU (`scoop install qemu`), virtualização por WHPX ativada, Python 3, OpenSSH e Git. A imagem `noble-server-cloudimg-amd64.img` do Ubuntu 24.04 e o `SHA256SUMS` ficam em `infra/.vm/` (a pasta não vai para o Git).

Do zero, na raiz do repositório (a árvore precisa estar commitada: o seed leva o `HEAD`):

```powershell
powershell -NoProfile -File infra/host/Criar-Vm.ps1 -Acao Preparar -Recriar
powershell -NoProfile -File infra/host/Criar-Vm.ps1 -Acao Subir
powershell -NoProfile -File infra/host/Criar-Vm.ps1 -Acao Ssh -Comando "cloud-init status --wait"
```

O provisionamento leva de 20 a 40 minutos (baixa .NET SDK, Node e pacotes). Para acompanhar: `... -Acao Ssh -Comando "sudo tail -f /var/log/ampara/provisiona.log"`. Para conferir tudo: `... -Acao Ssh -Comando "sudo bash /opt/ampara/src/infra/vm/verifica-vm.sh"`. Para parar: `-Acao Parar` (encerra só os PIDs gravados). `-Acao Sincronizar` copia `infra/vm` do Windows para a VM sem recriá-la.

Portas do host para a VM: `8080` para `80` (nginx), `2222` para `22` (SSH). O seed sai em `8088`.

Em outro Ubuntu 24.04 (Hyper-V, VM na Azure), o mesmo `provisiona.sh` roda com `sudo`; só mudam `VM_IP`, `VM_GATEWAY` e `VM_DNS` em `/etc/ampara/vm.conf`.

## Critério da rubrica, script e evidência

| Critério | Pts | Onde está | Evidência |
|---|---|---|---|
| Infraestrutura (rede, DNS, IP) | 2 | `infra/vm/01-infra.sh` (hostname, netplan com IP fixo, gateway, DNS, usuários, ufw, NTP) e `infra/vm/config/vm.conf` | `infra/evidencias/08-rede-ufw.txt`, `01-verifica-vm.txt` |
| Aplicação (dependências, configurações, orquestração) | 2 | `infra/vm/02-app.sh`, `infra/vm/config/units/` (migrations, API, Ponte com `After=`/`Requires=`), `infra/vm/config/nginx-ampara.conf`, `infra/vm/ampara-healthcheck.sh` | `infra/evidencias/07-systemctl-status.txt`, `01-verifica-vm.txt` |
| Monitoramento de CPU, disco e memória com alertas | 2 | `infra/vm/ampara-monitor.sh`, `infra/vm/config/monitor.conf` (CPU 80%, memória 80%, disco 85%), `infra/vm/stress.sh` | `infra/evidencias/03-alertas.log`, `05-stress.txt` |
| Monitoramento como serviço tolerante a falhas | 1 | `infra/vm/03-monitor.sh`, `infra/vm/config/units/ampara-monitor.service` (`Restart=always`, `WatchdogSec=60`) e `infra/vm/teste-falha.sh` | `infra/evidencias/04-teste-falha.txt` |
| Logs de auditoria e de execução | 1 | `infra/vm/04-auditoria.sh`, `infra/vm/config/auditd-ampara.rules`, `infra/vm/lib.sh` (log de execução), `infra/vm/config/logrotate-ampara` | `infra/evidencias/02-execucao.log`, `06-auditd.txt` |
| Funcionamento completo | 2 | `infra/vm/verifica-vm.sh` (a rubrica em asserções) e o vídeo | `infra/evidencias/01-verifica-vm.txt`, `09-cloud-init-output.log` |

`bash infra/vm/verifica-vm.sh --lista` imprime os seis critérios e os pontos (soma 10).

## O que roda na VM

- Serviços: `postgresql`, `ampara-migrations` (migrations da API e da Ponte), `ampara-api` (porta 5080), `ampara-ponte` (porta 8000), `nginx` (porta 80) e `ampara-monitor`. A ordem é PostgreSQL, migrations, API, Ponte, nginx.
- Rotas do nginx: `/` (página de emergência), `/painel-risco/` (painel Risco Cidadão), `/policia` (painel da Ponte, com `X-Forwarded-Prefix /ponte`), `/api/` e `/hubs/` (API), `/ponte/` (Ponte) e `/health`.
- Configuração: `/etc/ampara/vm.conf` (rede), `/etc/ampara/monitor.conf` (limites do monitor), `/etc/ampara/ampara.env` (variáveis da aplicação, modo 0640, segredos gerados na VM e nunca versionados).
- Logs: `/var/log/ampara/execucao.log` (início, fim e código de cada script), `provisiona.log`, `alertas.log` (alertas do monitor) e o journald (`journalctl -t ampara-monitor`). Um `logrotate` limita o tamanho.
- Auditoria: `auditd` vigia `/etc/ampara`, os scripts e o `sudo` (chaves `ampara_config`, `ampara_scripts`, `ampara_sudo`). Exemplo: `sudo ausearch -k ampara_config -i`.

## Testes de falha e de carga

- `sudo bash /opt/ampara/src/infra/vm/stress.sh todos 40`: cria carga de CPU, memória e disco com `stress-ng` e `fallocate` e confere que cada alerta apareceu em `alertas.log`.
- `sudo bash /opt/ampara/src/infra/vm/teste-falha.sh todos`: mata a API e o monitor com `SIGKILL` e confere que o systemd os reinicia e que o monitor registra `SERVICO_INATIVO`, `SERVICO_RECUPERADO` e `MONITOR_INICIADO`; bloqueia a saída 1883 (MQTT) e confere que a API continua de pé como `degradado`.
- Testes locais dos scripts (sem VM): `bash infra/tests/rodar-todos.sh` roda o `shellcheck` e os testes de unidade do monitor, do log de execução, do healthcheck, do estresse, do `verifica-vm.sh` e do `Criar-Vm.ps1`.

## Limitações

- O broker MQTT é público (`broker.hivemq.com`); sem ele a API sobe como `degradado` e o monitor alerta `MQTT`.
- `AMPARA_DEMO=true` só vale nesta VM de demonstração; os dados são sintéticos.
- O túnel Cloudflare previsto no plano não foi incluído: a página de emergência é acessada por `http://127.0.0.1:8080/` no computador host.
