import { useEffect, useState } from "react";
import { lerSessao } from "../sessao/sessao";
import { IconeSair, Marca } from "./Icones";

/** Minutos que faltam (arredondado para cima; nunca 0 enquanto a sessão vale). */
export function minutosRestantes(expiraEm: string, agora: number = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(expiraEm) - agora) / 60000));
}

/**
 * Faixa de marca em largura total: selo de confiança para quem está no celular de outra pessoa.
 * Mostra o tempo da sessão de 30 min e, quando há `aoSair`, a saída que apaga os dados deste aparelho.
 */
export function FaixaDeMarca({ aoSair }: { aoSair?: () => void }) {
  // Lê a sessão uma vez ao montar; o relógio só recalcula a conta, nunca remove nada do sessionStorage.
  const [expiraEm] = useState(() => (aoSair ? lerSessao()?.expiraEm ?? null : null));
  const [minutos, setMinutos] = useState(() => (expiraEm ? minutosRestantes(expiraEm) : null));

  useEffect(() => {
    if (!expiraEm) return;
    const t = setInterval(() => setMinutos(minutosRestantes(expiraEm)), 15000);
    return () => clearInterval(t);
  }, [expiraEm]);

  return (
    <header className="faixa">
      <div className="faixa-miolo">
        <span className="faixa-nome">
          <Marca />
          Ampara
        </span>
        {minutos !== null && <span className="faixa-sessao">Sessão: {minutos} min</span>}
        {aoSair && (
          <button type="button" className="faixa-sair" aria-label="Sair e apagar tudo desta aba" onClick={aoSair}>
            <IconeSair tamanho={20} />
            Sair
          </button>
        )}
      </div>
    </header>
  );
}
