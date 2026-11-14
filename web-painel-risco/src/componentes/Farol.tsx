import type { FarolCor } from "../tipos";

const TEXTO: Record<FarolCor, { palavra: string; icone: string }> = {
  verde: { palavra: "Seguro", icone: "✔" },
  amarelo: { palavra: "Atenção", icone: "!" },
  vermelho: { palavra: "Risco alto", icone: "✖" },
};

export function Farol({ farol, indice }: { farol: FarolCor; indice: number }) {
  const t = TEXTO[farol];
  return (
    <div role="status" className={`farol farol-${farol}`}>
      <span className="farol-icone" aria-hidden="true">{t.icone}</span>
      <span className="farol-palavra">{t.palavra}</span>
      <span className="farol-indice">{indice}/100</span>
    </div>
  );
}
