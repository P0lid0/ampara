import { useCallback, useEffect, useState } from "react";
import { ApiErro, api } from "../api/cliente";
import type { OcorrenciaDto } from "../api/tipos";

type Fase = "inicio" | "confirmando" | "enviando" | "avisado";

const hora = (d: Date) =>
  d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function Painel({
  aoSair,
  aoSessaoVencida,
  aoMarcar,
  agora = () => new Date(),
}: {
  aoSair: () => void;
  aoSessaoVencida: () => void;
  aoMarcar: (ocorrenciaId: string) => void;
  agora?: () => Date;
}) {
  const [fase, setFase] = useState<Fase>("inicio");
  const [ocorrenciaId, setOcorrenciaId] = useState<string | null>(null);
  const [avisadoEm, setAvisadoEm] = useState<Date | null>(null);
  const [lista, setLista] = useState<OcorrenciaDto[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroLista, setErroLista] = useState(false);

  const tratar = useCallback(
    (x: unknown) => {
      if (x instanceof ApiErro && x.status === 401) {
        aoSessaoVencida();
        return true;
      }
      return false;
    },
    [aoSessaoVencida],
  );

  const carregar = useCallback(async () => {
    setErroLista(false);
    try {
      setLista(await api.ocorrencias.listar());
    } catch (x) {
      // Falha que não é 401 não é "lista vazia": mostra erro e deixa tentar de novo.
      if (!tratar(x)) setErroLista(true);
    }
  }, [tratar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function avisar() {
    setFase("enviando");
    setErro(null);
    try {
      // 201 (nova) e 200 (já havia uma Aberta) são sucesso: vale a ocorrenciaId devolvida.
      const r = await api.ocorrencias.gatilho("web");
      setOcorrenciaId(r.ocorrenciaId);
      setAvisadoEm(agora());
      setFase("avisado");
      void carregar();
    } catch (x) {
      if (tratar(x)) return;
      setErro("Não foi possível avisar seus guardiões agora. Tente de novo.");
      setFase("inicio");
    }
  }

  return (
    <main className="tela">
      <h1>Ampara — Emergência</h1>

      {fase === "avisado" && ocorrenciaId ? (
        <section className="confirmado" aria-live="polite">
          <p className="grande">Seus guardiões foram avisados. <span>({avisadoEm ? hora(avisadoEm) : ""})</span></p>
          <button type="button" onClick={() => aoMarcar(ocorrenciaId)}>Marcar onde foi roubado</button>
        </section>
      ) : fase === "confirmando" ? (
        <section className="confirmar" role="alertdialog" aria-labelledby="pergunta">
          <p id="pergunta" className="grande">Avisar meus guardiões agora?</p>
          <div className="linha">
            <button type="button" className="alarme" onClick={avisar}>Sim, avisar</button>
            <button type="button" className="secundario" onClick={() => setFase("inicio")}>Não</button>
          </div>
        </section>
      ) : (
        <>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button type="button" className="alarme gigante" disabled={fase === "enviando"} onClick={() => setFase("confirmando")}>
            Preciso de ajuda agora
          </button>
        </>
      )}

      <section className="lista" aria-labelledby="titulo-lista">
        <h2 id="titulo-lista">Suas ocorrências</h2>
        {erroLista ? (
          <div role="alert">
            <p className="erro">Não foi possível carregar suas ocorrências. Tente de novo.</p>
            <button type="button" className="secundario" onClick={() => void carregar()}>Tentar de novo</button>
          </div>
        ) : lista === null ? (
          <p>Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="vazio">Nenhuma ocorrência ainda.</p>
        ) : (
          <ul>
            {lista.map((o) => (
              <li key={o.id}>
                <strong>{o.estado}</strong> <span>{dataHora(o.iniciadaEm)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button type="button" className="secundario sair" onClick={aoSair}>Sair e apagar tudo desta aba</button>
    </main>
  );
}
