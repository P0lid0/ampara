import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { VisaoCidadao } from "./componentes/VisaoCidadao";
import { FalhaDeRede, NaoAutorizado } from "./api";
import * as api from "./api";
import type { MeuRisco } from "./tipos";

const amarelo: MeuRisco = {
  indice: 40,
  farol: "amarelo",
  eventos: [
    {
      id: "1",
      em: "2026-11-14T12:00:00Z",
      classe: "Cpf",
      sink: "Log",
      decisao: "Bloqueado",
      mensagemCidadao: "Tentaram usar seu CPF e bloqueamos. Você não precisa fazer nada.",
    },
  ],
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("mensagens do cidadão aparecem em ordem e com rótulos em português", async () => {
  const dois: MeuRisco = {
    ...amarelo,
    eventos: [
      amarelo.eventos[0],
      { ...amarelo.eventos[0], id: "2", classe: "Saude", sink: "Llm", decisao: "Mascarado", mensagemCidadao: "Escondemos um dado de saúde." },
    ],
  };
  vi.spyOn(api, "meuRisco").mockResolvedValue(dois);
  render(<VisaoCidadao token="t" />);
  await act(async () => {});
  expect(screen.getByText(/Tentaram usar seu CPF/)).toBeInTheDocument();
  expect(screen.getByText(/CPF · registro do sistema · bloqueado/)).toBeInTheDocument();
  expect(screen.getByText(/Saúde · assistente de IA · escondido/)).toBeInTheDocument();
  const itens = screen.getAllByRole("listitem");
  expect(itens[0]).toHaveTextContent("Tentaram usar seu CPF");
  expect(itens[1]).toHaveTextContent("Escondemos um dado");
});

test("atualiza a cada 5 s e limpa o intervalo ao desmontar", async () => {
  const spy = vi.spyOn(api, "meuRisco").mockResolvedValue(amarelo);
  const { unmount } = render(<VisaoCidadao token="t" />);
  await act(async () => {});
  expect(spy).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(spy).toHaveBeenCalledTimes(2);
  unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
  expect(spy).toHaveBeenCalledTimes(2);
});

test("falha de rede mostra frase amigável e mantém os dados", async () => {
  const spy = vi.spyOn(api, "meuRisco").mockResolvedValueOnce(amarelo).mockRejectedValue(new FalhaDeRede());
  render(<VisaoCidadao token="t" />);
  await act(async () => {});
  expect(screen.getByRole("status")).toHaveTextContent("40/100");
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(spy).toHaveBeenCalledTimes(2);
  expect(screen.getByText(/Não consegui atualizar agora/)).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("40/100");
  expect(screen.getByText(/Tentaram usar seu CPF/)).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/Error|500|Failed/);
});

test("401 chama aoExpirar para voltar ao login", async () => {
  vi.spyOn(api, "meuRisco").mockRejectedValue(new NaoAutorizado());
  const aoExpirar = vi.fn();
  render(<VisaoCidadao token="t" aoExpirar={aoExpirar} />);
  await act(async () => {});
  expect(aoExpirar).toHaveBeenCalledTimes(1);
});

// Redesenho (critica P3 / DESIGN item 12): só o farol é região viva; a lista de mensagens não é relida a cada 5 s.
test("região aria-live fica montada desde o carregamento e contém o farol, não a lista", async () => {
  vi.spyOn(api, "meuRisco").mockResolvedValue(amarelo);
  const { container } = render(<VisaoCidadao token="t" />);
  const regiao = container.querySelector('[aria-live="polite"]');
  expect(regiao).not.toBeNull();
  await act(async () => {});
  expect(container.querySelector('[aria-live="polite"]')).toBe(regiao);
  expect(regiao).toHaveTextContent("40/100");
  expect(regiao).not.toHaveTextContent(/Tentaram usar seu CPF/);
  expect(screen.getByText(/Tentaram usar seu CPF/)).toBeInTheDocument();
});

test("risco alto mostra o próximo passo; seguro não", async () => {
  vi.spyOn(api, "meuRisco").mockResolvedValue({ indice: 82, farol: "vermelho", eventos: [] });
  const { unmount } = render(<VisaoCidadao token="t" />);
  await act(async () => {});
  expect(screen.getByText("O que fazer agora")).toBeInTheDocument();
  expect(screen.getByText(/Quanto maior o número, mais exposto/)).toBeInTheDocument();
  unmount();
  vi.spyOn(api, "meuRisco").mockResolvedValue({ indice: 5, farol: "verde", eventos: [] });
  render(<VisaoCidadao token="t" />);
  await act(async () => {});
  expect(screen.queryByText("O que fazer agora")).toBeNull();
});

test("hora da mensagem aparece em tempo relativo, com a data completa no title", async () => {
  const recente = new Date(Date.now() - 4 * 60000).toISOString();
  vi.spyOn(api, "meuRisco").mockResolvedValue({ ...amarelo, eventos: [{ ...amarelo.eventos[0], em: recente }] });
  render(<VisaoCidadao token="t" />);
  await act(async () => {});
  const t = screen.getByText("há 4 min");
  expect(t.tagName).toBe("TIME");
  expect(t).toHaveAttribute("title");
});

test("resposta antiga que chega depois da nova não sobrescreve", async () => {
  let resolverLenta!: (r: MeuRisco) => void;
  const lenta = new Promise<MeuRisco>((res) => (resolverLenta = res));
  const rapida: MeuRisco = { indice: 75, farol: "vermelho", eventos: [] };
  vi.spyOn(api, "meuRisco").mockReturnValueOnce(lenta).mockResolvedValue(rapida);
  render(<VisaoCidadao token="t" />);
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(screen.getByRole("status")).toHaveTextContent("75/100");
  await act(async () => { resolverLenta({ ...amarelo }); });
  expect(screen.getByRole("status")).toHaveTextContent("75/100");
});
