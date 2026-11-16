import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErro, api } from "../api/cliente";
import type { OcorrenciaDto } from "../api/tipos";
import { salvarSessao } from "../sessao/sessao";
import { App } from "../App";
import { Painel } from "./Painel";

const oc = (id: string, estado: OcorrenciaDto["estado"]): OcorrenciaDto => ({
  id, estado, origem: "web", iniciadaEm: "2026-11-14T15:00:00Z", momento: null, passos: [], alertas: [], contas: [],
});

beforeEach(() => {
  vi.spyOn(api.ocorrencias, "listar").mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe("Painel", () => {
  it("'Preciso de ajuda agora' pede confirmação antes de chamar gatilho({origem:'web'})", async () => {
    const gatilho = vi.spyOn(api.ocorrencias, "gatilho").mockResolvedValue({ ocorrenciaId: "o1" });
    const u = userEvent.setup();
    render(<Painel aoSair={vi.fn()} aoSessaoVencida={vi.fn()} aoMarcar={vi.fn()} />);
    await u.click(screen.getByRole("button", { name: "Preciso de ajuda agora" }));
    expect(screen.getByText("Avisar meus guardiões agora?")).toBeInTheDocument();
    expect(gatilho).not.toHaveBeenCalled();
    await u.click(screen.getByRole("button", { name: "Sim, avisar" }));
    expect(gatilho).toHaveBeenCalledWith("web");
  });

  it("'Não' na confirmação não dispara nada", async () => {
    const gatilho = vi.spyOn(api.ocorrencias, "gatilho");
    const u = userEvent.setup();
    render(<Painel aoSair={vi.fn()} aoSessaoVencida={vi.fn()} aoMarcar={vi.fn()} />);
    await u.click(screen.getByRole("button", { name: "Preciso de ajuda agora" }));
    await u.click(screen.getByRole("button", { name: "Não" }));
    expect(gatilho).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Preciso de ajuda agora" })).toBeInTheDocument();
  });

  it("depois do gatilho mostra 'Seus guardiões foram avisados.' com a hora e o botão 'Marcar onde foi roubado'", async () => {
    vi.spyOn(api.ocorrencias, "gatilho").mockResolvedValue({ ocorrenciaId: "o1" });
    const aoMarcar = vi.fn();
    const u = userEvent.setup();
    render(<Painel aoSair={vi.fn()} aoSessaoVencida={vi.fn()} aoMarcar={aoMarcar} agora={() => new Date("2026-11-14T15:30:00Z")} />);
    await u.click(screen.getByRole("button", { name: "Preciso de ajuda agora" }));
    await u.click(screen.getByRole("button", { name: "Sim, avisar" }));
    expect(await screen.findByText(/Seus guardiões foram avisados\./)).toBeInTheDocument();
    expect(screen.getByText(/12:30/)).toBeInTheDocument(); // America/Sao_Paulo
    await u.click(screen.getByRole("button", { name: "Marcar onde foi roubado" }));
    expect(aoMarcar).toHaveBeenCalledWith("o1");
  });

  it("gatilho que devolve a id de uma ocorrência já aberta usa essa id, sem criar segunda (o 200 em si é provado em cliente.test)", async () => {
    // O cliente trata qualquer 2xx como sucesso; aqui a API devolve a id da ocorrência que já existia.
    const gatilho = vi.spyOn(api.ocorrencias, "gatilho").mockResolvedValue({ ocorrenciaId: "ja-aberta" });
    const aoMarcar = vi.fn();
    const u = userEvent.setup();
    render(<Painel aoSair={vi.fn()} aoSessaoVencida={vi.fn()} aoMarcar={aoMarcar} />);
    await u.click(screen.getByRole("button", { name: "Preciso de ajuda agora" }));
    await u.click(screen.getByRole("button", { name: "Sim, avisar" }));
    expect(await screen.findByText(/Seus guardiões foram avisados\./)).toBeInTheDocument();
    expect(gatilho).toHaveBeenCalledTimes(1);
    await u.click(screen.getByRole("button", { name: "Marcar onde foi roubado" }));
    expect(aoMarcar).toHaveBeenCalledWith("ja-aberta");
  });

  it("lista de ocorrências mostra o estado em texto: Aberta, Cancelada ou Encerrada", async () => {
    vi.spyOn(api.ocorrencias, "listar").mockResolvedValue([oc("a", "Aberta"), oc("b", "Cancelada"), oc("c", "Encerrada")]);
    render(<Painel aoSair={vi.fn()} aoSessaoVencida={vi.fn()} aoMarcar={vi.fn()} />);
    expect(await screen.findByText("Aberta")).toBeInTheDocument();
    expect(screen.getByText("Cancelada")).toBeInTheDocument();
    expect(screen.getByText("Encerrada")).toBeInTheDocument();
  });

  it("falha ao listar (não 401) mostra erro e 'Tentar de novo', não 'Nenhuma ocorrência ainda.'", async () => {
    const listar = vi.spyOn(api.ocorrencias, "listar").mockRejectedValueOnce(new ApiErro(500));
    const u = userEvent.setup();
    render(<Painel aoSair={vi.fn()} aoSessaoVencida={vi.fn()} aoMarcar={vi.fn()} />);
    expect(await screen.findByText("Não foi possível carregar suas ocorrências. Tente de novo.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma ocorrência ainda.")).not.toBeInTheDocument();
    listar.mockResolvedValue([oc("a", "Aberta")]);
    await u.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Aberta")).toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível carregar/)).not.toBeInTheDocument();
  });

  it("falha de rede ao listar também não vira lista vazia", async () => {
    vi.spyOn(api.ocorrencias, "listar").mockRejectedValue(new ApiErro(0));
    render(<Painel aoSair={vi.fn()} aoSessaoVencida={vi.fn()} aoMarcar={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma ocorrência ainda.")).not.toBeInTheDocument();
  });

  it("falha do gatilho (não 401) mostra frase e permite tentar de novo", async () => {
    vi.spyOn(api.ocorrencias, "gatilho").mockRejectedValue(new ApiErro(500));
    const u = userEvent.setup();
    render(<Painel aoSair={vi.fn()} aoSessaoVencida={vi.fn()} aoMarcar={vi.fn()} />);
    await u.click(screen.getByRole("button", { name: "Preciso de ajuda agora" }));
    await u.click(screen.getByRole("button", { name: "Sim, avisar" }));
    expect(await screen.findByText(/Não foi possível avisar/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preciso de ajuda agora" })).toBeInTheDocument();
  });
});

describe("Painel: frase da API (item 16)", () => {
  it("falha do gatilho com detalheCidadao mostra a frase da API", async () => {
    vi.spyOn(api.ocorrencias, "gatilho").mockRejectedValue(new ApiErro(502, "Não conseguimos falar com seus guardiões agora. Ligue para eles."));
    const u = userEvent.setup();
    render(<Painel aoSair={vi.fn()} aoSessaoVencida={vi.fn()} aoMarcar={vi.fn()} />);
    await u.click(screen.getByRole("button", { name: "Preciso de ajuda agora" }));
    await u.click(screen.getByRole("button", { name: "Sim, avisar" }));
    expect(await screen.findByText("Não conseguimos falar com seus guardiões agora. Ligue para eles.")).toBeInTheDocument();
  });

  it("falha ao listar com detalheCidadao mostra a frase da API", async () => {
    vi.spyOn(api.ocorrencias, "listar").mockRejectedValue(new ApiErro(503, "Serviço em manutenção. Tente em alguns minutos."));
    render(<Painel aoSair={vi.fn()} aoSessaoVencida={vi.fn()} aoMarcar={vi.fn()} />);
    expect(await screen.findByText("Serviço em manutenção. Tente em alguns minutos.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});

describe("App (sessão)", () => {
  const sessaoValida = () => salvarSessao({ token: "tk", expiraEm: new Date(Date.now() + 1_800_000).toISOString() });

  it("sem sessão mostra o login; com sessão mostra o painel e o botão de sair sempre visível", async () => {
    const { unmount } = render(<App />);
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    unmount();
    sessaoValida();
    render(<App />);
    expect(await screen.findByRole("button", { name: "Preciso de ajuda agora" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair e apagar tudo desta aba" })).toBeInTheDocument();
  });

  it("RF1: sair() limpa a sessão e o painel volta ao login", async () => {
    sessaoValida();
    const u = userEvent.setup();
    render(<App />);
    await u.click(await screen.findByRole("button", { name: "Sair e apagar tudo desta aba" }));
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(sessionStorage.length).toBe(0);
  });

  it("RF1: sessão vencida durante o uso (401) volta ao login com a mensagem de 30 minutos", async () => {
    sessaoValida();
    vi.spyOn(api.ocorrencias, "listar").mockRejectedValue(new ApiErro(401));
    render(<App />);
    expect(await screen.findByText("Sua sessão de emergência acabou (30 minutos). Entre de novo.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("E-mail")).toBeInTheDocument());
  });

  it("marcar onde foi roubado leva à tela de rota e dá para voltar", async () => {
    sessaoValida();
    vi.spyOn(api.ocorrencias, "gatilho").mockResolvedValue({ ocorrenciaId: "o1" });
    const u = userEvent.setup();
    render(<App />);
    await u.click(await screen.findByRole("button", { name: "Preciso de ajuda agora" }));
    await u.click(screen.getByRole("button", { name: "Sim, avisar" }));
    await u.click(await screen.findByRole("button", { name: "Marcar onde foi roubado" }));
    expect(screen.getByRole("heading", { name: "Onde foi roubado" })).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByRole("button", { name: "Preciso de ajuda agora" })).toBeInTheDocument();
  });
});
