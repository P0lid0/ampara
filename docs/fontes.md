# Fontes

Preencha o link e a data de acesso só depois de abrir a página.

| Fonte | Link | Data de acesso | Usado para |
|---|---|---|---|
| SSP-SP, planilhas anuais de ocorrências | https://www.ssp.sp.gov.br/assets/estatistica/transparencia/spDados/SPDadosCriminais_2025.xlsx (SPDadosCriminais_2025.xlsx, 195899014 bytes, SHA-256 `4ab5b40229d245a0f50b65e74ea9e9b7750bbdb3bff7b02d961d78b9c4143d8c`) | 2026-11-14 | Treino do modelo de risco (ML) |
| SSP-SP, SPSafe | PENDENTE |  | Plano B de dados de ocorrências |
| GeoSampa (WFS) | PENDENTE |  | Camadas do mapa (estações, linhas, distritos) |
| INMET | PENDENTE |  | Variável climática do modelo |
| Open-Meteo | PENDENTE |  | Variável climática do modelo (alternativa) |
| IBGE | PENDENTE |  | População e limites territoriais |
| Banco Central, Olinda | PENDENTE |  | Números do pitch |
| Imprensa sobre os cerca de 24 mil furtos de celular | PENDENTE |  | Contexto do problema |
| Av. do Estado e o caso dos quebra-vidros (314 ocorrências) | PENDENTE |  | Corredor de quebra-vidro |
| Waze | PENDENTE |  | Referência de alertas de trânsito |
| ViaMobilidade (Linha 9-Esmeralda) | PENDENTE |  | Contexto da Linha 9 |

## Catálogo de contas (`api/Ampara.Infrastructure/Dados/catalogo-contas.json`)

Links conferidos em 2026-11-14 abrindo a página oficial: BB, Caixa, Bradesco, Mercado Pago e PicPay por requisição (200/302); Itaú, Santander, C6 Bank e Vivo, que devolvem 403 a leitores automáticos, abertos num navegador real (a página oficial carregou em cada domínio; a Vivo redireciona para vivo.com.br/para-voce). Telefones: só os de Nubank e Inter foram conferidos nas páginas. Só entra telefone com `conferidoEm` quando o número está escrito na página oficial e cabe no formato do seed (8 a 20 caracteres de dígitos, espaço, `+`, `()`, `-`). Entrada sem telefone confirmado fica com `telefone: null` e `conferidoEm: null` (o app mostra só o link). Nenhum número veio de memória.

| Instituição | Link (acessado em 2026-11-14) | Telefone | Observação |
|---|---|---|---|
| Nubank | https://nubank.com.br/contato | 4020 0185 (capitais e regiões metropolitanas) | Conferido na página. A página manda bloquear conta e cartão por app.nubank.com.br/roubo; não traz número de bloqueio |
| Banco Inter | https://inter.co/canais-de-atendimento/ | 3003 4070 (capitais e regiões metropolitanas, 24 h) | Conferido na página |
| Claro | https://www.claro.com.br/atendimento | null | A página traz o código curto 1052 (celular), que não cabe no formato de 8 a 20 caracteres; a página não confirma número específico para perda e roubo |
| TIM | https://www.tim.com.br/sp/para-voce/atendimento | null | A página traz o código *144 (bloqueio de chip a partir de outro aparelho TIM) e 1056 (de telefone fixo); códigos curtos fora do formato; sem número de perda e roubo |
| Banco do Brasil | https://www.bb.com.br/ | null | Página inicial abre (200); a página de atendimento tentada deu 404; telefone não confirmado |
| Caixa | https://www.caixa.gov.br/ | null | Redireciona (302) para o portal; telefone não confirmado |
| Bradesco | https://banco.bradesco/ | null | Página inicial abre (200) sem número legível; telefone não confirmado |
| Mercado Pago | https://www.mercadopago.com.br/ | null | Página inicial abre (200); página de ajuda bloqueou a leitura (403); telefone não confirmado |
| PicPay | https://picpay.com/ | null | Página inicial abre (200); telefone não confirmado |
| Itaú | https://www.itau.com.br/ | null | Link conferido em navegador real em 2026-11-14 (403 a leitores automáticos); telefone não confirmado |
| Santander | https://www.santander.com.br/ | null | Link conferido em navegador real em 2026-11-14 (403 a leitores automáticos); telefone não confirmado |
| C6 Bank | https://www.c6bank.com.br/ | null | Link conferido em navegador real em 2026-11-14 (403 a leitores automáticos); telefone não confirmado |
| Vivo | https://vivo.com.br/ | null | Link conferido em navegador real em 2026-11-14 (403 a leitores automáticos); telefone não confirmado |

Pendência: Pedro conferir à mão, no navegador, os telefones das instituições com `null` (os links já foram conferidos) antes da demonstração e preencher `telefone` e `conferidoEm` no JSON.

## Camadas do mapa: delegacias, estações e PM (GeoSampa)

Gerado por `api/tools/extrair_camadas.py` em 2026-11-14, a partir do WFS público do GeoSampa (Prefeitura de São Paulo, dado aberto; coordenadas pedidas em `srsName=EPSG:4326`, sem conversão). Camadas descobertas pelo `GetCapabilities` (https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/wfs?service=WFS&request=GetCapabilities, acessado em 2026-11-14, 488 camadas em `geoportal`).

| Arquivo (`api/Ampara.Api/Dados/`) | Camada WFS | URL do GetFeature (acessada em 2026-11-14) | Itens |
|---|---|---|---|
| `delegacias.json` | `geoportal:equipamento_policia_civil` | https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=geoportal:equipamento_policia_civil&outputFormat=application/json&srsName=EPSG:4326 | 92 |
| `pm.json` | `geoportal:equipamento_policia_militar` | https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=geoportal:equipamento_policia_militar&outputFormat=application/json&srsName=EPSG:4326 | 158 |
| `estacoes.json` | `geoportal:estacao_metro` + `geoportal:estacao_trem` (só as OPERANDO) | https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=geoportal:estacao_metro&outputFormat=application/json&srsName=EPSG:4326 e a mesma URL com `estacao_trem` | 162 |

Tratamento: só pontos dentro da grade do contrato (`AreaMapa`); delegacia sem endereço fica de fora (o BO não mostra delegacia vazia); nomes e endereços em caixa de título; delegacias levam `endereco` (concatenado com o bairro, quando houver, e "São Paulo/SP"), as outras camadas só `nome`, `lat`, `lng`. A camada `geoportal:delegacia_policia_civil` não serve: é o polígono da área de cada DP, não o ponto da delegacia. O servidor não traz telefone nem horário das delegacias. Pendência: conferir à mão os endereços das delegacias que a demonstração usar (a camada é da Prefeitura e pode estar defasada).
