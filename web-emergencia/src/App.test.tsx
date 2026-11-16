import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api/cliente";
import type { BoDto, OcorrenciaDto } from "./api/tipos";
import { salvarSessao } from "./sessao/sessao";
import { App } from "./App";
import { MSG_SESSAO_VENCIDA } from "./telas/Login";

vi.mock("./componentes/Mapa", () => ({
  Mapa: ({ pontos }: { pontos: unknown[] }) => <div data-testid="mapa">{pontos.length} pontos</div>,
}));

// SINTETICO: IMEI e ocorrência de teste.
const TEXTO_BO = "BOLETIM\nIMEI 356938035643809 roubado em 12/11.";
const BO: BoDto = {
  texto: TEXTO_BO,
  delegacia: { nome: "1o DP Demo", endereco: "Rua Exemplo, 100", lat: -23.55, lng: -46.63 },
  linkDelegaciaEletronica: "https://delegacia.exemplo.gov.br/bo",
};
const OC: OcorrenciaDto = {
  id: "o1", estado: "Aberta", origem: "web", iniciadaEm: "2026-11-12T21:00:00Z",
  momento: null, passos: [], alertas: [], contas: [],
};
const PONTOS = [{ lat: -23.55, lng: -46.63, em: "2026-11-12T20:30:00Z" }];

const sessao = (ms: number) => salvarSessao({ token: "tk", expiraEm: new Date(Date.now() + ms).toISOString() });

beforeEach(() => {
  vi.spyOn(api.ocorrencias, "listar").mockResolvedValue([OC]);
  vi.spyOn(api.ocorrencias, "gatilho").mockResolvedValue({ ocorrenciaId: "o1" });
  vi.spyOn(api.ocorrencias, "momento").mockResolvedValue(undefined);
  vi.spyOn(api.ocorrencias, "bo").mockResolvedValue(BO);
  vi.spyOn(api, "rota").mockResolvedValue(PONTOS);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Do painel até a tela do BO, pelo caminho da vítima. */
async function irAteOBo(u: ReturnType<typeof userEvent.setup>) {
  await u.click(await screen.findByRole("button", { name: "Preciso de ajuda agora" }));
  await u.click(screen.getByRole("button", { name: "Sim, avisar" }));
  await u.click(await screen.findByRole("button", { name: "Marcar onde foi roubado" }));
  await u.click(await screen.findByRole("button", { name: "Foi aqui que me roubaram" }));
  await u.click(await screen.findByRole("button", { name: "Gerar o BO" }));
  await screen.findByText(/BOLETIM/, { selector: "pre" });
}

describe("App: fim da sessão de 30 minutos (item 13)", () => {
  it("passado o expiraEm, a tela do BO volta ao login com a mensagem e o texto (com IMEI) sai da tela, sem precisar de clique", async () => {
    sessao(3000);
    const u = userEvent.setup();
    render(<App />);
    await irAteOBo(u);
    await waitFor(() => expect(screen.getByText(MSG_SESSAO_VENCIDA)).toBeInTheDocument(), { timeout: 6000 });
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.queryByText(/356938035643809/)).not.toBeInTheDocument();
    expect(sessionStorage.getItem("ampara.emergencia")).toBeNull();
  }, 15000);

  it("com o relógio congelado em segundo plano, ao voltar para a aba depois do vencimento a tela vai ao login", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    sessao(1_800_000);
    render(<App />);
    expect(screen.getByRole("button", { name: "Preciso de ajuda agora" })).toBeInTheDocument();
    // a aba ficou em segundo plano: o relógio andou, mas o timer não disparou (iOS congela timers)
    vi.setSystemTime(new Date(Date.now() + 1_900_000));
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByText(MSG_SESSAO_VENCIDA)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Preciso de ajuda agora" })).not.toBeInTheDocument();
  });

  it("antes do expiraEm nada muda; no expiraEm volta ao login", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    sessao(1_800_000);
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(1_700_000);
    });
    expect(screen.getByRole("button", { name: "Preciso de ajuda agora" })).toBeInTheDocument();
    expect(screen.queryByText(MSG_SESSAO_VENCIDA)).not.toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(100_001);
    });
    expect(screen.getByText(MSG_SESSAO_VENCIDA)).toBeInTheDocument();
  });
});

describe("App: tela do BO", () => {
  it("item 15: o BO tem 'Sair e apagar tudo desta aba', que volta ao login e apaga a sessão da aba", async () => {
    sessao(1_800_000);
    const u = userEvent.setup();
    render(<App />);
    await irAteOBo(u);
    await u.click(screen.getByRole("button", { name: "Sair e apagar tudo desta aba" }));
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(sessionStorage.getItem("ampara.emergencia")).toBeNull();
    expect(screen.queryByText(/356938035643809/)).not.toBeInTheDocument();
  });

  it("item 14: 'Voltar' no BO volta para a tela da rota, que já mostra o momento marcado e 'Gerar o BO'", async () => {
    sessao(1_800_000);
    const u = userEvent.setup();
    render(<App />);
    await irAteOBo(u);
    vi.mocked(api.ocorrencias.listar).mockResolvedValue([{ ...OC, momento: { em: "2026-11-12T20:30:00Z", lat: -23.55, lng: -46.63 } }]);
    await u.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByText("Momento já marcado às 17:30.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Onde foi roubado" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar o BO" })).toBeInTheDocument();
  });
});
