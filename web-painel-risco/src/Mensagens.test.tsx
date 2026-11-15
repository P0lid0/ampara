import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Mensagens } from "./componentes/Mensagens";

afterEach(() => vi.restoreAllMocks());

// Revisão final do plano 03 (painel-6): a hora sai em America/Sao_Paulo, qualquer que seja o fuso da máquina.
test("hora da mensagem é exibida no fuso de Brasília", () => {
  const spy = vi.spyOn(Date.prototype, "toLocaleString");
  render(
    <Mensagens
      eventos={[{ id: "1", em: "2026-11-15T00:10:00Z", classe: "Cpf", sink: "Log", decisao: "Bloqueado", mensagemCidadao: "Frase um. Frase dois." }]}
    />,
  );
  expect(spy).toHaveBeenCalledWith("pt-BR", expect.objectContaining({ timeZone: "America/Sao_Paulo" }));
  expect(screen.getByText(/14\/11\/2026.*21:10/)).toBeInTheDocument();
});
