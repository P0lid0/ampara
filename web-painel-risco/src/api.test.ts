import { afterEach, expect, test, vi } from "vitest";
import { FalhaDeRede, NaoAutorizado, login, meuRisco } from "./api";

afterEach(() => vi.unstubAllGlobals());

const resp = (status: number, corpo?: unknown) =>
  new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

test("login envia email e senha e devolve só o token", async () => {
  const f = vi.fn().mockResolvedValue(resp(200, { token: "abc", expiraEm: "2026-11-15T00:00:00Z" }));
  vi.stubGlobal("fetch", f);
  expect(await login("a@b.com", "x")).toBe("abc");
  expect(f).toHaveBeenCalledWith("/api/v1/auth/login", expect.objectContaining({ method: "POST", body: JSON.stringify({ email: "a@b.com", senha: "x" }) }));
});

test("login com credencial recusada vira NaoAutorizado", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resp(401, {})));
  await expect(login("a@b.com", "x")).rejects.toBeInstanceOf(NaoAutorizado);
});

test("meuRisco manda o Bearer e usa a mesma origem", async () => {
  const f = vi.fn().mockResolvedValue(resp(200, { indice: 0, farol: "verde", eventos: [] }));
  vi.stubGlobal("fetch", f);
  await meuRisco("tok");
  expect(f).toHaveBeenCalledWith("/api/v1/seguranca/meu-risco", { headers: { Authorization: "Bearer tok" } });
});

test("401 vira NaoAutorizado; 500 e rede caída viram FalhaDeRede", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resp(401)));
  await expect(meuRisco("t")).rejects.toBeInstanceOf(NaoAutorizado);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resp(500)));
  await expect(meuRisco("t")).rejects.toBeInstanceOf(FalhaDeRede);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  await expect(meuRisco("t")).rejects.toBeInstanceOf(FalhaDeRede);
});

test("403, 404 e 422 viram erros próprios; simular manda o cenário", async () => {
  const { Proibido, NaoEncontrado, Recusado, executivo, simular } = await import("./api");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resp(403)));
  await expect(executivo("t")).rejects.toBeInstanceOf(Proibido);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resp(404)));
  await expect(simular("t", "acesso-indevido")).rejects.toBeInstanceOf(NaoEncontrado);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resp(422)));
  await expect(simular("t", "x")).rejects.toBeInstanceOf(Recusado);
  const f = vi.fn().mockResolvedValue(resp(202));
  vi.stubGlobal("fetch", f);
  await simular("t", "cpf-no-log");
  expect(f).toHaveBeenCalledWith("/api/v1/seguranca/simular-ataque", expect.objectContaining({ method: "POST", body: JSON.stringify({ cenario: "cpf-no-log" }) }));
});
