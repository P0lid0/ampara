// A sessão de emergência vive só na aba (sessionStorage): fechar a aba apaga tudo. Nada em localStorage.
// Só a chave desta página é apagada: o painel de risco (/painel-risco/) usa a mesma origem e o mesmo sessionStorage.
const CHAVE = "ampara.emergencia";

export type SessaoEmergencia = { token: string; expiraEm: string };

export function salvarSessao(t: SessaoEmergencia): void {
  sessionStorage.setItem(CHAVE, JSON.stringify({ token: t.token, expiraEm: t.expiraEm }));
}

export function lerSessao(agora: Date = new Date()): SessaoEmergencia | null {
  const bruto = sessionStorage.getItem(CHAVE);
  if (!bruto) return null;
  try {
    const s = JSON.parse(bruto) as SessaoEmergencia;
    const fim = Date.parse(s.expiraEm);
    if (typeof s.token !== "string" || Number.isNaN(fim) || fim <= agora.getTime()) {
      sessionStorage.removeItem(CHAVE);
      return null;
    }
    return s;
  } catch {
    sessionStorage.removeItem(CHAVE);
    return null;
  }
}

export function sair(): void {
  sessionStorage.removeItem(CHAVE);
}
