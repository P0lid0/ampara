import { lerSessao, sair } from "../sessao/sessao";
import type {
  BoDto,
  CompartilharResposta,
  GatilhoResposta,
  OcorrenciaDto,
  PontoRota,
  Token,
} from "./tipos";

export class ApiErro extends Error {
  status: number;
  detalheCidadao?: string;
  constructor(status: number, detalheCidadao?: string) {
    super(detalheCidadao ?? `HTTP ${status}`);
    this.status = status;
    this.detalheCidadao = detalheCidadao;
  }
}

/** Valor vazio = mesma origem (a VM serve a página em / junto de /api). Lido a cada chamada para os testes trocarem o valor. */
export function base(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return `${(env.VITE_API_URL || env.EXPO_PUBLIC_API_URL || "").replace(/\/+$/, "")}/api/v1`;
}

export async function chamar<T>(rota: string, o: { metodo?: string; corpo?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const sessao = lerSessao();
  if (sessao) headers.Authorization = `Bearer ${sessao.token}`;
  if (o.corpo !== undefined) headers["Content-Type"] = "application/json";

  let r: Response;
  try {
    r = await fetch(`${base()}${rota}`, {
      method: o.metodo ?? (o.corpo !== undefined ? "POST" : "GET"),
      headers,
      body: o.corpo !== undefined ? JSON.stringify(o.corpo) : undefined,
    });
  } catch {
    throw new ApiErro(0);
  }
  if (!r.ok) {
    let detalhe: string | undefined;
    try {
      detalhe = ((await r.json()) as { detalheCidadao?: string | null }).detalheCidadao ?? undefined;
    } catch {
      /* corpo vazio ou não-JSON */
    }
    if (r.status === 401) sair();
    throw new ApiErro(r.status, detalhe);
  }
  if (r.status === 204 || r.status === 202) return undefined as T;
  try {
    return (await r.json()) as T;
  } catch {
    return undefined as T;
  }
}

const id = (x: string) => encodeURIComponent(x);

export const api = {
  autenticar: (b: { email: string; codigo: string; palavraSecreta: string }) =>
    chamar<Token>("/auth/emergencia", { corpo: b }),
  ocorrencias: {
    listar: () => chamar<OcorrenciaDto[]>("/ocorrencias"),
    gatilho: (origem: "web" | "guardiao", vitimaId?: string) =>
      chamar<GatilhoResposta>("/ocorrencias/gatilho", { corpo: { origem, vitimaId } }),
    momento: (ocorrenciaId: string, b: { em: string; lat: number; lng: number }) =>
      chamar<void>(`/ocorrencias/${id(ocorrenciaId)}/momento`, { corpo: b }),
    bo: (ocorrenciaId: string) => chamar<BoDto>(`/ocorrencias/${id(ocorrenciaId)}/bo`),
    compartilhar: (ocorrenciaId: string) =>
      chamar<CompartilharResposta>(`/ocorrencias/${id(ocorrenciaId)}/compartilhar-policia`, {
        corpo: { consentimento: true },
      }),
  },
  rota: (de: string, ate: string) =>
    chamar<PontoRota[]>(`/rota?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`),
};
