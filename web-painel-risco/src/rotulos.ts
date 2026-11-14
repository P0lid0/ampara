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
