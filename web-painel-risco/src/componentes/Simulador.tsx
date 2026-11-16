import { useState } from "react";
import { NaoAutorizado, NaoEncontrado, simular } from "../api";
import { IconeAtencao, IconeEnviado } from "./Icones";

const CENARIOS = [
  { id: "cpf-no-log", rotulo: "Vazar CPF no log" },
  { id: "senha-na-resposta", rotulo: "Senha na resposta pública" },
  { id: "laudo-no-erro", rotulo: "Laudo em erro do sistema" },
  { id: "acesso-indevido", rotulo: "Acesso indevido" },
];

export function Simulador({ token, aoSimular, aoExpirar }: { token: string; aoSimular: () => void; aoExpirar?: () => void }) {
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");
  const [ocupado, setOcupado] = useState("");

  const disparar = async (cenario: { id: string; rotulo: string }) => {
    setOcupado(cenario.id);
    setMsg("");
    setOk("");
    try {
      await simular(token, cenario.id);
      setOk(`Disparado: ${cenario.rotulo}. O farol atualiza em instantes.`);
      aoSimular();
    } catch (e) {
      if (e instanceof NaoAutorizado) aoExpirar?.();
      else if (e instanceof NaoEncontrado) setMsg("Demonstração desligada neste servidor.");
      else setMsg("Não consegui simular agora. Tente de novo.");
    } finally {
      setOcupado("");
    }
  };

  return (
    <details className="simulador">
      <summary>
        <span className="simulador-faixa">DEMONSTRAÇÃO</span>
        <span>Simular um ataque</span>
      </summary>
      <div className="simulador-corpo" aria-labelledby="titulo-simulador" role="group">
        <p id="titulo-simulador">Só para a apresentação: cada botão aciona o fluxo real de proteção com dados sintéticos e o farol reage. Nada disso aconteceu de verdade.</p>
        <div className="simulador-botoes">
          {CENARIOS.map((c) => (
            <button key={c.id} type="button" className={`botao botao-contorno${ocupado === c.id ? " carregando" : ""}`} disabled={ocupado !== ""} onClick={() => void disparar(c)}>
              {c.rotulo}
            </button>
          ))}
        </div>
        <div aria-live="polite" className="simulador-status">
          {ok && (
            <>
              <IconeEnviado tamanho={20} />
              <span>{ok}</span>
            </>
          )}
          {msg && (
            <p className="aviso" style={{ margin: 0 }}>
              <IconeAtencao tamanho={20} />
              {msg}
            </p>
          )}
        </div>
      </div>
    </details>
  );
}
