import { useCallback, useState } from "react";
import { Marca } from "./componentes/Marca";
import { Login } from "./componentes/Login";
import { Abas } from "./componentes/Abas";
import { Simulador } from "./componentes/Simulador";
import { VisaoCidadao } from "./componentes/VisaoCidadao";
import { VisaoExecutiva } from "./componentes/VisaoExecutiva";

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
  const [aba, setAba] = useState("cidadao");
  const [recarregar, setRecarregar] = useState(0);

  const entrar = (t: string) => {
    gravarToken(t);
    setAviso("");
    setToken(t);
  };
  const encerrar = useCallback((mensagem: string) => {
    gravarToken(null);
    setAviso(mensagem);
    setToken(null);
    setAba("cidadao");
  }, []);
  // Sessão vencida (401 em qualquer tela) ou saída pedida pela pessoa no cabeçalho.
  const sair = useCallback(() => encerrar("Sua sessão terminou. Entre de novo."), [encerrar]);
  const sairAgora = useCallback(() => encerrar("Você saiu do painel."), [encerrar]);

  return (
    <>
      <header className="topo">
        <div className="topo-interno">
          <Marca />
          <span className="topo-visao">Painel de risco</span>
          {token && (
            <button type="button" className="sair" onClick={sairAgora}>
              Sair
            </button>
          )}
        </div>
      </header>
      <main className={token && aba === "executiva" ? "larga" : undefined}>
      {token ? (
        <Abas
          ativa={aba}
          aoMudar={setAba}
          abas={[
            {
              id: "cidadao",
              rotulo: "Meu risco",
              conteudo: (
                <>
                  <VisaoCidadao token={token} aoExpirar={sair} recarregar={recarregar} />
                  <Simulador token={token} aoExpirar={sair} aoSimular={() => setRecarregar((n) => n + 1)} />
                </>
              ),
            },
            { id: "executiva", rotulo: "Visão executiva", conteudo: <VisaoExecutiva token={token} aoExpirar={sair} /> },
          ]}
        />
      ) : (
        <Login aoEntrar={entrar} aviso={aviso} />
      )}
      </main>
    </>
  );
}
