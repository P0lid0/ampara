import { expect, test } from "vitest";
import { horaEmBrasilia, tempoRelativo } from "./rotulos";

const base = Date.parse("2026-11-16T18:00:00Z");
test.each([
  ["2026-11-16T17:59:50Z", "agora"],
  ["2026-11-16T17:56:00Z", "há 4 min"],
  ["2026-11-16T15:00:00Z", "há 3 h"],
  ["2026-11-15T18:00:00Z", "há 1 dia"],
  ["2026-11-13T18:00:00Z", "há 3 dias"],
])("tempoRelativo(%s) = %s", (em, esperado) => {
  expect(tempoRelativo(em, base)).toBe(esperado);
});
test("horaEmBrasilia usa o fuso de Brasília (UTC-3)", () => {
  expect(horaEmBrasilia(Date.parse("2026-11-16T02:30:00Z"))).toBe(23);
  expect(horaEmBrasilia(Date.parse("2026-11-16T03:00:00Z"))).toBe(0);
});
