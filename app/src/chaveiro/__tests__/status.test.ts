import type { ChaveiroDto } from '../../api/tipos';
import { deveAvisarBateria, rotuloStatus } from '../status';

const AGORA = new Date('2026-11-15T12:00:00Z');
const antes = (s: number) => new Date(AGORA.getTime() - s * 1000).toISOString();
const C = (o: Partial<ChaveiroDto> = {}): ChaveiroDto => ({ deviceId: 'chaveiro-0001', online: true, bateria: 80, vistoEm: antes(10), ...o });
const SEM_BATERIA = null;

describe('rotuloStatus', () => {
  it('online e visto há 10 s é "Conectado"', () => {
    const r = rotuloStatus(C(), AGORA);
    expect(r.estado).toBe('online');
    expect(r.texto).toContain('Conectado');
    expect(r.bateriaBaixa).toBe(false);
  });

  it('online=true mas visto há 120 s é "Sem conexão" (limite 90 s)', () => {
    const r = rotuloStatus(C({ vistoEm: antes(120) }), AGORA);
    expect(r.estado).toBe('offline');
    expect(r.texto).toContain('Sem conexão');
  });

  it('visto há exatamente 90 s ainda conta como conectado; 91 s não', () => {
    expect(rotuloStatus(C({ vistoEm: antes(90) }), AGORA).estado).toBe('online');
    expect(rotuloStatus(C({ vistoEm: antes(91) }), AGORA).estado).toBe('offline');
  });

  it('online=false é offline mesmo visto agora', () => {
    expect(rotuloStatus(C({ online: false, vistoEm: antes(1) }), AGORA).estado).toBe('offline');
  });

  it('data inválida conta como offline', () => {
    expect(rotuloStatus(C({ vistoEm: 'ontem' }), AGORA).estado).toBe('offline');
  });

  it('bateria 12 marca bateriaBaixa e o texto traz "Bateria baixa (12%)"', () => {
    const r = rotuloStatus(C({ bateria: 12 }), AGORA);
    expect(r.bateriaBaixa).toBe(true);
    expect(r.texto).toContain('Bateria baixa (12%)');
  });

  it('bateria 15 não é baixa e mostra a porcentagem', () => {
    const r = rotuloStatus(C({ bateria: 15 }), AGORA);
    expect(r.bateriaBaixa).toBe(false);
    expect(r.texto).toContain('Bateria: 15%');
  });

  it('bateria null mostra "Bateria: não informada" e não é baixa', () => {
    const r = rotuloStatus(C({ bateria: SEM_BATERIA }), AGORA);
    expect(r.bateriaBaixa).toBe(false);
    expect(r.texto).toContain('Bateria: não informada');
  });

  it('sem chaveiro (null) fica offline com a frase de nenhum chaveiro', () => {
    const r = rotuloStatus(null, AGORA);
    expect(r.estado).toBe('offline');
    expect(r.texto).toBe('Nenhum chaveiro pareado.');
    expect(r.bateriaBaixa).toBe(false);
  });
});

describe('deveAvisarBateria', () => {
  const HORA = 3600_000;
  it('14 e nunca avisou: avisa', () => {
    expect(deveAvisarBateria(C({ bateria: 14 }), null, AGORA)).toBe(true);
  });
  it('15: não avisa', () => {
    expect(deveAvisarBateria(C({ bateria: 15 }), null, AGORA)).toBe(false);
  });
  it('14 avisado há 1 h: não avisa', () => {
    expect(deveAvisarBateria(C({ bateria: 14 }), new Date(AGORA.getTime() - HORA), AGORA)).toBe(false);
  });
  it('14 avisado há 6 h exatas: ainda não; há mais de 6 h: avisa', () => {
    expect(deveAvisarBateria(C({ bateria: 14 }), new Date(AGORA.getTime() - 6 * HORA), AGORA)).toBe(false);
    expect(deveAvisarBateria(C({ bateria: 14 }), new Date(AGORA.getTime() - 6 * HORA - 1), AGORA)).toBe(true);
  });
  it('bateria null não avisa', () => {
    expect(deveAvisarBateria(C({ bateria: SEM_BATERIA }), null, AGORA)).toBe(false);
  });
});
