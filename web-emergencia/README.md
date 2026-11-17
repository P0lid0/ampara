# web-emergencia

Página de emergência do Ampara: a vítima, sem o próprio celular, entra por outro aparelho (de um parente, de um amigo, da delegacia) e consegue pedir ajuda, marcar na rota onde foi roubada e gerar o BO com o IMEI. Funciona no navegador do iPhone e do Android, por toque.

## O que ela faz

- **Entrar** com e-mail, código de emergência e palavra secreta. A sessão vale 30 minutos e fica só na aba (`sessionStorage`): fechar a aba ou tocar em "Sair e apagar tudo desta aba" apaga tudo. Nada vai para `localStorage` nem para cookie.
- **Preciso de ajuda agora**: dispara o alarme nos guardiões (mesma ocorrência se já houver uma aberta) e mostra "Seus guardiões foram avisados." com a hora.
- **Linha do tempo da rota** (últimos 7 dias, no mapa Leaflet com tiles do OpenStreetMap): escolher o dia e o horário e tocar em "Foi aqui que me roubaram".
- **BO**: texto gerado pela API com o IMEI, botão "Copiar texto" (com alternativa para o Safari sem HTTPS), link para a Delegacia Eletrônica e "Enviar à polícia" só depois do consentimento, com o protocolo na tela. O texto do BO fica só na memória da tela.
- Erros aparecem com a frase da API (`detalheCidadao`), nunca como "Error 500". Datas no horário de São Paulo.

## Como rodar

Pré-requisitos: Node 24 e a API Ampara no ar em `http://localhost:5080` (veja `api/README.md`).

```bash
cd web-emergencia
npm install
npm run dev        # http://localhost:5173 (o Vite repassa /api e /hubs para a API)
```

Para apontar para outra API (VM ou túnel), defina a URL base sem `/api/v1`:

```bash
VITE_API_URL=https://<url-da-api> npm run dev
```

Build de produção (pasta `dist/`, arquivos estáticos):

```bash
npm run build
```

Servida fora do Vite, a página chama `<VITE_API_URL>/api/v1`; sem `VITE_API_URL`, chama `/api/v1` no mesmo endereço da página (por exemplo, atrás do nginx da VM).

## Testes

```bash
npm test           # vitest: sessão, cliente da API, telas de entrada, painel, rota e BO
npx tsc --noEmit
```

## Limites

- Protótipo acadêmico: a "polícia" que recebe o BO é a Ponte Polícia simulada do projeto.
- O mapa usa os tiles públicos do OpenStreetMap, sujeitos à política de uso deles.

## Integrantes

- Pedro Martins
- Vitor Cesarino Marchese
