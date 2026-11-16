import { describe, expect, it } from "vitest";
import { lerSessao, sair, salvarSessao } from "./sessao";

const daqui = (ms: number) => new Date(Date.now() + ms).toISOString();

describe("sessão de emergência", () => {
  it("RF1: salvarSessao grava só em sessionStorage; localStorage.length === 0", () => {
    salvarSessao({ token: "t", expiraEm: daqui(60_000) });
    expect(sessionStorage.getItem("ampara.emergencia")).not.toBeNull();
    expect(localStorage.length).toBe(0);
    expect(lerSessao()?.token).toBe("t");
  });

  it("RF1: lerSessao devolve null e limpa quando expiraEm já passou", () => {
    salvarSessao({ token: "t", expiraEm: daqui(-1000) });
    expect(lerSessao()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it("lerSessao aceita a hora de referência e descarta conteúdo corrompido", () => {
    salvarSessao({ token: "t", expiraEm: "2030-01-01T00:00:00Z" });
    expect(lerSessao(new Date("2031-01-01T00:00:00Z"))).toBeNull();
    sessionStorage.setItem("ampara.emergencia", "{quebrado");
    expect(lerSessao()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it("sair() limpa a sessão", () => {
    salvarSessao({ token: "t", expiraEm: daqui(60_000) });
    sair();
    expect(lerSessao()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});
