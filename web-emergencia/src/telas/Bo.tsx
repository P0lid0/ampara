import { useCallback, useEffect, useState } from "react";
import { ApiErro, api } from "../api/cliente";
import type { BoDto } from "../api/tipos";
import { copiarTexto } from "../lib/copiar";

const MSG_BO = "Não foi possível gerar o BO. Tente de novo.";
const MSG_ENVIO = "Não foi possível enviar à polícia. Tente de novo.";

export function Bo({
  ocorrenciaId,
  aoVoltar,
  aoSessaoVencida,
  aoSair,
}: {
  ocorrenciaId: string | null;
  aoVoltar: () => void;
  aoSessaoVencida: () => void;
  aoSair?: () => void;
}) {
  // O texto do BO (traz IMEI) vive só neste estado: nunca em sessionStorage/localStorage.
  const [bo, setBo] = useState<BoDto | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [copia, setCopia] = useState<"ok" | "falhou" | null>(null);
  const [consentiu, setConsentiu] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [protocolo, setProtocolo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!ocorrenciaId) return;
    setErroCarga(null);
    try {
      setBo(await api.ocorrencias.bo(ocorrenciaId));
    } catch (x) {
      if (x instanceof ApiErro && x.status === 401) aoSessaoVencida();
      else setErroCarga((x instanceof ApiErro && x.detalheCidadao) || MSG_BO);
    }
  }, [ocorrenciaId, aoSessaoVencida]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function copiar() {
    if (!bo) return;
    setCopia((await copiarTexto(bo.texto)) ? "ok" : "falhou");
  }

  async function enviar() {
    if (!ocorrenciaId || !consentiu) return;
    setEnviando(true);
    setErroEnvio(null);
    try {
      setProtocolo((await api.ocorrencias.compartilhar(ocorrenciaId)).protocolo);
    } catch (x) {
      if (x instanceof ApiErro && x.status === 401) aoSessaoVencida();
      else setErroEnvio((x instanceof ApiErro && x.detalheCidadao) || MSG_ENVIO);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="tela">
      <h1>Boletim de ocorrência</h1>

      {!ocorrenciaId ? (
        <p className="aviso">Primeiro avise seus guardiões (botão Preciso de ajuda agora)</p>
      ) : erroCarga ? (
        <div role="alert" className="bloco">
          <p className="erro">{erroCarga}</p>
          <button type="button" className="secundario" onClick={() => void carregar()}>Tentar de novo</button>
        </div>
      ) : bo === null ? (
        <p>Carregando…</p>
      ) : (
        <>
          <section aria-labelledby="titulo-texto">
            <h2 id="titulo-texto">Texto do BO</h2>
            <pre className="bo-texto">{bo.texto}</pre>
            <button type="button" onClick={() => void copiar()}>Copiar texto</button>
            <p aria-live="polite">
              {copia === "ok" && "Texto copiado."}
              {copia === "falhou" && (
                <span className="erro">Não foi possível copiar. Segure o dedo sobre o texto e escolha Copiar.</span>
              )}
            </p>
          </section>

          <section aria-labelledby="titulo-delegacia">
            <h2 id="titulo-delegacia">Delegacia mais perto</h2>
            <p className="grande">{bo.delegacia.nome}</p>
            <p>{bo.delegacia.endereco}</p>
            <a
              className="botao-link"
              href={bo.linkDelegaciaEletronica}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir a Delegacia Eletrônica
            </a>
          </section>

          <section className="confirmar" aria-labelledby="titulo-policia">
            <h2 id="titulo-policia">Enviar à polícia</h2>
            {protocolo ? (
              <p className="grande" aria-live="polite">Protocolo {protocolo}</p>
            ) : (
              <>
                <label className="consentimento">
                  <input
                    type="checkbox"
                    checked={consentiu}
                    onChange={(e) => setConsentiu(e.target.checked)}
                  />
                  Autorizo enviar estes dados à polícia para investigar o roubo.
                </label>
                {erroEnvio && <p className="erro" role="alert">{erroEnvio}</p>}
                <button type="button" className="alarme" disabled={!consentiu || enviando} onClick={() => void enviar()}>
                  Enviar à polícia
                </button>
              </>
            )}
          </section>
        </>
      )}

      <button type="button" className="secundario" onClick={aoVoltar}>Voltar</button>
      {aoSair && (
        <button type="button" className="secundario sair" onClick={aoSair}>Sair e apagar tudo desta aba</button>
      )}
    </main>
  );
}
