import { useEffect, useRef, useState } from "react";
import { NaoAutorizado, Proibido, executivo } from "../api";
import { horaEmBrasilia, rotuloClasse, rotuloSink } from "../rotulos";
import { IconeAtencao } from "./Icones";
import type { Executivo } from "../tipos";

const INTERVALO_MS = 5000;

function Barras({ titulo, dados, rotulo }: { titulo: string; dados: Record<string, number>; rotulo: (k: string) => string }) {
  // Do maior para o menor: o pior aparece primeiro e em destaque; os demais ficam atenuados.
  const linhas = Object.entries(dados).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...linhas.map(([, v]) => v));
  return (
    <section className="grafico" aria-label={titulo}>
      <h3>{titulo}</h3>
      <ul className="barras">
        {linhas.map(([k, v], i) => (
          <li key={k} className={`barra${i === 0 && v > 0 ? " barra-maior" : ""}${v === 0 ? " barra-zero" : ""}`}>
            <span className="barra-rotulo">{rotulo(k)}</span>
            <span className="barra-trilho" aria-hidden="true">
              <span className="barra-preenchimento" style={{ width: `${(v / max) * 100}%` }} />
            </span>
            <span className="barra-numero">{v}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const MARCAS = [0, 5, 11, 17, 23]; // posições na série de 24 horas: há 23 h, 18 h, 12 h, 6 h, agora

function PorHora({ porHora }: { porHora: number[] }) {
  const [foco, setFoco] = useState<number | null>(null);
  const n = porHora.length;
  const max = Math.max(1, ...porHora);
  const pico = porHora.some((v) => v > 0) ? porHora.indexOf(Math.max(...porHora)) : -1;
  const horasAtras = (i: number) => n - 1 - i;
  const leitura =
    foco === null
      ? "Passe o mouse ou foque uma coluna para ver o valor."
      : `${horasAtras(foco) === 0 ? "Agora" : `Há ${horasAtras(foco)} ${horasAtras(foco) === 1 ? "hora" : "horas"}`}: ${porHora[foco]} ${porHora[foco] === 1 ? "evento" : "eventos"}`;
  return (
    <section className="grafico" aria-label="Por hora">
      <h3>Por hora</h3>
      <p className="horas-leitura" aria-hidden="true">{leitura}</p>
      <div className="horas-quadro">
        <span className="horas-eixo horas-eixo-topo" aria-hidden="true">{max}</span>
        <span className="horas-eixo horas-eixo-base" aria-hidden="true">0</span>
        <div className="horas">
          {porHora.map((v, i) => {
            const h = horasAtras(i);
            return (
              <div key={i} className="hora-slot" onMouseEnter={() => setFoco(i)} onMouseLeave={() => setFoco(null)}>
                <div
                  role="img"
                  tabIndex={0}
                  aria-label={`Há ${h} ${h === 1 ? "hora" : "horas"}: ${v} ${v === 1 ? "evento" : "eventos"}`}
                  className={`hora${i === pico ? " hora-pico" : ""}`}
                  style={{ height: `${(v / max) * 100}%` }}
                  onFocus={() => setFoco(i)}
                  onBlur={() => setFoco(null)}
                >
                  {i === pico && <span className="hora-valor" aria-hidden="true">{v}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="horas-marcas" aria-hidden="true">
        {MARCAS.map((i) => (
          <span key={i} style={{ left: `${((i + 0.5) / n) * 100}%` }}>
            {horasAtras(i) === 0 ? "agora" : `${horasAtras(i)} h`}
          </span>
        ))}
      </div>
      <p className="horas-nota" aria-hidden="true">Horas atrás, no horário de Brasília.</p>
    </section>
  );
}

/** "9 deles às 23h. O mais comum foi CPF." Nada de comparação inventada: só o que o servidor mandou. */
function leituraDoDia(d: Executivo, agora: number): string {
  if (d.total24h === 0) return "Nenhum evento nas últimas 24 horas. Está tudo calmo.";
  const picoMax = Math.max(...d.porHora);
  const i = d.porHora.indexOf(picoMax);
  const hora = String(horaEmBrasilia(agora - (d.porHora.length - 1 - i) * 3600000)).padStart(2, "0");
  const lider = Object.entries(d.porClasse).sort((a, b) => b[1] - a[1])[0];
  const parteClasse = lider && lider[1] > 0 ? ` O dado mais atingido foi ${rotuloClasse(lider[0])}.` : "";
  return `${picoMax} deles às ${hora}h, o pico do dia.${parteClasse}`;
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
        <h1 id="titulo-executiva">Visão executiva</h1>
        <p className="aviso" role="alert">
          <IconeAtencao tamanho={20} />
          Esta visão é só para administradores.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="titulo-executiva">
      <h1 id="titulo-executiva">Visão executiva</h1>
      <p className="atualizacao" data-falhou={falhou} aria-live="polite">
        {falhou && (
          <>
            <IconeAtencao tamanho={20} />
            Não consegui atualizar agora. Tentando de novo.
          </>
        )}
      </p>
      {dados ? (
        <>
          <div className="executiva-hero">
            <p className="so-leitor">{dados.total24h} eventos nas últimas 24 h</p>
            <p className="hero-numero" aria-hidden="true">{dados.total24h}</p>
            <p className="hero-rotulo" aria-hidden="true">eventos nas últimas 24 h</p>
            <p className="executiva-leitura">{leituraDoDia(dados, Date.now())}</p>
          </div>
          <div className="executiva-grade">
            <div>
              <Barras titulo="Por tipo de dado" dados={dados.porClasse} rotulo={rotuloClasse} />
              <Barras titulo="Por ponto de saída" dados={dados.porSink} rotulo={rotuloSink} />
            </div>
            <div>
              <PorHora porHora={dados.porHora} />
            </div>
          </div>
        </>
      ) : (
        !falhou && <p className="vazio">Carregando…</p>
      )}
    </section>
  );
}
