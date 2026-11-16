import { useCallback, useEffect, useState } from "react";
import { ApiErro, api } from "../api/cliente";
import type { EstadoOcorrencia, OcorrenciaDto } from "../api/tipos";
import { Etapas } from "../componentes/Etapas";
import { FaixaDeMarca } from "../componentes/FaixaDeMarca";
import { IconeAlerta, IconeCheck, IconeFechar } from "../componentes/Icones";

type Fase = "inicio" | "confirmando" | "enviando" | "avisado";

const MSG_LISTA = "Não foi possível carregar suas ocorrências. Tente de novo.";
const MSG_AVISAR = "Não foi possível avisar seus guardiões agora. Tente de novo.";
/** A frase da API (detalheCidadao) quando houver; senão a mensagem da tela. */
const frase = (x: unknown, padrao: string) => (x instanceof ApiErro && x.detalheCidadao) || padrao;

const hora = (d: Date) =>
  d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

const ICONE_ESTADO: Record<EstadoOcorrencia, () => JSX.Element> = {
  Aberta: () => <IconeAlerta tamanho={18} />,
  Cancelada: () => <IconeFechar tamanho={18} />,
  Encerrada: () => <IconeCheck tamanho={18} />,
};

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
  const [erroLista, setErroLista] = useState<string | null>(null);

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
    setErroLista(null);
    try {
      setLista(await api.ocorrencias.listar());
    } catch (x) {
      // Falha que não é 401 não é "lista vazia": mostra erro e deixa tentar de novo.
      if (!tratar(x)) setErroLista(frase(x, MSG_LISTA));
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
      setErro(frase(x, MSG_AVISAR));
      setFase("inicio");
    }
  }

  return (
    <>
      <FaixaDeMarca aoSair={aoSair} />
      <main className="tela">
        <div className="cabeca">
          <Etapas passo={1} />
          <h1>Avise seus guardiões</h1>
        </div>

        {fase === "avisado" && ocorrenciaId ? (
          <section className="confirmado" aria-live="polite">
            <div className="selo">
              <span className="selo-icone"><IconeCheck tamanho={28} /></span>
              <p className="grande">Seus guardiões foram avisados.</p>
            </div>
            <p className="apoio">
              Às <time>{avisadoEm ? hora(avisadoEm) : ""}</time>. Agora marque no mapa onde o celular foi roubado: isso ajuda no BO.
            </p>
            <div className="botoes">
              <button type="button" onClick={() => aoMarcar(ocorrenciaId)}>Marcar onde foi roubado</button>
            </div>
          </section>
        ) : fase === "confirmando" ? (
          <section className="confirmar" role="alertdialog" aria-labelledby="pergunta">
            <p id="pergunta" className="grande">Avisar meus guardiões agora?</p>
            <div className="botoes">
              <button type="button" className="alarme sim" onClick={avisar}>Sim, avisar</button>
              <button type="button" className="secundario" onClick={() => setFase("inicio")}>Não</button>
            </div>
          </section>
        ) : (
          <>
            <p className="apoio">Se o seu celular foi roubado, toque no botão. Seus guardiões recebem o alarme.</p>
            {erro && (
              <p className="erro" role="alert">
                <IconeAlerta />
                <span>{erro}</span>
              </p>
            )}
            <button type="button" className="alarme gigante" disabled={fase === "enviando"} onClick={() => setFase("confirmando")}>
              Preciso de ajuda agora
            </button>
          </>
        )}

        <section className="lista" aria-labelledby="titulo-lista">
          <h2 id="titulo-lista">Suas ocorrências</h2>
          {erroLista ? (
            <div role="alert" className="cartao">
              <p className="erro">
                <IconeAlerta />
                <span>{erroLista}</span>
              </p>
              <button type="button" className="secundario" onClick={() => void carregar()}>Tentar de novo</button>
            </div>
          ) : lista === null ? (
            <p className="carregando" role="status">Carregando…</p>
          ) : lista.length === 0 ? (
            <p className="vazio">Nenhuma ocorrência ainda.</p>
          ) : (
            <ul>
              {lista.map((o) => {
                const Icone = ICONE_ESTADO[o.estado] ?? ICONE_ESTADO.Cancelada;
                return (
                  <li key={o.id}>
                    <span className={`etiqueta etiqueta-${String(o.estado).toLowerCase()}`}>
                      <Icone />
                      {o.estado}
                    </span>
                    <span className="apoio num">{dataHora(o.iniciadaEm)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
