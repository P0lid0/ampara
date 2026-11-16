import { describe, expect, it } from "vitest";
import { agruparPorDia, formatarHora, pontoMaisProximo } from "./agruparPorDia";

const p = (em: string) => ({ lat: -23.5, lng: -46.6, em });

describe("agruparPorDia", () => {
  it("23:30 em São Paulo (02:30Z do dia seguinte) fica no dia de São Paulo, não no do UTC", () => {
    const r = agruparPorDia([p("2026-11-13T02:30:00Z")]);
    expect(r).toHaveLength(1);
    expect(r[0].dia).toBe("2026-11-12");
  });

  it("pontos fora de ordem saem ordenados; dias do mais novo ao mais antigo", () => {
    const r = agruparPorDia([
      p("2026-11-12T20:00:00Z"),
      p("2026-11-10T15:00:00Z"),
      p("2026-11-12T14:00:00Z"),
      p("2026-11-11T15:00:00Z"),
    ]);
    expect(r.map((d) => d.dia)).toEqual(["2026-11-12", "2026-11-11", "2026-11-10"]);
    expect(r[0].pontos.map((x) => x.em)).toEqual(["2026-11-12T14:00:00Z", "2026-11-12T20:00:00Z"]);
  });

  it("lista vazia dá nenhum dia", () => {
    expect(agruparPorDia([])).toEqual([]);
  });
});

describe("pontoMaisProximo", () => {
  const pts = [p("2026-11-12T20:00:00Z"), p("2026-11-12T20:10:00Z"), p("2026-11-12T20:40:00Z")];
  it("instante exato, entre dois pontos (o mais perto), antes do primeiro (0), lista vazia (-1)", () => {
    expect(pontoMaisProximo(pts, "2026-11-12T20:10:00Z")).toBe(1);
    expect(pontoMaisProximo(pts, "2026-11-12T20:14:00Z")).toBe(1);
    expect(pontoMaisProximo(pts, "2026-11-12T20:30:00Z")).toBe(2);
    expect(pontoMaisProximo(pts, "2026-11-12T10:00:00Z")).toBe(0);
    expect(pontoMaisProximo([], "2026-11-12T10:00:00Z")).toBe(-1);
  });
});

describe("formatarHora", () => {
  it('formatarHora("2026-11-12T20:41:00Z") === "17:41"', () => {
    expect(formatarHora("2026-11-12T20:41:00Z")).toBe("17:41");
  });
});
