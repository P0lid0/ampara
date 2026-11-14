export type FarolCor = "verde" | "amarelo" | "vermelho";

export interface EventoCidadao {
  id: string;
  em: string;
  classe: string;
  sink: string;
  decisao: string;
  mensagemCidadao: string | null;
}

export interface MeuRisco {
  indice: number;
  farol: FarolCor;
  eventos: EventoCidadao[];
}

export interface Executivo {
  porClasse: Record<string, number>;
  porSink: Record<string, number>;
  porHora: number[];
  total24h: number;
}
