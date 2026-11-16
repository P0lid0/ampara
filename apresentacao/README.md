# Apresentação do Ampara

Página estática para apresentar o sistema na banca, na marca do app (petróleo, esmeralda, areia, Manrope; o vermelho só existe no alarme).

A espinha é o relógio dos 90 minutos depois do roubo. Logo depois do herói vem **"Simular o alarme"**: o visitante aperta o botão do chaveiro e vê o alarme do guardião com contagem de 60 s, a escada de até 3 guardiões, o "Estou ciente" e o passo a passo carimbado com a hora. Sem JavaScript, a seção mostra o print real do alarme.

## Como rodar

```bash
py -3 -m http.server 5180 --bind 127.0.0.1 -d apresentacao
```

Abra http://127.0.0.1:5180. Tudo é local (fontes, fotos e telas); a página funciona offline.

- `?apresentador` deixa a barra de serviços locais fixa no pé da página e liga atalhos: `A` aperta o chaveiro, `E` marca "Estou ciente".
- A faixa "Serviços locais" no rodapé consulta `/health` da API (5080) e da Ponte Polícia (8000) e o painel (5174). Sem eles ela mostra "sem resposta" e o resto funciona.
- Para a demonstração completa suba antes a API (`AMPARA_DEMO=true`), a Ponte e o painel (README de `api/`, `ponte-policia/` e `web-painel-risco/`). Para o farol voltar ao verde: `bash cyber/scripts/zerar-demo.sh`.

## Mídia

`py -3 apresentacao/scripts/preparar-midia.py` (da raiz do repositório) converte o Manrope do app em `fonts/*.woff2` e recorta os prints reais de `app/docs/prints` (e o do mapa de `app/docs/design/antes`) para `img/app-*.webp`. Rode de novo quando os prints do app forem refeitos. `img/web-rota.webp` vem de `web-emergencia/docs/design/` (usa `depois/` se existir).

A foto de Pinheiros vem de acervo aberto; crédito e licença em `img/credits.json` e no rodapé.

## Verificação

```bash
node --test apresentacao/tests/contraste.test.mjs   # pares de texto >= 4,5:1 (3:1 só para texto grande)
```

Antes e depois da refação de 16/11 em `docs/design/` (`revisao.md` é a revisão de partida; `critica.md` é a crítica final).
