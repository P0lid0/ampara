import { useCallback, useEffect, useState } from "react";
import { lerSessao, sair } from "./sessao/sessao";
import { Login, MSG_SESSAO_VENCIDA } from "./telas/Login";
import { Bo } from "./telas/Bo";
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

  // Item 13: passados os 30 min a tela volta sozinha ao login (o texto do BO, com IMEI, sai da tela), sem
  // esperar um clique que faça chamada à API. Ao voltar para a aba confere de novo: timers de aba em segundo
  // plano podem ficar congelados (iOS).
  const logado = tela !== "login";
  useEffect(() => {
    if (!logado) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const agendar = () => {
      if (timer) clearTimeout(timer);
      const s = lerSessao();
      if (!s) {
        vencida();
        return;
      }
      timer = setTimeout(agendar, Math.min(Math.max(0, Date.parse(s.expiraEm) - Date.now()), 2 ** 31 - 1));
    };
    const aoVoltarParaAba = () => {
      if (document.visibilityState !== "hidden") agendar();
    };
    agendar();
    document.addEventListener("visibilitychange", aoVoltarParaAba);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoVoltarParaAba);
    };
  }, [logado, vencida]);

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
          aoSair={sairDaAba}
          aoBo={(id) => { setOcorrenciaId(id); setTela("bo"); }}
        />
      )}
      {tela === "bo" && (
        // Voltar do BO leva à rota (item 14), que mostra o momento já marcado e "Gerar o BO" de novo.
        <Bo ocorrenciaId={ocorrenciaId} aoVoltar={() => setTela("rota")} aoSessaoVencida={vencida} aoSair={sairDaAba} />
      )}
    </>
  );
}
