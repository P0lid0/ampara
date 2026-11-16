import type { EventoCidadao } from "../tipos";
import { rotuloClasse, rotuloDecisao, rotuloSink, tempoRelativo } from "../rotulos";
import { IconeAtencao, IconeProtegido } from "./Icones";

const dataCompleta = (em: string) =>
  new Date(em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function Mensagens({ eventos }: { eventos: EventoCidadao[] }) {
  if (eventos.length === 0) {
    return <p className="vazio ok">Nada de estranho nas últimas 24 horas. Está tudo certo com seus dados.</p>;
  }
  const agora = Date.now();
  return (
    <ol className="mensagens">
      {eventos.map((e) => {
        const completa = dataCompleta(e.em);
        return (
          <li key={e.id} className="mensagem">
            <span className="mensagem-icone">{e.decisao === "Permitido" ? <IconeAtencao /> : <IconeProtegido />}</span>
            <div className="mensagem-corpo">
              <p className="mensagem-texto">{e.mensagemCidadao}</p>
              <time className="mensagem-hora" dateTime={e.em} title={completa}>
                {tempoRelativo(e.em, agora)}
              </time>
              <details>
                <summary>Ver detalhes</summary>
                <p className="mensagem-detalhe">
                  {rotuloClasse(e.classe)} · {rotuloSink(e.sink)} · {rotuloDecisao(e.decisao)}
                </p>
                <p className="mensagem-detalhe">{completa}</p>
              </details>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
