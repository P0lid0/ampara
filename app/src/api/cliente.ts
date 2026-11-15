import { API_URL } from '../config';

export const MSG_PADRAO = 'Não foi possível concluir agora. Tente de novo.';
const MSG_SEM_REDE = 'Sem conexão com a internet.';
const TIMEOUT_MS = 15000;

export class ApiErro extends Error {
  status: number;
  titulo?: string;
  detalheCidadao?: string;
  constructor(status: number, message: string, titulo?: string, detalheCidadao?: string) {
    super(message);
    this.name = 'ApiErro';
    this.status = status;
    this.titulo = titulo;
    this.detalheCidadao = detalheCidadao;
  }
}

/** Mensagem para o cidadão: o detalhe da API quando houver, senão a padrão. */
export function mensagemDeErro(e: unknown): string {
  return e instanceof ApiErro ? (e.detalheCidadao ?? e.message) : MSG_PADRAO;
}

export type Metodo = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type OpcoesChamada = { metodo?: Metodo; corpo?: unknown; semAuth?: boolean };

let token: string | null = null;
let aoExpirarCb: (() => void) | null = null;

export function definirToken(t: string | null): void {
  token = t;
}

export function aoExpirar(cb: () => void): void {
  aoExpirarCb = cb;
}

async function lerErro(resp: Response): Promise<ApiErro> {
  let titulo: string | undefined;
  let detalheCidadao: string | undefined;
  const tipo = resp.headers.get('content-type') ?? '';
  if (tipo.includes('application/problem+json')) {
    try {
      const p = (await resp.json()) as { title?: unknown; detalheCidadao?: unknown };
      if (typeof p.title === 'string') titulo = p.title;
      if (typeof p.detalheCidadao === 'string' && p.detalheCidadao) detalheCidadao = p.detalheCidadao;
    } catch {
      // corpo inválido: cai na mensagem padrão
    }
  }
  return new ApiErro(resp.status, detalheCidadao ?? MSG_PADRAO, titulo, detalheCidadao ?? MSG_PADRAO);
}

export async function chamar<T>(rota: string, o: OpcoesChamada = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json, application/problem+json' };
  if (o.corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (token && !o.semAuth) headers.Authorization = `Bearer ${token}`;

  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(`${API_URL}/api/v1${rota}`, {
      method: o.metodo ?? 'GET',
      headers,
      body: o.corpo !== undefined ? JSON.stringify(o.corpo) : undefined,
      signal: controle.signal,
    });
  } catch {
    throw new ApiErro(0, MSG_SEM_REDE, undefined, MSG_SEM_REDE);
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const erro = await lerErro(resp);
    if (resp.status === 401 && !rota.startsWith('/auth/')) aoExpirarCb?.();
    throw erro;
  }
  if (resp.status === 204) return undefined as T;
  const texto = await resp.text();
  return (texto ? JSON.parse(texto) : undefined) as T;
}
