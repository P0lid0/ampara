import { useState } from "react";
import { lerSessao, sair } from "./sessao/sessao";
import { Login, MSG_SESSAO_VENCIDA } from "./telas/Login";
import { Painel } from "./telas/Painel";

type Tela = "login" | "painel" | "rota" | "bo";

export function App() {
  const [tela, setTela] = useState<Tela>(() => (lerSessao() ? "painel" : "login"));
  const [aviso, setAviso] = useState<string | undefined>();
  const [ocorrenciaId, setOcorrenciaId] = useState<string | null>(null);

  const sairDaAba = () => {
    sair();
    setAviso(undefined);
    setOcorrenciaId(null);
    setTela("login");
  };
  const vencida = () => {
    sair();
    setAviso(MSG_SESSAO_VENCIDA);
    setOcorrenciaId(null);
    setTela("login");
  };

  if (tela === "login") {
    return <Login aviso={aviso} aoEntrar={() => { setAviso(undefined); setTela("painel"); }} />;
  }

  return (
    <>
      {tela === "painel" && (
        <Painel
          aoSair={sairDaAba}
          aoSessaoVencida={vencida}
          aoMarcar={(id) => { setOcorrenciaId(id); setTela("rota"); }}
        />
      )}
      {tela === "rota" && (
        <main className="tela">
          <h1>Onde foi roubado</h1>
          <p>O mapa com o seu trajeto chega na próxima etapa.</p>
          <p className="discreto">Ocorrência {ocorrenciaId}</p>
          <button type="button" onClick={() => setTela("painel")}>Voltar</button>
          <button type="button" className="secundario sair" onClick={sairDaAba}>Sair e apagar tudo desta aba</button>
        </main>
      )}
      {tela === "bo" && (
        <main className="tela">
          <h1>Boletim de ocorrência</h1>
          <button type="button" onClick={() => setTela("painel")}>Voltar</button>
        </main>
      )}
    </>
  );
}
