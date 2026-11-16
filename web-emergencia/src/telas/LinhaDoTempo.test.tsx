import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErro, api } from "../api/cliente";
import type { OcorrenciaDto } from "../api/tipos";
import { LinhaDoTempo } from "./LinhaDoTempo";

vi.mock("../componentes/Mapa", () => ({
  Mapa: ({ pontos, selecionado }: { pontos: { em: string }[]; selecionado: number }) => (
    <div data-testid="mapa">{pontos.length} pontos, selecionado {selecionado}</div>
  ),
}));

const oc = (id: string, iniciadaEm: string, estado: OcorrenciaDto["estado"] = "Aberta"): OcorrenciaDto => ({
  id, estado, origem: "web", iniciadaEm, momento: null, passos: [], alertas: [], contas: [],
});

const AGORA = new Date("2026-11-14T00:00:00Z");
const props = () => ({
  ocorrenciaId: "o1" as string | null,
  aoVoltar: vi.fn(),
  aoSessaoVencida: vi.fn(),
  aoBo: vi.fn(),
  agora: () => AGORA,
});

const pts = [
  { lat: -23.55, lng: -46.63, em: "2026-11-12T20:30:00Z" }, // 17:30
  { lat: -23.56, lng: -46.64, em: "2026-11-12T20:41:00Z" }, // 17:41
  { lat: -23.57, lng: -46.65, em: "2026-11-11T13:00:00Z" }, // 10:00 do dia anterior
];

beforeEach(() => {
  vi.spyOn(api.ocorrencias, "listar").mockResolvedValue([oc("o1", "2026-11-12T21:00:00Z")]);
  vi.spyOn(api, "rota").mockResolvedValue(pts);
});
afterEach(() => vi.restoreAllMocks());

describe("LinhaDoTempo", () => {
  it("consulta a rota dos últimos 7 dias em ISO UTC", async () => {
    render(<LinhaDoTempo {...props()} />);
    await screen.findByTestId("mapa");
    expect(api.rota).toHaveBeenCalledWith("2026-11-07T00:00:00.000Z", "2026-11-14T00:00:00.000Z");
  });

  it("linha do tempo: um botão por dia com pontos e uma lista de horários do dia selecionado", async () => {
    const u = userEvent.setup();
    render(<LinhaDoTempo {...props()} />);
    expect(await screen.findByRole("button", { name: "12/11" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "11/11" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "17:30" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "17:41" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "10:00" })).not.toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "11/11" }));
    expect(screen.getByRole("button", { name: "10:00" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "17:41" })).not.toBeInTheDocument();
  });

  it('escolher o horário "17:30" e clicar "Foi aqui que me roubaram" envia momento(id,{em,lat,lng}) do ponto escolhido', async () => {
    const momento = vi.spyOn(api.ocorrencias, "momento").mockResolvedValue(undefined);
    const u = userEvent.setup();
    render(<LinhaDoTempo {...props()} />);
    await u.click(await screen.findByRole("button", { name: "17:30" })); // não é o padrão (17:41)
    await u.click(screen.getByRole("button", { name: "Foi aqui que me roubaram" }));
    expect(momento).toHaveBeenCalledWith("o1", { em: "2026-11-12T20:30:00Z", lat: -23.55, lng: -46.63 });
  });

  it("dia padrão é o da ocorrência, não o mais recente; trocar de dia envia o ponto do outro dia", async () => {
    vi.spyOn(api.ocorrencias, "listar").mockResolvedValue([oc("o1", "2026-11-11T13:05:00Z")]);
    const momento = vi.spyOn(api.ocorrencias, "momento").mockResolvedValue(undefined);
    const u = userEvent.setup();
    render(<LinhaDoTempo {...props()} />);
    expect(await screen.findByRole("button", { name: "10:00" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "17:41" })).not.toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Foi aqui que me roubaram" }));
    expect(momento).toHaveBeenLastCalledWith("o1", { em: "2026-11-11T13:00:00Z", lat: -23.57, lng: -46.65 });
    await u.click(screen.getByRole("button", { name: "12/11" }));
    await u.click(screen.getByRole("button", { name: "17:30" }));
    await u.click(screen.getByRole("button", { name: "Foi aqui que me roubaram" }));
    expect(momento).toHaveBeenLastCalledWith("o1", { em: "2026-11-12T20:30:00Z", lat: -23.55, lng: -46.63 });
  });

  it("401 ao marcar chama aoSessaoVencida", async () => {
    vi.spyOn(api.ocorrencias, "momento").mockRejectedValue(new ApiErro(401));
    const p = props();
    const u = userEvent.setup();
    render(<LinhaDoTempo {...p} />);
    await u.click(await screen.findByRole("button", { name: "Foi aqui que me roubaram" }));
    await vi.waitFor(() => expect(p.aoSessaoVencida).toHaveBeenCalled());
  });

  it("com aoSair mostra o botão de sair e apagar a aba", async () => {
    const aoSair = vi.fn();
    const u = userEvent.setup();
    render(<LinhaDoTempo {...props()} aoSair={aoSair} />);
    await u.click(await screen.findByRole("button", { name: "Sair e apagar tudo desta aba" }));
    expect(aoSair).toHaveBeenCalled();
  });

  it("sem ocorrência: mostra o aviso e não envia o momento", async () => {
    vi.spyOn(api.ocorrencias, "listar").mockResolvedValue([]);
    const momento = vi.spyOn(api.ocorrencias, "momento");
    render(<LinhaDoTempo {...props()} ocorrenciaId={null} />);
    expect(await screen.findByText("Primeiro avise seus guardiões (botão Preciso de ajuda agora)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Foi aqui que me roubaram" })).not.toBeInTheDocument();
    expect(momento).not.toHaveBeenCalled();
  });

  it("sem pontos: 'Nenhuma rota nos últimos 7 dias.' e botão de marcar ausente", async () => {
    vi.spyOn(api, "rota").mockResolvedValue([]);
    render(<LinhaDoTempo {...props()} />);
    expect(await screen.findByText("Nenhuma rota nos últimos 7 dias.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Foi aqui que me roubaram" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("mapa")).not.toBeInTheDocument();
  });

  it("depois de marcar mostra 'Momento marcado às 17:30.' e o botão 'Gerar o BO'", async () => {
    vi.spyOn(api.ocorrencias, "momento").mockResolvedValue(undefined);
    const aoBo = vi.fn();
    const u = userEvent.setup();
    render(<LinhaDoTempo {...props()} aoBo={aoBo} />);
    await u.click(await screen.findByRole("button", { name: "17:30" })); // não é o padrão (17:41)
    await u.click(screen.getByRole("button", { name: "Foi aqui que me roubaram" }));
    expect(await screen.findByText("Momento marcado às 17:30.")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Gerar o BO" }));
    expect(aoBo).toHaveBeenCalledWith("o1");
  });

  it("mais de uma ocorrência: seletor 'Qual ocorrência?' com data e estado; o momento vai para a escolhida", async () => {
    vi.spyOn(api.ocorrencias, "listar").mockResolvedValue([
      oc("antiga", "2026-11-10T15:00:00Z", "Encerrada"),
      oc("nova", "2026-11-12T21:00:00Z", "Aberta"),
    ]);
    const momento = vi.spyOn(api.ocorrencias, "momento").mockResolvedValue(undefined);
    const u = userEvent.setup();
    render(<LinhaDoTempo {...props()} ocorrenciaId={null} />);
    const seletor = await screen.findByLabelText("Qual ocorrência?");
    expect(seletor).toHaveValue("nova"); // padrão: a mais recente
    expect(screen.getByRole("option", { name: /Encerrada/ })).toBeInTheDocument();
    await u.selectOptions(seletor, "antiga");
    await u.click(screen.getByRole("button", { name: "Foi aqui que me roubaram" }));
    expect(momento).toHaveBeenCalledWith("antiga", expect.any(Object));
  });

  it("falha ao marcar mostra erro e não mostra 'Momento marcado'", async () => {
    vi.spyOn(api.ocorrencias, "momento").mockRejectedValue(new ApiErro(500));
    const u = userEvent.setup();
    render(<LinhaDoTempo {...props()} />);
    await u.click(await screen.findByRole("button", { name: "Foi aqui que me roubaram" }));
    expect(await screen.findByText("Não foi possível marcar o momento. Tente de novo.")).toBeInTheDocument();
    expect(screen.queryByText(/Momento marcado/)).not.toBeInTheDocument();
  });

  it("401 ao carregar chama aoSessaoVencida", async () => {
    vi.spyOn(api, "rota").mockRejectedValue(new ApiErro(401));
    const p = props();
    render(<LinhaDoTempo {...p} />);
    await vi.waitFor(() => expect(p.aoSessaoVencida).toHaveBeenCalled());
  });

  it("falha ao carregar (não 401) mostra erro e 'Tentar de novo'", async () => {
    vi.spyOn(api, "rota").mockRejectedValueOnce(new ApiErro(0));
    const u = userEvent.setup();
    render(<LinhaDoTempo {...props()} />);
    expect(await screen.findByText("Não foi possível carregar sua rota. Tente de novo.")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByTestId("mapa")).toBeInTheDocument();
  });

  // Item 14: a ocorrência que já tem momento gravado não pode sobrescrevê-lo com o ponto padrão.
  it("item 14: com momento gravado mostra 'Momento já marcado às 17:30.' e 'Gerar o BO' direto, sem 'Foi aqui que me roubaram'", async () => {
    vi.spyOn(api.ocorrencias, "listar").mockResolvedValue([
      { ...oc("o1", "2026-11-12T21:00:00Z"), momento: { em: "2026-11-12T20:30:00Z", lat: -23.55, lng: -46.63 } },
    ]);
    const momento = vi.spyOn(api.ocorrencias, "momento").mockResolvedValue(undefined);
    const p = props();
    const u = userEvent.setup();
    render(<LinhaDoTempo {...p} />);
    expect(await screen.findByText("Momento já marcado às 17:30.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Foi aqui que me roubaram" })).not.toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Gerar o BO" }));
    expect(p.aoBo).toHaveBeenCalledWith("o1");
    expect(momento).not.toHaveBeenCalled();
  });

  it("item 14: o ponto pré-selecionado é o mais perto do momento gravado (não do início); 'Marcar de novo' libera a remarcação", async () => {
    vi.spyOn(api.ocorrencias, "listar").mockResolvedValue([
      { ...oc("o1", "2026-11-12T21:00:00Z"), momento: { em: "2026-11-12T20:31:00Z", lat: -23.55, lng: -46.63 } },
    ]);
    const momento = vi.spyOn(api.ocorrencias, "momento").mockResolvedValue(undefined);
    const u = userEvent.setup();
    render(<LinhaDoTempo {...props()} />);
    await screen.findByText("Momento já marcado às 17:31.");
    expect(screen.getByRole("button", { name: "17:30" })).toHaveAttribute("aria-pressed", "true");
    await u.click(screen.getByRole("button", { name: "Marcar de novo" }));
    await u.click(screen.getByRole("button", { name: "Foi aqui que me roubaram" }));
    expect(momento).toHaveBeenCalledWith("o1", { em: "2026-11-12T20:30:00Z", lat: -23.55, lng: -46.63 });
  });

  it("item 16: erro da API ao marcar mostra o detalheCidadao (ex.: momento-invalido)", async () => {
    vi.spyOn(api.ocorrencias, "momento").mockRejectedValue(new ApiErro(422, "O momento precisa ser até 7 dias antes do pedido de ajuda."));
    const u = userEvent.setup();
    render(<LinhaDoTempo {...props()} />);
    await u.click(await screen.findByRole("button", { name: "Foi aqui que me roubaram" }));
    expect(await screen.findByText("O momento precisa ser até 7 dias antes do pedido de ajuda.")).toBeInTheDocument();
  });

  it("item 16: erro da API ao carregar mostra o detalheCidadao", async () => {
    vi.spyOn(api, "rota").mockRejectedValueOnce(new ApiErro(503, "A rota está indisponível agora. Tente em alguns minutos."));
    render(<LinhaDoTempo {...props()} />);
    expect(await screen.findByText("A rota está indisponível agora. Tente em alguns minutos.")).toBeInTheDocument();
  });
});
