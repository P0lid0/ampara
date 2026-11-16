// Respostas mínimas (sintéticas) da API para renderizar as telas nos testes. Nada aqui é dado real.
const AGORA = '2026-11-12T20:41:00Z';

const ocorrencia = {
  id: 'oc-1',
  estado: 'Aberta',
  origem: 'chaveiro',
  iniciadaEm: AGORA,
  momento: { em: AGORA, lat: -23.5614, lng: -46.6559 },
  passos: [
    { passo: 'Banco', concluidoEm: AGORA },
    { passo: 'CelularSeguro', concluidoEm: null },
    { passo: 'Operadora', concluidoEm: null },
    { passo: 'Senhas', concluidoEm: null },
    { passo: 'Bo', concluidoEm: null },
  ],
  alertas: [{ alertaId: 'al-1', guardiaoId: 'g-1', enviadoEm: AGORA, cienteEm: null }],
  contas: [
    { nome: 'Banco Demo', tipo: 'banco', telefone: '4004 0000', link: 'https://banco.exemplo.test' },
    { nome: 'Operadora Demo', tipo: 'operadora', telefone: '*611', link: 'https://operadora.exemplo.test' },
  ],
};

const respostas: Record<string, unknown> = {
  'me.obter': { usuarioId: 'u-1', nome: 'Pessoa Demo', email: 'demo@exemplo.test', consentimentoRota: true, emergenciaConfigurada: true },
  'aparelhos.listar': [{ id: 'ap-1', marca: 'Marca', modelo: 'Modelo', imeiMascarado: '***********7518' }],
  'contas.catalogo': [
    { id: 'c-1', nome: 'Banco Demo', tipo: 'banco', telefone: '4004 0000', link: 'https://banco.exemplo.test', conferidoEm: '2026-11-01' },
    { id: 'c-2', nome: 'Operadora Demo', tipo: 'operadora', telefone: '*611', link: 'https://operadora.exemplo.test', conferidoEm: '2026-11-01' },
  ],
  'contas.listar': [{ id: 'c-1', nome: 'Banco Demo', tipo: 'banco', telefone: '4004 0000', link: 'https://banco.exemplo.test' }],
  'guardioes.listar': [{ guardiaoId: 'g-1', nome: 'Guardiã Demo', ordem: 0 }],
  'guardioes.criarConvite': { codigo: 'ABC123', expiraEm: '2026-11-13T20:41:00Z' },
  'chaveiros.listar': [{ deviceId: 'demo-001', online: true, bateria: 80, vistoEm: AGORA }],
  'rota.obter': [
    { lat: -23.5614, lng: -46.6559, em: '2026-11-12T20:30:00Z' },
    { lat: -23.5620, lng: -46.6570, em: AGORA },
    { lat: -23.5630, lng: -46.6580, em: '2026-11-12T20:50:00Z' },
  ],
  'ocorrencias.listar': [ocorrencia],
  'ocorrencias.obter': ocorrencia,
  'ocorrencias.bo': {
    texto: 'Texto do boletim de ocorrência de demonstração.',
    delegacia: { nome: 'Delegacia Demo', endereco: 'Rua Exemplo, 100', lat: -23.5614, lng: -46.6559 },
    linkDelegaciaEletronica: 'https://delegacia.exemplo.test',
  },
  'ocorrencias.retorno': {
    protocolo: 'PP-2026-000001', status: 'recebida', mensagem: 'Recebemos o seu registro.',
    atualizadoEm: AGORA, boStatus: 'nao_registrado', recuperacao: 'sem_noticia',
  },
  'alertas.ativos': [],
  'relatos.listar': [{ id: 'r-1', tipo: 'roubo', lat: -23.5614, lng: -46.6559, em: AGORA, confirmacoes: 2 }],
  'risco.consultar': [{ areaId: 'g051_026', lat: -23.56825, lng: -46.70015, classe: 'alto', probAlto: 0.8 }],
  'camadas.obter': [],
};

export function respostaMinima(grupo: string, nome: string): unknown {
  return respostas[`${grupo}.${nome}`];
}
