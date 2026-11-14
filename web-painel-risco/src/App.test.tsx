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
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "a@b.com" } });
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
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "a@b.com" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "x" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Entrar" })); });
  expect(await screen.findByRole("status")).toHaveTextContent("5/100");
});

test("401 no meu-risco limpa o token e volta ao login com aviso", async () => {
  sessionStorage.setItem("ampara.painel.token", "velho");
  vi.spyOn(api, "meuRisco").mockRejectedValue(new api.NaoAutorizado());
  render(<App />);
  expect(await screen.findByText(/Sua sessão terminou/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  expect(sessionStorage.getItem("ampara.painel.token")).toBeNull();
});
