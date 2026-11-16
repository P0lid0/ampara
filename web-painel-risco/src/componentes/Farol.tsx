import type { ReactNode } from "react";
import type { FarolCor } from "../tipos";
import { IconeAlto, IconeAtencao, IconeSeguro } from "./Icones";

const TEXTO: Record<FarolCor, { palavra: string; icone: ReactNode; orientacao: string; proximo?: string }> = {
  verde: {
    palavra: "Seguro",
    icone: <IconeSeguro tamanho={36} />,
    orientacao: "Nada de estranho nas últimas 24 horas. Você não precisa fazer nada.",
  },
  amarelo: {
    palavra: "Atenção",
    icone: <IconeAtencao tamanho={36} />,
    orientacao: "Barramos tentativas de usar seus dados. Dê uma olhada nas mensagens abaixo.",
  },
  vermelho: {
    palavra: "Risco alto",
    icone: <IconeAlto tamanho={36} />,
    orientacao: "Detectamos tentativas graves de expor seus dados.",
    proximo: "Leia as mensagens abaixo. Se você não reconhece o que aconteceu, avise um guardião ou abra o Ampara e peça ajuda.",
  },
};

export function Farol({ farol, indice }: { farol: FarolCor; indice: number }) {
  const t = TEXTO[farol];
  const largura = Math.max(0, Math.min(100, indice));
  return (
    <div role="status" className={`farol farol-${farol}`}>
      <div className="farol-topo">
        <span className="farol-icone">{t.icone}</span>
        <span className="farol-palavra">{t.palavra}</span>
        <span className="farol-indice">{indice}/100</span>
      </div>
      <p className="farol-orientacao">{t.orientacao}</p>
      <div className="farol-escala">
        <span className="farol-trilho" aria-hidden="true">
          <span className="farol-preenchimento" style={{ width: `${largura}%` }} />
        </span>
        <p className="farol-legenda">Quanto maior o número, mais exposto você está.</p>
      </div>
      {t.proximo && (
        <p className="farol-proximo">
          <strong>O que fazer agora</strong>
          {t.proximo}
        </p>
      )}
    </div>
  );
}
