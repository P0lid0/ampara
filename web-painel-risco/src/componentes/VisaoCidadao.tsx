import { useEffect, useRef, useState } from "react";
import { NaoAutorizado, meuRisco } from "../api";
import type { MeuRisco } from "../tipos";
import { Farol } from "./Farol";
import { Mensagens } from "./Mensagens";

const INTERVALO_MS = 5000;

export function VisaoCidadao({ token, aoExpirar }: { token: string; aoExpirar?: () => void }) {
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
  }, [token]);

  return (
    <section aria-labelledby="titulo-cidadao">
      <h2 id="titulo-cidadao">Seus dados nas últimas 24 horas</h2>
      <div aria-live="polite">
        {falhou && <p className="aviso">Não consegui atualizar agora. Tentando de novo.</p>}
        {dados ? (
          <>
            <Farol farol={dados.farol} indice={dados.indice} />
            <Mensagens eventos={dados.eventos} />
          </>
        ) : (
          !falhou && <p className="vazio">Carregando…</p>
        )}
      </div>
    </section>
  );
}
