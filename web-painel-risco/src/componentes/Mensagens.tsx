import type { EventoCidadao } from "../tipos";
import { rotuloClasse, rotuloDecisao, rotuloSink } from "../rotulos";

export function Mensagens({ eventos }: { eventos: EventoCidadao[] }) {
  if (eventos.length === 0) {
    return <p className="vazio">Nada de estranho nas últimas 24 horas. Está tudo certo com seus dados.</p>;
  }
  return (
    <ol className="mensagens">
      {eventos.map((e) => (
        <li key={e.id} className="mensagem">
          <p className="mensagem-texto">{e.mensagemCidadao}</p>
          <p className="mensagem-detalhe">
            {rotuloClasse(e.classe)} · {rotuloSink(e.sink)} · {rotuloDecisao(e.decisao)}
          </p>
          <time className="mensagem-hora" dateTime={e.em}>
            {new Date(e.em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          </time>
        </li>
      ))}
    </ol>
  );
}
