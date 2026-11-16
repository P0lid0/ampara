import { FormEvent, useEffect, useRef, useState } from "react";
import { NaoAutorizado, login } from "../api";
import { IconeAtencao } from "./Icones";

export function Login({ aoEntrar, aviso }: { aoEntrar: (token: string) => void; aviso?: string }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);

  // A tela anterior foi desmontada (sessão vencida): o foco vai ao título para o leitor de tela anunciar o aviso.
  useEffect(() => {
    if (aviso) titulo.current?.focus();
  }, [aviso]);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      aoEntrar(await login(email, senha));
    } catch (e) {
      setErro(
        e instanceof NaoAutorizado
          ? "E-mail ou senha não conferem. Tente de novo."
          : "Não consegui entrar agora. Tente de novo em instantes.",
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="login" onSubmit={enviar}>
      <h1 ref={titulo} tabIndex={-1}>Veja se seus dados estão protegidos</h1>
      <p className="login-frase">Entre para ver o que o Ampara barrou nas últimas 24 horas e o que fazer se algo estiver errado.</p>
      <div aria-live="polite">
        {aviso && (
          <p className="aviso">
            <IconeAtencao tamanho={20} />
            {aviso}
          </p>
        )}
      </div>
      <label>
        E-mail
        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={erro ? true : undefined} required />
      </label>
      <div>
        <label htmlFor="campo-senha">Senha</label>
        <div className="campo-senha">
          <input
            id="campo-senha"
            type={verSenha ? "text" : "password"}
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            aria-invalid={erro ? true : undefined}
            required
          />
          <button type="button" className="olho" aria-controls="campo-senha" onClick={() => setVerSenha((v) => !v)}>
            {verSenha ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>
      {erro && (
        <p className="erro" role="alert">
          <IconeAtencao tamanho={20} />
          {erro}
        </p>
      )}
      <button type="submit" disabled={enviando} className={enviando ? "carregando" : undefined}>
        {enviando ? "Entrando" : "Entrar"}
      </button>
      <p className="login-garantia">A sessão fecha quando você fecha esta janela.</p>
    </form>
  );
}
