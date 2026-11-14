import { useCallback, useState } from "react";
import { Login } from "./componentes/Login";
import { VisaoCidadao } from "./componentes/VisaoCidadao";

const CHAVE = "ampara.painel.token";

export function lerToken(): string | null {
  try {
    return sessionStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

export function gravarToken(t: string | null) {
  try {
    if (t) sessionStorage.setItem(CHAVE, t);
    else sessionStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento: o token fica só em memória */
  }
}

export default function App() {
  const [token, setToken] = useState<string | null>(lerToken);
  const [aviso, setAviso] = useState("");

  const entrar = (t: string) => {
    gravarToken(t);
    setAviso("");
    setToken(t);
  };
  const sair = useCallback(() => {
    gravarToken(null);
    setAviso("Sua sessão terminou. Entre de novo.");
    setToken(null);
  }, []);

  return (
    <main>
      <header className="topo">Ampara · Risco Cidadão</header>
      {token ? <VisaoCidadao token={token} aoExpirar={sair} /> : <Login aoEntrar={entrar} aviso={aviso} />}
    </main>
  );
}
