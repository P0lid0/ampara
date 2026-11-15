import { useState, type FormEvent } from "react";
import { ApiErro, api } from "../api/cliente";
import { salvarSessao } from "../sessao/sessao";

export const MSG_SESSAO_VENCIDA = "Sua sessão de emergência acabou (30 minutos). Entre de novo.";

export function Login({ aoEntrar, aviso }: { aoEntrar: () => void; aviso?: string }) {
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [palavraSecreta, setPalavraSecreta] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

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
      else if (status === 401 || status === 404 || status === 400) setErro("Dados incorretos.");
      else setErro("Não foi possível entrar agora. Confira a conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="tela">
      <h1>Ampara — Emergência</h1>
      <p>Use este acesso se o seu celular foi roubado. Entre com o código e a palavra secreta que você cadastrou no app.</p>
      {aviso && <p className="aviso" role="status">{aviso}</p>}
      <form className="login" onSubmit={enviar}>
        <label>
          E-mail
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Código de emergência
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </label>
        <label>
          Palavra secreta
          <input type="password" autoComplete="off" required value={palavraSecreta} onChange={(e) => setPalavraSecreta(e.target.value)} />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button type="submit" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
      </form>
    </main>
  );
}
