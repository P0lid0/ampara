const NOMES = ["Avisar", "Marcar o local", "BO"] as const;

/** Indicador "Passo N de 3": três segmentos e a frase, para a pessoa saber onde está e quanto falta. */
export function Etapas({ passo }: { passo: 1 | 2 | 3 }) {
  return (
    <div className="etapas">
      <div className="etapas-barras" aria-hidden="true">
        {NOMES.map((n, i) => (
          <span key={n} className={i + 1 <= passo ? "etapa-feita" : ""} />
        ))}
      </div>
      <p className="apoio">
        Passo {passo} de 3 <span aria-hidden="true">·</span> {NOMES[passo - 1]}
      </p>
    </div>
  );
}
