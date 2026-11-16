import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiErro, api } from "../api/cliente";
import { Login } from "./Login";

afterEach(() => vi.restoreAllMocks());

async function preencherEEnviar(aoEntrar = vi.fn()) {
  const u = userEvent.setup();
  render(<Login aoEntrar={aoEntrar} />);
  await u.type(screen.getByLabelText("E-mail"), "ana@exemplo.test");
  await u.type(screen.getByLabelText("Código de emergência"), "123456");
  await u.type(screen.getByLabelText("Palavra secreta"), "girassol");
  await u.click(screen.getByRole("button", { name: "Entrar" }));
  return aoEntrar;
}

describe("Login de emergência", () => {
  it("campos com label; código com inputMode numeric", () => {
    render(<Login aoEntrar={vi.fn()} />);
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Código de emergência")).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByLabelText("Palavra secreta")).toHaveAttribute("type", "password");
  });

  it("429 → mensagem de espera de 15 minutos", async () => {
    vi.spyOn(api, "autenticar").mockRejectedValue(new ApiErro(429));
    await preencherEEnviar();
    expect(await screen.findByText("Muitas tentativas erradas. Aguarde 15 minutos e tente de novo.")).toBeInTheDocument();
  });

  it("401 e 404 → a mesma frase 'Dados incorretos.'", async () => {
    const espiao = vi.spyOn(api, "autenticar").mockRejectedValue(new ApiErro(401));
    await preencherEEnviar();
    expect(await screen.findByText("Dados incorretos.")).toBeInTheDocument();
    espiao.mockRejectedValue(new ApiErro(404));
    cleanup();
    await preencherEEnviar();
    expect(await screen.findByText("Dados incorretos.")).toBeInTheDocument();
  });

  it("sucesso grava a sessão só na aba e avisa o app", async () => {
    vi.spyOn(api, "autenticar").mockResolvedValue({ token: "tk", expiraEm: new Date(Date.now() + 1_800_000).toISOString() });
    const aoEntrar = await preencherEEnviar();
    await waitFor(() => expect(aoEntrar).toHaveBeenCalled());
    expect(sessionStorage.getItem("ampara.emergencia")).toContain("tk");
    expect(localStorage.length).toBe(0);
  });

  it("mostra o aviso recebido (sessão vencida)", () => {
    render(<Login aoEntrar={vi.fn()} aviso="Sua sessão de emergência acabou (30 minutos). Entre de novo." />);
    expect(screen.getByText("Sua sessão de emergência acabou (30 minutos). Entre de novo.")).toBeInTheDocument();
  });

  it("item 16: 422 ou 403 com detalheCidadao mostra a frase da API, não 'Confira a conexão'", async () => {
    vi.spyOn(api, "autenticar").mockRejectedValue(new ApiErro(422, "O código de emergência tem 6 números."));
    await preencherEEnviar();
    expect(await screen.findByText("O código de emergência tem 6 números.")).toBeInTheDocument();
    expect(screen.queryByText(/Confira a conexão/)).not.toBeInTheDocument();
  });

  it("item 16: 4xx sem detalhe não culpa a conexão; só a falha de rede (status 0) fala em conexão", async () => {
    vi.spyOn(api, "autenticar").mockRejectedValue(new ApiErro(403));
    await preencherEEnviar();
    expect(await screen.findByText("Não foi possível entrar com esses dados. Tente de novo.")).toBeInTheDocument();
    cleanup();
    vi.spyOn(api, "autenticar").mockRejectedValue(new ApiErro(0));
    await preencherEEnviar();
    expect(await screen.findByText("Não foi possível entrar agora. Confira a conexão e tente de novo.")).toBeInTheDocument();
  });
});
