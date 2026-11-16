import { useEffect, useRef } from 'react';
import { alertaEmDestaque } from './alarmeEstado';
import type { useAlarmes } from './store';

type RouterLike = { push(href: string): void };

/**
 * Leva à tela de alarme quando o alerta em destaque muda (usado no _layout).
 * Navega uma vez por alertaId: o mesmo alerta continuando em destaque não reabre a tela.
 * `habilitado=false` (sessão ou navegação ainda não prontas) adia a navegação.
 */
export function useRedirecionarParaAlarme(store: typeof useAlarmes, router: RouterLike, habilitado = true): void {
  const alertaId = store((s) => alertaEmDestaque(s.estado)?.alertaId);
  const ultimo = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!habilitado || !alertaId || alertaId === ultimo.current) return;
    ultimo.current = alertaId;
    router.push(`/guardiao/alarme?alertaId=${encodeURIComponent(alertaId)}`);
  }, [habilitado, alertaId, router]);
}
