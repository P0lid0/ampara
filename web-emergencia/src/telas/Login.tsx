import { useState, type FormEvent } from "react";
import { ApiErro, api } from "../api/cliente";
import { FaixaDeMarca } from "../componentes/FaixaDeMarca";
import { IconeAjuda, IconeAlerta, IconeOlho, IconeOlhoRiscado } from "../componentes/Icones";
import { salvarSessao } from "../sessao/sessao";

export const MSG_SESSAO_VENCIDA = "Sua sessão de emergência acabou (30 minutos). Entre de novo.";

export function Login({ aoEntrar, aviso }: { aoEntrar: () => void; aviso?: string }) {
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [palavraSecreta, setPalavraSecreta] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [verSenha, setVerSenha] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const t = await api.autenticar({ email: email.trim(), codigo: codigo.trim(), palavraSecreta });
      salvarSessao(t);
      aoEntrar();
    } catch (x) {
      const status = x instanceof ApiErro ? x.status : 0;
      if (status === 429) setErro("Muitas tentativas erradas. Aguarde 15 minutos e tente de novo.");
      // 400, 401 e 404 dizem a mesma frase: não revelar se o e-mail existe.
      else if (status === 401 || status === 404 || status === 400) setErro("Dados incorretos.");
      // Outros 4xx (ex.: 403, 422): a frase da API, nunca "confira a conexão", que mentiria sobre a causa.
      else if (status >= 400 && status < 500)
        setErro((x instanceof ApiErro && x.detalheCidadao) || "Não foi possível entrar com esses dados. Tente de novo.");
      else if (status === 0) setErro("Não foi possível entrar agora. Confira a conexão e tente de novo.");
      else setErro((x instanceof ApiErro && x.detalheCidadao) || "Não foi possível entrar agora. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <FaixaDeMarca />
      <main className="tela entrada-tela">
        <div className="cabeca">
          <h1>Avise quem cuida de você</h1>
          <p className="lead">Use este acesso se o seu celular foi roubado. Entre com o código e a palavra secreta que você cadastrou no app.</p>
        </div>
        {aviso && (
          <div className="aviso" role="status">
            <div className="aviso-linha">
              <IconeAlerta />
              <p>{aviso}</p>
            </div>
          </div>
        )}
        <form className="login tela-form" onSubmit={enviar} aria-describedby={erro ? "erro-login" : undefined}>
          <div className="campo">
            <label htmlFor="campo-email">E-mail</label>
            <input id="campo-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={erro ? true : undefined} />
          </div>
          <div className="campo">
            <label htmlFor="campo-codigo">Código de emergência</label>
            <input
              id="campo-codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              aria-invalid={erro ? true : undefined}
            />
            <p className="ajuda">6 números que você criou no app.</p>
          </div>
          <div className="campo">
            <label htmlFor="campo-palavra">Palavra secreta</label>
            <div className="campo-senha">
              <input
                id="campo-palavra"
                type={verSenha ? "text" : "password"}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={palavraSecreta}
                onChange={(e) => setPalavraSecreta(e.target.value)}
                aria-invalid={erro ? true : undefined}
              />
              <button
                type="button"
                className="campo-olho"
                aria-label={verSenha ? "Ocultar o que digitei" : "Mostrar o que digitei"}
                aria-pressed={verSenha}
                onClick={() => setVerSenha((v) => !v)}
              >
                {verSenha ? <IconeOlhoRiscado /> : <IconeOlho />}
              </button>
            </div>
          </div>
          {erro && (
            <p className="erro" id="erro-login" role="alert">
              <IconeAlerta />
              <span>{erro}</span>
            </p>
          )}
          <button type="submit" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
        </form>
        <details className="ajuda-login">
          <summary>
            <IconeAjuda />
            Não achei meu código
          </summary>
          <p className="apoio">
            Você criou o código (6 números) e a palavra secreta ao configurar o app Ampara. Se não lembra, ligue para um guardião: ele pode acionar o alarme pelo app dele.
          </p>
        </details>
      </main>
    </>
  );
}
