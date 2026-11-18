# Roteiro do vídeo de Operating Systems (até 7 minutos)

Total previsto: 6:45. Vídeo mudo com legendas na tela, ou com narração gravada por cima. Os horários são o começo de cada cena.

| Tempo | Mostrar | Rubrica |
|---|---|---|
| 0:00 a 0:30 | O que é o Ampara e o que a VM sustenta; abrir o README com a tabela rubrica, script e evidência | contexto |
| 0:30 a 1:15 | Windows: `Criar-Vm.ps1 -Acao Subir` (linha do QEMU com WHPX, seed por HTTP, `hostfwd`) | provisionamento automático |
| 1:15 a 3:00 | Primeiro boot: `tail -f provisiona.log` (trecho acelerado); abrir `01-infra.sh` (hostname, netplan, ufw) e `02-app.sh` (dependências, variáveis, build, units com `After=`/`Requires=`, healthcheck) | infra 2 e app 2 |
| 3:00 a 3:45 | `verifica-vm.sh` terminando em `PONTOS: 10/10`; `execucao.log` com `INICIO` e `FIM` de cada script | logs 1 e completo |
| 3:45 a 4:30 | Navegador: `http://127.0.0.1:8080/`, `/painel-risco/`, `/policia`; `curl /health` com `db:true` | completo 2 |
| 4:30 a 5:15 | `stress.sh todos 40` com `tail -f alertas.log` e `journalctl -t ampara-monitor -f`; mostrar `monitor.conf` (80, 80 e 85) | monitor 2 |
| 5:15 a 6:00 | `teste-falha.sh api` e `monitor`: `kill -9`, o systemd reinicia, o monitor registra `SERVICO_INATIVO`, `SERVICO_RECUPERADO` e `MONITOR_INICIADO`; mostrar `Restart=always` e `WatchdogSec=60` | tolerante 1 |
| 6:00 a 6:45 | `ausearch -k ampara_config -i` depois de editar `/etc/ampara`; `auditctl -l`; fechamento (repositório, evidências, equipe CitizenTech) | logs 1 |
