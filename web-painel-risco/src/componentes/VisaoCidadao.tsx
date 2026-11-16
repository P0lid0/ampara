import { useEffect, useRef, useState } from "react";
import { NaoAutorizado, meuRisco } from "../api";
import type { MeuRisco } from "../tipos";
import { Farol } from "./Farol";
import { IconeAtencao } from "./Icones";
import { Mensagens } from "./Mensagens";

const INTERVALO_MS = 5000;

export function VisaoCidadao({ token, aoExpirar, recarregar = 0 }: { token: string; aoExpirar?: () => void; recarregar?: number }) {
  const [dados, setDados] = useState<MeuRisco | null>(null);
  const [falhou, setFalhou] = useState(false);
  const expirar = useRef(aoExpirar);
  expirar.current = aoExpirar;
  const sequencia = useRef(0);

  useEffect(() => {
    let ativo = true;
    const atualizar = async () => {
      const minha = ++sequencia.current;
      try {
        const r = await meuRisco(token);
        if (!ativo || minha !== sequencia.current) return;
        setDados(r);
        setFalhou(false);
      } catch (e) {
        if (!ativo || minha !== sequencia.current) return;
        if (e instanceof NaoAutorizado) expirar.current?.();
        else setFalhou(true);
      }
    };
    void atualizar();
    const id = setInterval(() => void atualizar(), INTERVALO_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [token, recarregar]);

  return (
    <section aria-labelledby="titulo-cidadao">
      <h1 id="titulo-cidadao">Seus dados nas últimas 24 horas</h1>
      {/* Só o farol é região viva: a lista não é relida a cada 5 s. */}
      <div className="farol-regiao" aria-live="polite">
        {dados ? (
          <Farol farol={dados.farol} indice={dados.indice} />
        ) : (
          !falhou && <p className="vazio">Carregando…</p>
        )}
        <p className="atualizacao" data-falhou={falhou}>
          {falhou ? (
            <>
              <IconeAtencao tamanho={20} />
              Não consegui atualizar agora. Tentando de novo.
            </>
          ) : (
            "Atualiza sozinho a cada 5 segundos."
          )}
        </p>
      </div>
      {dados && <Mensagens eventos={dados.eventos} />}
    </section>
  );
}
