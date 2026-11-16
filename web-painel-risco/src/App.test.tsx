import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "./App";
import * as api from "./api";

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

test("login guarda o token no sessionStorage e mostra a visão do cidadão", async () => {
  vi.spyOn(api, "login").mockResolvedValue("tok");
  vi.spyOn(api, "meuRisco").mockResolvedValue({ indice: 5, farol: "verde", eventos: [] });
  render(<App />);
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "pessoa@exemplo.test" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "x" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Entrar" })); });
  expect(await screen.findByRole("status")).toHaveTextContent("5/100");
  expect(sessionStorage.getItem("ampara.painel.token")).toBe("tok");
});

test("sessionStorage indisponível não derruba o login", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
  vi.spyOn(api, "login").mockResolvedValue("tok");
  vi.spyOn(api, "meuRisco").mockResolvedValue({ indice: 5, farol: "verde", eventos: [] });
  render(<App />);
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "pessoa@exemplo.test" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "x" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Entrar" })); });
  expect(await screen.findByRole("status")).toHaveTextContent("5/100");
});

test("401 no meu-risco limpa o token e volta ao login com aviso", async () => {
  sessionStorage.setItem("ampara.painel.token", "velho");
  vi.spyOn(api, "meuRisco").mockRejectedValue(new api.NaoAutorizado());
  render(<App />);
  const aviso = await screen.findByText(/Sua sessão terminou/);
  expect(aviso.closest("[aria-live='polite']")).not.toBeNull();   // anunciado pelo leitor de tela
  expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
  expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  expect(sessionStorage.getItem("ampara.painel.token")).toBeNull();
});

test("abas Meu risco / Visão executiva trocam o conteúdo e o simulador fica na aba do cidadão", async () => {
  sessionStorage.setItem("ampara.painel.token", "tok");
  vi.spyOn(api, "meuRisco").mockResolvedValue({ indice: 5, farol: "verde", eventos: [] });
  vi.spyOn(api, "executivo").mockResolvedValue({ porClasse: {}, porSink: {}, porHora: Array(24).fill(0), total24h: 0 });
  render(<App />);
  expect(await screen.findByRole("tablist")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Meu risco" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("button", { name: "Acesso indevido" })).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole("tab", { name: "Visão executiva" })); });
  expect(await screen.findByText(/0 eventos nas últimas 24 h/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Acesso indevido" })).toBeNull();
});

test("simular atualiza o meu-risco na hora", async () => {
  sessionStorage.setItem("ampara.painel.token", "tok");
  const meu = vi.spyOn(api, "meuRisco").mockResolvedValue({ indice: 5, farol: "verde", eventos: [] });
  vi.spyOn(api, "simular").mockResolvedValue(undefined);
  render(<App />);
  await screen.findByText("Seus dados nas últimas 24 horas");
  await act(async () => {});
  const antes = meu.mock.calls.length;
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Acesso indevido" })); });
  expect(meu.mock.calls.length).toBeGreaterThan(antes);
});

test("cabeçalho tem a marca e Sair; Sair limpa o token e volta ao login", async () => {
  sessionStorage.setItem("ampara.painel.token", "tok");
  vi.spyOn(api, "meuRisco").mockResolvedValue({ indice: 5, farol: "verde", eventos: [] });
  render(<App />);
  expect(screen.getByRole("banner")).toHaveTextContent("Ampara");
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sair" })); });
  expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  expect(screen.getByText("Você saiu do painel.")).toBeInTheDocument();
  expect(sessionStorage.getItem("ampara.painel.token")).toBeNull();
});

test("login: mostrar senha alterna o tipo do campo", () => {
  render(<App />);
  const campo = screen.getByLabelText("Senha");
  expect(campo).toHaveAttribute("type", "password");
  fireEvent.click(screen.getByRole("button", { name: "Mostrar" }));
  expect(campo).toHaveAttribute("type", "text");
  expect(screen.getByRole("button", { name: "Ocultar" })).toBeInTheDocument();
});
