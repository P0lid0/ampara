import { useCallback, useState } from "react";
import { lerSessao, sair } from "./sessao/sessao";
import { Login, MSG_SESSAO_VENCIDA } from "./telas/Login";
import { LinhaDoTempo } from "./telas/LinhaDoTempo";
import { Painel } from "./telas/Painel";

type Tela = "login" | "painel" | "rota" | "bo";

export function App() {
  const [tela, setTela] = useState<Tela>(() => (lerSessao() ? "painel" : "login"));
  const [aviso, setAviso] = useState<string | undefined>();
  const [ocorrenciaId, setOcorrenciaId] = useState<string | null>(null);

  const sairDaAba = useCallback(() => {
    sair();
    setAviso(undefined);
    setOcorrenciaId(null);
    setTela("login");
  }, []);
  const vencida = useCallback(() => {
    sair();
    setAviso(MSG_SESSAO_VENCIDA);
    setOcorrenciaId(null);
    setTela("login");
  }, []);

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
        <LinhaDoTempo
          ocorrenciaId={ocorrenciaId}
          aoVoltar={() => setTela("painel")}
          aoSessaoVencida={vencida}
          aoBo={(id) => { setOcorrenciaId(id); setTela("bo"); }}
        />
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
