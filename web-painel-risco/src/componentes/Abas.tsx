import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface Aba {
  id: string;
  rotulo: string;
  conteudo: ReactNode;
}

export function Abas({ abas, ativa, aoMudar }: { abas: Aba[]; ativa: string; aoMudar: (id: string) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mover = (e: KeyboardEvent, i: number) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const alvo = abas[(i + delta + abas.length) % abas.length];
    aoMudar(alvo.id);
    refs.current[alvo.id]?.focus();
  };
  const atual = abas.find((a) => a.id === ativa) ?? abas[0];
  return (
    <>
      <div role="tablist" aria-label="Visões do painel" className="abas">
        {abas.map((a, i) => (
          <button
            key={a.id}
            ref={(el) => {
              refs.current[a.id] = el;
            }}
            role="tab"
            id={`aba-${a.id}`}
            aria-selected={a.id === atual.id}
            aria-controls={`painel-${a.id}`}
            tabIndex={a.id === atual.id ? 0 : -1}
            className="aba"
            onClick={() => aoMudar(a.id)}
            onKeyDown={(e) => mover(e, i)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`painel-${atual.id}`} aria-labelledby={`aba-${atual.id}`}>
        {atual.conteudo}
      </div>
    </>
  );
}
