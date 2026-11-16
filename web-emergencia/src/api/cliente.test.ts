import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiErro, api, base } from "./cliente";
import { salvarSessao } from "../sessao/sessao";

const resp = (status: number, corpo?: unknown) =>
  new Response(corpo === undefined ? null : JSON.stringify(corpo), { status });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("cliente da API", () => {
  it("base da API: VITE_API_URL e EXPO_PUBLIC_API_URL vazios → /api/v1 na mesma origem; com valor, concatena", async () => {
    vi.stubEnv("VITE_API_URL", "");
    vi.stubEnv("EXPO_PUBLIC_API_URL", "");
    expect(base()).toBe("/api/v1");
    const f = vi.fn().mockResolvedValue(resp(200, []));
    vi.stubGlobal("fetch", f);
    salvarSessao({ token: "tk", expiraEm: new Date(Date.now() + 60_000).toISOString() });
    await api.ocorrencias.listar();
    expect(f.mock.calls[0][0]).toBe("/api/v1/ocorrencias");
    expect((f.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer tk" });

    vi.stubEnv("VITE_API_URL", "http://api.local:5080/");
    expect(base()).toBe("http://api.local:5080/api/v1");
    vi.stubEnv("VITE_API_URL", "");
    vi.stubEnv("EXPO_PUBLIC_API_URL", "http://10.0.2.2:5080");
    expect(base()).toBe("http://10.0.2.2:5080/api/v1");
  });

  it("qualquer 2xx é sucesso: gatilho 201 e 200 devolvem a ocorrenciaId", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(resp(201, { ocorrenciaId: "a" })).mockResolvedValueOnce(resp(200, { ocorrenciaId: "a" })));
    expect(await api.ocorrencias.gatilho("web")).toEqual({ ocorrenciaId: "a" });
    expect(await api.ocorrencias.gatilho("web")).toEqual({ ocorrenciaId: "a" });
  });

  it("204 devolve undefined; erro vira ApiErro com status e detalheCidadao", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(resp(204)).mockResolvedValueOnce(resp(409, { detalheCidadao: "Frase." })));
    expect(await api.ocorrencias.momento("x", { em: "2026-01-01T00:00:00Z", lat: 1, lng: 2 })).toBeUndefined();
    await expect(api.ocorrencias.listar()).rejects.toMatchObject({ status: 409, detalheCidadao: "Frase." });
  });

  it("401 limpa a sessão e vira ApiErro 401", async () => {
    salvarSessao({ token: "tk", expiraEm: new Date(Date.now() + 60_000).toISOString() });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resp(401)));
    const e = await api.ocorrencias.listar().catch((x) => x);
    expect(e).toBeInstanceOf(ApiErro);
    expect(e.status).toBe(401);
    expect(sessionStorage.length).toBe(0);
  });

  it("falha de rede vira ApiErro status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("net")));
    await expect(api.ocorrencias.listar()).rejects.toMatchObject({ status: 0 });
  });
});
