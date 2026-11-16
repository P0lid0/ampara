import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Simulador } from "./componentes/Simulador";
import { NaoEncontrado } from "./api";
import * as api from "./api";

afterEach(() => vi.restoreAllMocks());

const casos: [string, string][] = [
  ["Vazar CPF no log", "cpf-no-log"],
  ["Senha na resposta pública", "senha-na-resposta"],
  ["Laudo em erro do sistema", "laudo-no-erro"],
  ["Acesso indevido", "acesso-indevido"],
];

test.each(casos)("o botão %s chama simular com o cenário do contrato", async (nome, cenario) => {
  const simular = vi.spyOn(api, "simular").mockResolvedValue(undefined);
  const fn = vi.fn();
  render(<Simulador token="t" aoSimular={fn} />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: nome })); });
  expect(simular).toHaveBeenCalledWith("t", cenario);
  expect(fn).toHaveBeenCalled();
});

test("404 mostra demonstração desligada e não atualiza o painel", async () => {
  vi.spyOn(api, "simular").mockRejectedValue(new NaoEncontrado());
  const fn = vi.fn();
  render(<Simulador token="t" aoSimular={fn} />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Acesso indevido" })); });
  expect(screen.getByText("Demonstração desligada neste servidor.")).toBeInTheDocument();
  expect(fn).not.toHaveBeenCalled();
});

test("422 e rede caída mostram frase amigável", async () => {
  vi.spyOn(api, "simular").mockRejectedValue(new api.Recusado());
  render(<Simulador token="t" aoSimular={vi.fn()} />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Vazar CPF no log" })); });
  expect(screen.getByText(/Não consegui simular agora/)).toBeInTheDocument();
});

test("botões têm altura mínima de 48 px (classe .botao e regra de button)", async () => {
  const css = (await import("node:fs")).readFileSync("src/estilos.css", "utf-8");
  expect(css).toMatch(/\.botao\s*\{[^}]*min-height:\s*48px/);
  render(<Simulador token="t" aoSimular={vi.fn()} />);
  const botoes = screen.getAllByRole("button");
  expect(botoes).toHaveLength(4);
  botoes.forEach((b) => expect(b).toHaveClass("botao"));
});

test("recolhido por padrão, com a faixa DEMONSTRAÇÃO, e confirma o disparo em texto", async () => {
  vi.spyOn(api, "simular").mockResolvedValue(undefined);
  const { container } = render(<Simulador token="t" aoSimular={vi.fn()} />);
  const detalhes = container.querySelector("details")!;
  expect(detalhes.open).toBe(false);
  expect(screen.getByText("DEMONSTRAÇÃO")).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Acesso indevido" })); });
  expect(screen.getByText(/Disparado: Acesso indevido\. O farol atualiza em instantes\./)).toBeInTheDocument();
});
test("botões do simulador são em contorno, não o primário cheio", () => {
  render(<Simulador token="t" aoSimular={vi.fn()} />);
  screen.getAllByRole("button").forEach((b) => expect(b).toHaveClass("botao-contorno"));
});
