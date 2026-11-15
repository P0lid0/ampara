import { useEffect, useRef, useState } from "react";
import { NaoAutorizado, Proibido, executivo } from "../api";
import { rotuloClasse, rotuloSink } from "../rotulos";
import type { Executivo } from "../tipos";

const INTERVALO_MS = 5000;

function Barras({ titulo, dados, rotulo }: { titulo: string; dados: Record<string, number>; rotulo: (k: string) => string }) {
  const max = Math.max(1, ...Object.values(dados));
  return (
    <>
      <h3>{titulo}</h3>
      <ul className="barras">
        {Object.entries(dados).map(([k, v]) => (
          <li key={k} className="barra">
            <span>{rotulo(k)}</span>
            <span className="barra-trilho" aria-hidden="true">
              <span className="barra-preenchimento" style={{ display: "block", width: `${(v / max) * 100}%` }} />
            </span>
            <span className="barra-numero">{v}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function VisaoExecutiva({ token, aoExpirar }: { token: string; aoExpirar?: () => void }) {
  const [dados, setDados] = useState<Executivo | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [proibido, setProibido] = useState(false);
  const expirar = useRef(aoExpirar);
  expirar.current = aoExpirar;
  const sequencia = useRef(0);

  useEffect(() => {
    let ativo = true;
    const id = setInterval(() => void atualizar(), INTERVALO_MS);
    async function atualizar() {
      const minha = ++sequencia.current;
      try {
        const r = await executivo(token);
        if (!ativo || minha !== sequencia.current) return;
        setDados(r);
        setFalhou(false);
      } catch (e) {
        if (!ativo || minha !== sequencia.current) return;
        if (e instanceof Proibido) {
          setProibido(true);
          clearInterval(id);
        } else if (e instanceof NaoAutorizado) expirar.current?.();
        else setFalhou(true);
      }
    }
    void atualizar();
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [token]);

  if (proibido) {
    return (
      <section aria-labelledby="titulo-executiva">
        <h2 id="titulo-executiva">Visão executiva</h2>
        <p className="aviso" role="alert">Esta visão é só para administradores.</p>
      </section>
    );
  }

  const maxHora = dados ? Math.max(1, ...dados.porHora) : 1;
  return (
    <section aria-labelledby="titulo-executiva">
      <h2 id="titulo-executiva">Visão executiva</h2>
      <div aria-live="polite">
        {falhou && <p className="aviso">Não consegui atualizar agora. Tentando de novo.</p>}
        {dados ? (
          <>
            <p className="executiva-total">{dados.total24h} eventos nas últimas 24 h</p>
            <Barras titulo="Por tipo de dado" dados={dados.porClasse} rotulo={rotuloClasse} />
            <Barras titulo="Por ponto de saída" dados={dados.porSink} rotulo={rotuloSink} />
            <h3>Por hora</h3>
            <div className="horas">
              {dados.porHora.map((n, i) => {
                const h = dados.porHora.length - 1 - i;
                return (
                  <div
                    key={i}
                    role="img"
                    aria-label={`Há ${h} ${h === 1 ? "hora" : "horas"}: ${n} ${n === 1 ? "evento" : "eventos"}`}
                    className="hora"
                    style={{ height: `${(n / maxHora) * 100}%` }}
                  />
                );
              })}
            </div>
            <p className="horas-legenda" aria-hidden="true">
              <span>há 23 h</span>
              <span>agora</span>
            </p>
          </>
        ) : (
          !falhou && <p className="vazio">Carregando…</p>
        )}
      </div>
    </section>
  );
}
