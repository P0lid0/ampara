// Datas e horas para as telas, sempre no fuso de São Paulo (mesmo fuso do resto do app).
import { FUSO_PADRAO } from '../rota/linhaDoTempo';

/** "2026-11-12T20:00:00Z" -> "12/11"; instante inválido -> "". */
export function dataCurta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { timeZone: FUSO_PADRAO, day: '2-digit', month: '2-digit' });
}
