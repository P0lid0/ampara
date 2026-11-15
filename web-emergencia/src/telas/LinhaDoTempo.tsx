import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiErro, api } from "../api/cliente";
import type { OcorrenciaDto, PontoRota } from "../api/tipos";
import { Mapa } from "../componentes/Mapa";
import { agruparPorDia, formatarHora, pontoMaisProximo } from "../lib/agruparPorDia";

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
/** "2026-11-12" -> "12/11" */
const rotuloDia = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const SETE_DIAS = 7 * 24 * 3600 * 1000;

export function LinhaDoTempo({
  ocorrenciaId,
  aoVoltar,
  aoSessaoVencida,
  aoBo,
  aoSair,
  agora = () => new Date(),
}: {
  ocorrenciaId: string | null;
  aoVoltar: () => void;
  aoSessaoVencida: () => void;
  aoBo: (ocorrenciaId: string) => void;
  aoSair?: () => void;
  agora?: () => Date;
}) {
  const [dados, setDados] = useState<{ ocorrencias: OcorrenciaDto[]; rota: PontoRota[] } | null>(null);
  const [erroCarga, setErroCarga] = useState(false);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const [indice, setIndice] = useState(-1); // -1 = padrão (ponto mais perto do início da ocorrência)
  const [enviando, setEnviando] = useState(false);
  const [erroMarcar, setErroMarcar] = useState(false);
  const [marcadoEm, setMarcadoEm] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErroCarga(false);
    try {
      const fim = agora();
      const [ocorrencias, rota] = await Promise.all([
        api.ocorrencias.listar(),
        api.rota(new Date(fim.getTime() - SETE_DIAS).toISOString(), fim.toISOString()),
      ]);
      setDados({ ocorrencias, rota });
    } catch (x) {
      if (x instanceof ApiErro && x.status === 401) aoSessaoVencida();
      else setErroCarga(true);
    }
    // `agora` só é lido na carga; trocá-lo não deve recarregar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aoSessaoVencida]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Mais recente primeiro. Padrão: a ocorrência recém-avisada (prop), senão a mais recente.
  const ocorrencias = useMemo(
    () =>
      [...(dados?.ocorrencias ?? [])].sort(
        (a, b) => new Date(b.iniciadaEm).getTime() - new Date(a.iniciadaEm).getTime(),
      ),
    [dados],
  );
  const ocorrenciaAtual =
    ocorrencias.find((o) => o.id === escolhida) ?? ocorrencias.find((o) => o.id === ocorrenciaId) ?? ocorrencias[0] ?? null;

  const dias = useMemo(() => agruparPorDia(dados?.rota ?? []), [dados]);
  // Dia padrão: o do ponto mais perto do início da ocorrência (nunca um dia sem relação com o roubo).
  const diaPadrao = useMemo(() => {
    if (!ocorrenciaAtual) return dias[0] ?? null;
    const todos = dias.flatMap((d) => d.pontos);
    const i = pontoMaisProximo(todos, ocorrenciaAtual.iniciadaEm);
    return (i >= 0 ? dias.find((d) => d.pontos.includes(todos[i])) : null) ?? dias[0] ?? null;
  }, [dias, ocorrenciaAtual]);
  const diaAtual = dias.find((d) => d.dia === dia) ?? diaPadrao;
  const pontos = useMemo(() => diaAtual?.pontos ?? [], [diaAtual]);
  const idxPadrao = ocorrenciaAtual ? Math.max(0, pontoMaisProximo(pontos, ocorrenciaAtual.iniciadaEm)) : 0;
  const idx = indice >= 0 && indice < pontos.length ? indice : idxPadrao;
  const ponto = pontos[idx];

  function trocarDia(d: string) {
    setDia(d);
    setIndice(-1);
    setMarcadoEm(null);
    setErroMarcar(false);
  }
  function escolherPonto(i: number) {
    setIndice(i);
    setMarcadoEm(null);
    setErroMarcar(false);
  }

  async function marcar() {
    if (!ocorrenciaAtual || !ponto) return;
    setEnviando(true);
    setErroMarcar(false);
    try {
      await api.ocorrencias.momento(ocorrenciaAtual.id, { em: ponto.em, lat: ponto.lat, lng: ponto.lng });
      setMarcadoEm(ponto.em);
    } catch (x) {
      if (x instanceof ApiErro && x.status === 401) aoSessaoVencida();
      else setErroMarcar(true);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="tela">
      <h1>Onde foi roubado</h1>

      {erroCarga ? (
        <div role="alert" className="bloco">
          <p className="erro">Não foi possível carregar sua rota. Tente de novo.</p>
          <button type="button" className="secundario" onClick={() => void carregar()}>Tentar de novo</button>
        </div>
      ) : dados === null ? (
        <p>Carregando…</p>
      ) : (
        <>
          {ocorrencias.length > 1 && (
            <label>
              Qual ocorrência?
              <select
                value={ocorrenciaAtual?.id}
                onChange={(e) => {
                  setEscolhida(e.target.value);
                  setDia(null);
                  setIndice(-1);
                  setMarcadoEm(null);
                  setErroMarcar(false);
                }}
              >
                {ocorrencias.map((o) => (
                  <option key={o.id} value={o.id}>{dataHora(o.iniciadaEm)} — {o.estado}</option>
                ))}
              </select>
            </label>
          )}

          {dias.length === 0 ? (
            <p className="vazio">Nenhuma rota nos últimos 7 dias.</p>
          ) : (
            <>
              <section aria-labelledby="titulo-dias">
                <h2 id="titulo-dias">Dia</h2>
                <div className="chips">
                  {dias.map((d) => (
                    <button
                      key={d.dia}
                      type="button"
                      className={d.dia === diaAtual?.dia ? "" : "secundario"}
                      aria-pressed={d.dia === diaAtual?.dia}
                      onClick={() => trocarDia(d.dia)}
                    >
                      {rotuloDia(d.dia)}
                    </button>
                  ))}
                </div>
              </section>

              <Mapa pontos={pontos} selecionado={idx} aoSelecionar={escolherPonto} />

              <section aria-labelledby="titulo-horas">
                <h2 id="titulo-horas">Horário</h2>
                <div className="chips">
                  {pontos.map((p, i) => (
                    <button
                      key={`${p.em}-${i}`}
                      type="button"
                      className={i === idx ? "" : "secundario"}
                      aria-pressed={i === idx}
                      onClick={() => escolherPonto(i)}
                    >
                      {formatarHora(p.em)}
                    </button>
                  ))}
                </div>
              </section>

              {ocorrenciaAtual && marcadoEm ? (
                <section className="confirmado" aria-live="polite">
                  <p className="grande">Momento marcado às {formatarHora(marcadoEm)}.</p>
                  <button type="button" onClick={() => aoBo(ocorrenciaAtual.id)}>Gerar o BO</button>
                </section>
              ) : ocorrenciaAtual ? (
                <>
                  {erroMarcar && <p className="erro" role="alert">Não foi possível marcar o momento. Tente de novo.</p>}
                  <button type="button" className="alarme" disabled={enviando} onClick={() => void marcar()}>
                    Foi aqui que me roubaram
                  </button>
                </>
              ) : null}
            </>
          )}

          {!ocorrenciaAtual && <p className="aviso">Primeiro avise seus guardiões (botão Preciso de ajuda agora)</p>}
        </>
      )}

      <button type="button" className="secundario" onClick={aoVoltar}>Voltar</button>
      {aoSair && (
        <button type="button" className="secundario sair" onClick={aoSair}>Sair e apagar tudo desta aba</button>
      )}
    </main>
  );
}
