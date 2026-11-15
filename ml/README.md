# ml: risco de roubo e furto de celular por área, dia e faixa horária (São Paulo)

Projeto Ampara, Global Solution 2026.2 (CitizenTech), disciplina de Machine Learning.

**Pergunta:** dada uma área de cerca de 500 m × 500 m da capital, um dia da semana e uma faixa de 3 horas, qual a classe de risco (baixo, médio, alto) no próximo trimestre?

**Resultado (teste em 2025, sem embaralhar o tempo):** XGBoost com F1 macro de 0,440 e Random Forest (baseline) com F1 macro de 0,466; no treino, 0,680 e 0,566. O XGBoost mostra mais overfitting e o baseline simples é melhor no teste. Detalhes, matriz de confusão e limitações em `RELATORIO_ML.md`.

Dados reais e públicos: SSP-SP, GeoSampa, Open-Meteo e IBGE. O celular entra por proxy (roubo e furto em via pública), porque a planilha da SSP não tem coluna de celular.

## Integrantes

- Pedro Martins (responsável pelo ML)
- Vitor Cesarino Marchese

## Conteúdo

| Caminho | O que é |
|---|---|
| `notebooks/ampara_ml.ipynb` | notebook executado, com saídas |
| `RELATORIO_ML.md` | relatório de 2 páginas |
| `ROTEIRO_VIDEO.md` | roteiro do vídeo de até 5 minutos |
| `dados/README.md` | fontes, links, períodos, datas de acesso e colunas usadas |
| `ampara_ml/` | código (leitura dos dados, grade, features, modelos, exportação) |
| `tests/` | testes automáticos |
| `saida/risco.csv` | saída consumida pela API (versionada) |
| `saida/metricas.json` | métricas dos dois modelos |
| `figuras/` | gráficos do relatório |

## Como rodar

Requer Python 3.13. A partir da pasta `ml/`:

```bash
py -3.13 -m venv .venv
.venv/Scripts/activate            # Windows (Git Bash: source .venv/Scripts/activate)
pip install -r requirements.txt
python -m pytest                  # testes sem rede e sem os dados brutos
python -m pytest -m dados         # testes com os dados reais em disco
python -m nbconvert --to notebook --execute --inplace notebooks/ampara_ml.ipynb
```

Os dados brutos não são versionados. Onde baixar cada fonte, o período e as colunas usadas estão em [`dados/README.md`](dados/README.md); as planilhas da SSP vão para `dados/brutos/ssp/`. A execução do notebook com os dados completos leva dezenas de minutos.

## Semântica do `saida/risco.csv`

- Cabeçalho exato: `area_id,lat,lng,dia_semana,faixa,classe,prob_alto` (UTF-8, vírgula). `dia_semana` de 0 (segunda) a 6 (domingo); `faixa` de 0 (00h-03h) a 7 (21h-24h); `classe` em `baixo`, `medio`, `alto`; `prob_alto` em [0, 1] com 4 casas. `prob_alto` é a probabilidade bruta do modelo para a classe alto e não é calibrada.
- Cobre só as células ativas (com pelo menos 20 ocorrências no treino) × 56 combinações de dia e faixa. Área ausente significa "sem dado" no mapa, não "sem risco".
- Representa o trimestre seguinte ao último trimestre completo dos dados.
- No plano B (resolução por distrito) haveria uma célula por distrito; com os dados reais a resolução escolhida foi a grade de 500 m.
- O arquivo é versionado: a API lê `RISCO_CSV=ml/saida/risco.csv`.

## Entrega

Vídeo: (preencher ao publicar)
Repositório: (preencher ao publicar)
