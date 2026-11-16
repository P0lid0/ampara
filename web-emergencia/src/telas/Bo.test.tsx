import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErro, api } from "../api/cliente";
import type { BoDto } from "../api/tipos";
import { Bo } from "./Bo";

const TEXTO = "BOLETIM\nIMEI 356938035643809 roubado em 12/11.";
const bo: BoDto = {
  texto: TEXTO,
  delegacia: { nome: "1o DP Se", endereco: "Rua Exemplo, 100", lat: -23.55, lng: -46.63 },
  linkDelegaciaEletronica: "https://delegacia.exemplo.gov.br/bo",
};
const props = () => ({ ocorrenciaId: "o1", aoVoltar: vi.fn(), aoSessaoVencida: vi.fn() });

let execCommand: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.spyOn(api.ocorrencias, "bo").mockResolvedValue(bo);
  execCommand = vi.fn(() => true);
  (document as unknown as { execCommand: unknown }).execCommand = execCommand;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function clipboard(writeText: (t: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

describe("Bo", () => {
  it("mostra o texto do BO em <pre> e a delegacia (nome e endereço)", async () => {
    render(<Bo {...props()} />);
    const pre = await screen.findByText(/BOLETIM/, { selector: "pre" });
    expect(pre.tagName).toBe("PRE");
    expect(pre.textContent).toBe(TEXTO);
    expect(screen.getByText("1o DP Se")).toBeInTheDocument();
    expect(screen.getByText("Rua Exemplo, 100")).toBeInTheDocument();
  });

  it('"Copiar texto" chama navigator.clipboard.writeText com o texto exato', async () => {
    const u = userEvent.setup(); // setup troca navigator.clipboard: o stub vem depois
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard(writeText);
    render(<Bo {...props()} />);
    await u.click(await screen.findByRole("button", { name: "Copiar texto" }));
    expect(writeText).toHaveBeenCalledWith(TEXTO);
    expect(await screen.findByText("Texto copiado.")).toBeInTheDocument();
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("se o clipboard rejeitar, usa execCommand e mostra 'Texto copiado.'", async () => {
    const u = userEvent.setup();
    clipboard(vi.fn().mockRejectedValue(new Error("negado")));
    render(<Bo {...props()} />);
    await u.click(await screen.findByRole("button", { name: "Copiar texto" }));
    expect(await screen.findByText("Texto copiado.")).toBeInTheDocument();
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("sem navigator.clipboard e sem execCommand: avisa para copiar à mão", async () => {
    const u = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    execCommand.mockReturnValue(false);
    render(<Bo {...props()} />);
    await u.click(await screen.findByRole("button", { name: "Copiar texto" }));
    expect(await screen.findByText(/Não foi possível copiar/)).toBeInTheDocument();
  });

  it('"Abrir a Delegacia Eletrônica" é <a target="_blank" rel="noopener noreferrer"> com o link da API', async () => {
    render(<Bo {...props()} />);
    const a = await screen.findByRole("link", { name: /Abrir a Delegacia Eletrônica/ });
    expect(a).toHaveAttribute("href", bo.linkDelegaciaEletronica);
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
  });

  it('"Enviar à polícia" fica desabilitado até marcar o consentimento; depois envia e mostra o protocolo', async () => {
    const compartilhar = vi.spyOn(api.ocorrencias, "compartilhar").mockResolvedValue({ protocolo: "PP-2026-000001" });
    const u = userEvent.setup();
    render(<Bo {...props()} />);
    const enviar = await screen.findByRole("button", { name: "Enviar à polícia" });
    expect(enviar).toBeDisabled();
    await u.click(screen.getByRole("checkbox"));
    expect(enviar).toBeEnabled();
    await u.click(enviar);
    expect(compartilhar).toHaveBeenCalledWith("o1");
    expect(await screen.findByText("Protocolo PP-2026-000001")).toBeInTheDocument();
  });

  it("erro de API mostra o detalheCidadao, nunca 'Error 500'", async () => {
    vi.spyOn(api.ocorrencias, "compartilhar").mockRejectedValue(new ApiErro(500, "A polícia está fora do ar. Tente em alguns minutos."));
    const u = userEvent.setup();
    render(<Bo {...props()} />);
    await u.click(await screen.findByRole("checkbox"));
    await u.click(screen.getByRole("button", { name: "Enviar à polícia" }));
    expect(await screen.findByText("A polícia está fora do ar. Tente em alguns minutos.")).toBeInTheDocument();
    expect(screen.queryByText(/Error 500|HTTP 500/)).not.toBeInTheDocument();
  });

  it("erro ao carregar o BO sem detalhe mostra mensagem genérica em português", async () => {
    vi.spyOn(api.ocorrencias, "bo").mockRejectedValue(new ApiErro(500));
    render(<Bo {...props()} />);
    expect(await screen.findByText("Não foi possível gerar o BO. Tente de novo.")).toBeInTheDocument();
  });

  it("401 chama aoSessaoVencida", async () => {
    vi.spyOn(api.ocorrencias, "bo").mockRejectedValue(new ApiErro(401));
    const p = props();
    render(<Bo {...p} />);
    await vi.waitFor(() => expect(p.aoSessaoVencida).toHaveBeenCalled());
  });

  it("RF1: ao sair, o texto do BO (com IMEI) não fica em sessionStorage nem localStorage", async () => {
    const u = userEvent.setup();
    const p = props();
    const { unmount } = render(<Bo {...p} />);
    await screen.findByText(/IMEI/, { selector: "pre" });
    const guardado = () => JSON.stringify({ ...sessionStorage }) + JSON.stringify({ ...localStorage });
    expect(guardado()).not.toContain("356938035643809");
    await u.click(screen.getByRole("button", { name: "Voltar" }));
    unmount();
    expect(guardado()).not.toContain("356938035643809");
    expect(guardado()).not.toContain("BOLETIM");
  });
});
