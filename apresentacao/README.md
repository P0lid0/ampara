# Apresentação do Ampara

Página para apresentar o sistema na banca: problema, como funciona, o que cada disciplina entregou e atalhos para a demonstração ao vivo.

## Como rodar

```bash
py -3 -m http.server 5180 --bind 127.0.0.1 -d apresentacao
```

Abra http://127.0.0.1:5180. Os indicadores "Serviços locais" consultam `/health` da API (5080) e da Ponte Polícia (8000) e o painel (5174); sem eles a página mostra "fora do ar" e o resto funciona offline (fontes, fotos e telas são locais).

Para a demonstração completa suba antes a API (`AMPARA_DEMO=true`), a Ponte e o painel (ver os README de `api/`, `ponte-policia/` e `web-painel-risco/`). Para o farol voltar ao verde: `bash cyber/scripts/zerar-demo.sh`.

Telas em `img/` são capturas reais do sistema com dados sintéticos. Fotos de São Paulo vêm de acervos abertos; créditos e licenças em `img/credits.json` e no rodapé da página.
