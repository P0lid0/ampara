import { useCallback, useEffect, useState } from "react";
import { ApiErro, api } from "../api/cliente";
import type { BoDto } from "../api/tipos";
import { Etapas } from "../componentes/Etapas";
import { FaixaDeMarca } from "../componentes/FaixaDeMarca";
import { IconeAlerta, IconeCheck, IconeCopiar, IconeExterno, IconeVoltar } from "../componentes/Icones";
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

  const pronto = !!ocorrenciaId && !erroCarga && bo !== null;

  return (
    <>
      <FaixaDeMarca aoSair={aoSair} />
      <main className={pronto ? "tela tela-barra" : "tela"}>
        <div className="cabeca">
          <button type="button" className="texto-botao voltar" onClick={aoVoltar}>
            <IconeVoltar />
            Voltar
          </button>
          <Etapas passo={3} />
          <h1>Boletim de ocorrência</h1>
          <p className="apoio">Copie o texto, abra a Delegacia Eletrônica ou envie os dados à polícia.</p>
        </div>

        {!ocorrenciaId ? (
          <div className="aviso">
            <div className="aviso-linha">
              <IconeAlerta />
              <p>Primeiro avise seus guardiões (botão Preciso de ajuda agora)</p>
            </div>
          </div>
        ) : erroCarga ? (
          <div role="alert" className="cartao">
            <p className="erro">
              <IconeAlerta />
              <span>{erroCarga}</span>
            </p>
            <button type="button" className="secundario" onClick={() => void carregar()}>Tentar de novo</button>
          </div>
        ) : bo === null ? (
          <p className="carregando" role="status">Carregando…</p>
        ) : (
          <>
            <section className="bloco-titulo" aria-labelledby="titulo-texto">
              <h2 id="titulo-texto">Texto do BO</h2>
              <p className="apoio">Traz o IMEI do seu aparelho e o momento que você marcou.</p>
              <details className="bo-detalhes">
                <summary>Ver o texto completo</summary>
                <pre className="bo-texto">{bo.texto}</pre>
              </details>
            </section>

            <section className="cartao" aria-labelledby="titulo-delegacia">
              <h2 id="titulo-delegacia">Delegacia mais perto</h2>
              <p className="delegacia-nome">{bo.delegacia.nome}</p>
              <p className="apoio">{bo.delegacia.endereco}</p>
              <a
                className="botao-link secundario"
                href={bo.linkDelegaciaEletronica}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir a Delegacia Eletrônica
                <IconeExterno tamanho={20} />
              </a>
            </section>

            <section className="cartao" aria-labelledby="titulo-policia">
              <h2 id="titulo-policia">Enviar à polícia</h2>
              {protocolo ? (
                <p className="selo" aria-live="polite">
                  <span className="selo-icone"><IconeCheck tamanho={28} /></span>
                  <span className="grande">Protocolo {protocolo}</span>
                </p>
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
                  {erroEnvio && (
                    <p className="erro" role="alert">
                      <IconeAlerta />
                      <span>{erroEnvio}</span>
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={!consentiu || enviando}
                    aria-describedby={!consentiu ? "ajuda-envio" : undefined}
                    onClick={() => void enviar()}
                  >
                    {enviando ? "Enviando…" : "Enviar à polícia"}
                  </button>
                  {!consentiu && <p className="ajuda-desabilitado" id="ajuda-envio">Marque a autorização para enviar.</p>}
                </>
              )}
            </section>
          </>
        )}
      </main>

      {pronto && (
        <div className="acao-fixa">
          <div className="acao-fixa-miolo">
            <p className="apoio" aria-live="polite">
              {copia === "ok" && "Texto copiado."}
              {copia === "falhou" && (
                <span className="erro">Não foi possível copiar. Abra o texto completo, segure o dedo sobre ele e escolha Copiar.</span>
              )}
            </p>
            <button type="button" onClick={() => void copiar()}>
              <IconeCopiar />
              Copiar texto
            </button>
          </div>
        </div>
      )}
    </>
  );
}
