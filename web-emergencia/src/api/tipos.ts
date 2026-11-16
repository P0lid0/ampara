// CONTRATO rodada 2 (mesmos tipos do app, Task 3). Datas ISO-8601 UTC com Z.
export type Token = { token: string; expiraEm: string };
export type Passo = "Banco" | "CelularSeguro" | "Operadora" | "Senhas" | "Bo";
export type EstadoOcorrencia = "Aberta" | "Cancelada" | "Encerrada";

export type OcorrenciaDto = {
  id: string;
  estado: EstadoOcorrencia;
  origem: string;
  iniciadaEm: string;
  momento: { em: string; lat: number; lng: number } | null;
  passos: { passo: Passo; concluidoEm: string | null }[];
  alertas: { alertaId: string; guardiaoId: string; enviadoEm: string; cienteEm: string | null }[];
  contas: { nome: string; tipo: string; telefone: string | null; link: string }[];
};

export type PontoRota = { lat: number; lng: number; em: string };
export type BoDto = {
  texto: string;
  delegacia: { nome: string; endereco: string; lat: number; lng: number };
  linkDelegaciaEletronica: string;
};
export type GatilhoResposta = { ocorrenciaId: string };
export type CompartilharResposta = { protocolo: string };
