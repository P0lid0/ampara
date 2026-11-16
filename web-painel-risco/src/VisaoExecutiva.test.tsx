import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { VisaoExecutiva } from "./componentes/VisaoExecutiva";
import { NaoAutorizado, Proibido } from "./api";
import * as api from "./api";
import type { Executivo } from "./tipos";

const dados: Executivo = {
  porClasse: { Cpf: 3, Senha: 1, Rg: 0, Imei: 0, Telefone: 0, Email: 0, Placa: 0, Saude: 0 },
  porSink: { Log: 3, HttpNaoAutenticada: 1, HttpAutenticada: 0, Erro: 0, Ponte: 0, SignalR: 0, Llm: 0, Banco: 0 },
  porHora: [...Array(23).fill(0), 4],
  total24h: 4,
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("executiva mostra total, barras com número e 24 horas", async () => {
  vi.spyOn(api, "executivo").mockResolvedValue(dados);
  render(<VisaoExecutiva token="t" />);
  await act(async () => {});
  expect(screen.getByText(/4 eventos nas últimas 24 h/)).toBeInTheDocument();
  expect(screen.getByText("CPF")).toBeInTheDocument();
  expect(screen.getByText("registro do sistema")).toBeInTheDocument();
  expect(screen.getAllByRole("img", { name: /Há \d+ horas?:/ })).toHaveLength(24);
  expect(screen.getByRole("img", { name: "Há 0 horas: 4 eventos" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Há 1 hora: 0 eventos" })).toBeInTheDocument();
  const linhaCpf = screen.getByText("CPF").closest("li")!;
  expect(linhaCpf).toHaveTextContent("3");
});

test("403 mostra aviso de administrador e para de consultar", async () => {
  const spy = vi.spyOn(api, "executivo").mockRejectedValue(new Proibido());
  render(<VisaoExecutiva token="t" />);
  await act(async () => {});
  expect(screen.getByText("Esta visão é só para administradores.")).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(spy).toHaveBeenCalledTimes(1);
});

test("atualiza a cada 5 s e limpa o intervalo ao desmontar", async () => {
  const spy = vi.spyOn(api, "executivo").mockResolvedValue(dados);
  const { unmount } = render(<VisaoExecutiva token="t" />);
  await act(async () => {});
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(spy).toHaveBeenCalledTimes(2);
  unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
  expect(spy).toHaveBeenCalledTimes(2);
});

test("falha de rede mantém os dados e avisa; 401 chama aoExpirar", async () => {
  const spy = vi.spyOn(api, "executivo").mockResolvedValueOnce(dados).mockRejectedValueOnce(new api.FalhaDeRede());
  const sair = vi.fn();
  render(<VisaoExecutiva token="t" aoExpirar={sair} />);
  await act(async () => {});
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(screen.getByText(/Não consegui atualizar agora/)).toBeInTheDocument();
  expect(screen.getByText(/4 eventos/)).toBeInTheDocument();
  spy.mockRejectedValueOnce(new NaoAutorizado());
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(sair).toHaveBeenCalled();
});

test("barras saem em ordem decrescente, a maior em destaque, e o pico do gráfico tem rótulo", async () => {
  const embaralhado: Executivo = {
    porClasse: { Saude: 3, Cpf: 9, Senha: 6, Rg: 0, Imei: 9, Telefone: 0, Email: 0, Placa: 0 },
    porSink: { Llm: 1, Log: 12, HttpNaoAutenticada: 0, Erro: 0, Banco: 0, Ponte: 0, SignalR: 0, HttpAutenticada: 0 },
    porHora: [...Array(22).fill(0), 2, 9],
    total24h: 21,
  };
  vi.spyOn(api, "executivo").mockResolvedValue(embaralhado);
  const { container } = render(<VisaoExecutiva token="t" />);
  await act(async () => {});
  const lista = container.querySelector(".barras")!;
  const valores = [...lista.querySelectorAll(".barra-numero")].map((n) => Number(n.textContent));
  expect(valores).toEqual([...valores].sort((a, b) => b - a));
  expect(lista.querySelectorAll(".barra-maior")).toHaveLength(1);
  expect(container.querySelector(".hora-valor")).toHaveTextContent("9");
  expect(container.querySelectorAll(".hora-pico")).toHaveLength(1);
  expect(screen.getByText(/9 deles às \d{2}h/)).toBeInTheDocument();
  expect(container.querySelector(".horas-marcas")).toHaveTextContent("agora");
});
test("total zero mostra frase tranquila no lugar da leitura do pico", async () => {
  vi.spyOn(api, "executivo").mockResolvedValue({ porClasse: {}, porSink: {}, porHora: Array(24).fill(0), total24h: 0 });
  const { container } = render(<VisaoExecutiva token="t" />);
  await act(async () => {});
  expect(screen.getByText(/Nenhum evento nas últimas 24 horas/)).toBeInTheDocument();
  expect(container.querySelector(".hora-pico")).toBeNull();
});
