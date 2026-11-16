const CLASSES: Record<string, string> = {
  Cpf: "CPF",
  Rg: "RG",
  Imei: "IMEI",
  Telefone: "telefone",
  Email: "e-mail",
  Placa: "placa",
  Senha: "senha",
  Saude: "Saúde",
};
const SINKS: Record<string, string> = {
  Log: "registro do sistema",
  HttpNaoAutenticada: "resposta pública",
  HttpAutenticada: "resposta ao dono logado",
  Erro: "mensagem de erro",
  Ponte: "envio à polícia",
  SignalR: "alerta em tempo real",
  Llm: "assistente de IA",
  Banco: "banco de dados",
};
const DECISOES: Record<string, string> = {
  Bloqueado: "bloqueado",
  Mascarado: "escondido",
  Cifrado: "cifrado",
  Permitido: "permitido",
};

export const rotuloClasse = (c: string) => CLASSES[c] ?? c;
export const rotuloSink = (s: string) => SINKS[s] ?? s;
export const rotuloDecisao = (d: string) => DECISOES[d] ?? d;

/** "há 4 min", "há 3 h", "há 2 dias": a data completa vai no title e nos detalhes. */
export function tempoRelativo(em: string, agora: number = Date.now()): string {
  const min = Math.floor((agora - new Date(em).getTime()) / 60000);
  if (!Number.isFinite(min) || min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

/** Hora cheia (0-23) em Brasília de um instante. */
export function horaEmBrasilia(instante: number): number {
  return Number(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(instante)) % 24;
}
