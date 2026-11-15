import type { Executivo, MeuRisco } from "./tipos";

/** Sessão expirada ou credencial recusada: o painel volta ao login. */
export class NaoAutorizado extends Error {}
/** Falha de rede ou do servidor: a tela mostra frase amigável e mantém os dados. */
export class FalhaDeRede extends Error {}

/** 403: o papel do usuário não permite a visão (ex.: executiva só para admin). */
export class Proibido extends Error {}
/** 404: recurso desligado neste servidor (ex.: simulador fora do modo demo). */
export class NaoEncontrado extends Error {}
/** 422: o servidor recusou o conteúdo enviado. */
export class Recusado extends Error {}

const BASE = "/api/v1";

async function chamar<T>(caminho: string, init: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${BASE}${caminho}`, init);
  } catch {
    throw new FalhaDeRede();
  }
  if (r.status === 401) throw new NaoAutorizado();
  if (r.status === 403) throw new Proibido();
  if (r.status === 404) throw new NaoEncontrado();
  if (r.status === 422) throw new Recusado();
  if (!r.ok) throw new FalhaDeRede();
  if (r.status === 202 || r.status === 204) return undefined as T;
  try {
    return (await r.json()) as T;
  } catch {
    throw new FalhaDeRede();
  }
}

const auth = (token: string): RequestInit => ({ headers: { Authorization: `Bearer ${token}` } });

export async function login(email: string, senha: string): Promise<string> {
  let r: Response;
  try {
    r = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
  } catch {
    throw new FalhaDeRede();
  }
  if (r.status === 400 || r.status === 401 || r.status === 422) throw new NaoAutorizado();
  if (!r.ok) throw new FalhaDeRede();
  try {
    return ((await r.json()) as { token: string }).token;
  } catch {
    throw new FalhaDeRede();
  }
}

export const meuRisco = (token: string) => chamar<MeuRisco>("/seguranca/meu-risco", auth(token));
export const executivo = (token: string) => chamar<Executivo>("/seguranca/executivo", auth(token));
export const simular = (token: string, cenario: string) =>
  chamar<void>("/seguranca/simular-ataque", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ cenario }),
  });
