import { FormEvent, useEffect, useRef, useState } from "react";
import { NaoAutorizado, login } from "../api";

export function Login({ aoEntrar, aviso }: { aoEntrar: (token: string) => void; aviso?: string }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
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
      <h1 ref={titulo} tabIndex={-1}>Risco Cidadão</h1>
      <div aria-live="polite">{aviso && <p className="aviso">{aviso}</p>}</div>
      <label>
        E-mail
        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Senha
        <input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
      </label>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <button type="submit" disabled={enviando}>Entrar</button>
    </form>
  );
}
