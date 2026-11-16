// Tipos iguais aos corpos do contrato (docs/superpowers/plans/2026-11-14-00-indice-e-contratos.md).
// CONTRATO rodada 2: formatos fechados na seção "Decisões de contrato (rodada 2)". Datas: ISO-8601 UTC com Z.

export type Token = { token: string; expiraEm: string };
export type Passo = 'Banco' | 'CelularSeguro' | 'Operadora' | 'Senhas' | 'Bo';
export type BoStatus = 'nao_registrado' | 'registrado';
export type Recuperacao = 'sem_noticia' | 'localizado' | 'recuperado';

export type MeDto = {
  usuarioId: string;
  nome: string;
  email: string;
  consentimentoRota: boolean;
  emergenciaConfigurada: boolean;
};

// imeiMascarado vem pronto do servidor (ex.: ***********7518); o app nunca monta nem guarda o IMEI.
export type AparelhoDto = { id: string; marca: string; modelo: string; imeiMascarado: string };

// A API serializa Telefone e ConferidoEm como `string?`: o catálogo real tem null na maioria (item 18).
export type ContaCatalogo = {
  id: string;
  nome: string;
  tipo: 'banco' | 'operadora';
  telefone: string | null;
  link: string;
  conferidoEm: string | null;
};
export type ContaDto = { id: string; nome: string; tipo: string; telefone: string | null; link: string };

export type GuardiaoDto = { guardiaoId: string; nome: string; ordem: number };
export type ConviteDto = { codigo: string; expiraEm: string };

export type ChaveiroDto = { deviceId: string; online: boolean; bateria: number | null; vistoEm: string | null };

export type PontoRota = { lat: number; lng: number; precisao: number; em: string };
export type PontoRotaDto = { lat: number; lng: number; em: string };

export type OcorrenciaDto = {
  id: string;
  estado: 'Aberta' | 'Cancelada' | 'Encerrada';
  origem: string;
  iniciadaEm: string;
  momento: { em: string; lat: number; lng: number } | null;
  passos: { passo: Passo; concluidoEm: string | null }[];
  alertas: { alertaId: string; guardiaoId: string; enviadoEm: string; cienteEm: string | null }[];
  contas: { nome: string; tipo: string; telefone: string | null; link: string }[];
};

export type BoDto = {
  texto: string;
  delegacia: { nome: string; endereco: string; lat: number; lng: number };
  linkDelegaciaEletronica: string;
};

export type RetornoDto = {
  protocolo: string;
  status: string;
  mensagem: string;
  atualizadoEm: string;
  boNumero?: string;
  boStatus: BoStatus;
  recuperacao: Recuperacao;
};

export type AlertaDto = { alertaId: string; ocorrenciaId: string; vitimaNome: string; origem: string; em: string };

export type RelatoDto = { id: string; tipo: string; lat: number; lng: number; em: string; confirmacoes: number };
export type RelatoNovo = { tipo: 'roubo' | 'furto' | 'suspeita'; lat: number; lng: number; em: string; texto?: string };

export type Bbox = { minLat: number; minLng: number; maxLat: number; maxLng: number };
export type RiscoDto = { areaId: string; lat: number; lng: number; classe: 'baixo' | 'medio' | 'alto'; probAlto: number };

// P2, público
export type CamadaPontoDto = { nome: string; lat: number; lng: number };
