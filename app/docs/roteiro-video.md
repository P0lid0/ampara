# Roteiro do vídeo de Mobile (até 3 minutos)

Total previsto: 2:55 (175 s). Grave a tela dos dois emuladores lado a lado: `guardiao_vitima` à esquerda e `guardiao_guardiao` à direita. Na cena do Wokwi e da página de emergência, abra o navegador ao lado. Use só a conta sintética da demonstração (nome com "SINTETICO", IMEI de teste `490154203237518`).

| Início | Duração | Cena | O que aparece | O que dizer (resumo) |
|---|---|---|---|---|
| 0:00 | 15 s | Problema e nome | Tela de entrada do app | "Quando levam o celular, a vítima fica até 90 minutos sem aparelho, e é aí que entram no banco. O Ampara avisa quem pode agir na hora." |
| 0:15 | 30 s | Onboarding com IMEI | Erro de Luhn com um dígito trocado, leitura pela câmera, IMEI digitado aceito | "O app guarda o que você não lembraria na hora. O IMEI é conferido pelo dígito verificador, pela câmera ou digitado." |
| 0:45 | 20 s | Guardião e chaveiro | Convite por QR aceito no outro emulador; chaveiro pareado com status | "A vítima convida um guardião por QR e pareia o chaveiro." |
| 1:05 | 35 s | Alarme | Clique no botão do Wokwi; alarme em tela cheia no guardião em até 3 s; "Estou ciente"; passo a passo com horário de cada bloqueio | "Um clique no chaveiro dispara um alarme insistente no guardião, que segue o passo a passo: banco, operadora, IMEI." |
| 1:40 | 30 s | Rota, página de emergência e BO | Linha do tempo da rota; no navegador, login de emergência, "Foi aqui que me roubaram", BO com Copiar texto e Enviar à polícia; protocolo | "De outro aparelho, a vítima marca onde foi roubada e o Ampara gera o BO com o IMEI." |
| 2:10 | 20 s | Mapa de risco e relato | Mapa com legenda de 3 níveis e "Sem dado"; relato com o aviso de não descrever pessoas | "O mapa mostra o risco previsto pelo modelo treinado com dados da SSP e relatos das últimas 2 horas." |
| 2:30 | 15 s | Acessibilidade e modo demonstração | TalkBack lendo um botão; fonte do sistema no máximo; modo demonstração com a internet desligada | "Fonte grande, leitor de tela e alvos de 48 dp. Sem internet, o modo demonstração mostra o fluxo inteiro." |
| 2:45 | 10 s | Fechamento | Tela Início | "O Ampara não bloqueia o celular: avisa quem pode bloquear contas e linha. Medimos os minutos até o primeiro bloqueio." |

Fim: 2:55.

## Antes de gravar

- API no ar (`http://10.0.2.2:5080` vista do emulador) e página de emergência em `http://localhost:5173`.
- Permissão de tela cheia liberada no guardião (Android 14: Configurações > Apps > Ampara > Notificações em tela cheia).
- Confira a frase de orientação do BO ("guarde o protocolo e pergunte à delegacia").
- Nada de dado real na tela: nomes, e-mails e telefones sintéticos.
