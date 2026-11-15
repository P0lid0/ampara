import { useState } from "react";
import { NaoAutorizado, NaoEncontrado, simular } from "../api";

const CENARIOS = [
  { id: "cpf-no-log", rotulo: "Vazar CPF no log" },
  { id: "senha-na-resposta", rotulo: "Senha na resposta pública" },
  { id: "laudo-no-erro", rotulo: "Laudo em erro do sistema" },
  { id: "acesso-indevido", rotulo: "Acesso indevido" },
];

export function Simulador({ token, aoSimular, aoExpirar }: { token: string; aoSimular: () => void; aoExpirar?: () => void }) {
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const disparar = async (cenario: string) => {
    setOcupado(true);
    setMsg("");
    try {
      await simular(token, cenario);
      aoSimular();
    } catch (e) {
      if (e instanceof NaoAutorizado) aoExpirar?.();
      else if (e instanceof NaoEncontrado) setMsg("Demonstração desligada neste servidor.");
      else setMsg("Não consegui simular agora. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="simulador" aria-labelledby="titulo-simulador">
      <h2 id="titulo-simulador">Simular um ataque</h2>
      <p>Para a demonstração: cada botão cria um evento de segurança de mentira e o farol reage.</p>
      <div className="simulador-botoes">
        {CENARIOS.map((c) => (
          <button key={c.id} type="button" className="botao" disabled={ocupado} onClick={() => void disparar(c.id)}>
            {c.rotulo}
          </button>
        ))}
      </div>
      <div aria-live="polite">
        {msg && <p className="aviso">{msg}</p>}
      </div>
    </section>
  );
}
