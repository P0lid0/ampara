import {
  celulasComDado, consultaRisco, diaDe, faixaDe, idadeRelato, relatoVisivel, rotuloClasse, semDado,
} from '../risco';
import type { RiscoDto } from '../../api/tipos';

const BBOX = { minLat: -23.6, minLng: -46.7, maxLat: -23.5, maxLng: -46.6 };

describe('faixa e dia (São Paulo)', () => {
  it('faixaDe: 02:59 → 0, 03:00 → 1, 21:00 → 7', () => {
    expect(faixaDe(new Date('2026-11-14T02:59:00-03:00'))).toBe(0);
    expect(faixaDe(new Date('2026-11-14T03:00:00-03:00'))).toBe(1);
    expect(faixaDe(new Date('2026-11-14T21:00:00-03:00'))).toBe(7);
  });
  it('usa a hora de São Paulo, não a UTC (01:30Z do dia 14 é 22:30 do dia 13)', () => {
    expect(faixaDe(new Date('2026-11-14T01:30:00Z'))).toBe(7);
    expect(diaDe(new Date('2026-11-14T01:30:00Z'))).toBe(4); // sexta 13
  });
  it('diaDe: sábado === 5, segunda === 0, domingo === 6', () => {
    expect(diaDe(new Date('2026-11-14T12:00:00-03:00'))).toBe(5);
    expect(diaDe(new Date('2026-11-16T12:00:00-03:00'))).toBe(0);
    expect(diaDe(new Date('2026-11-15T12:00:00-03:00'))).toBe(6);
  });
  it('consultaRisco gera dia e faixa do instante dado', () => {
    expect(consultaRisco(BBOX, new Date('2026-11-14T21:30:00-03:00'))).toEqual({ bbox: BBOX, dia: 5, faixa: 7 });
  });
});

describe('rótulos', () => {
  it('rotuloClasse não contém "perigos" e os 3 rótulos são distintos', () => {
    const r = (['baixo', 'medio', 'alto'] as const).map(rotuloClasse);
    expect(r).toEqual(['Atenção normal', 'Atenção redobrada', 'Atenção máxima neste horário']);
    expect(new Set(r).size).toBe(3);
    r.forEach((t) => expect(t.toLowerCase()).not.toContain('perigos'));
  });
});

describe('relatos', () => {
  const agora = new Date('2026-11-14T15:00:00Z');
  const atras = (min: number) => new Date(agora.getTime() - min * 60000).toISOString();
  it('relatoVisivel: 119 min → true, 121 min → false; data inválida → false', () => {
    expect(relatoVisivel(atras(119), agora)).toBe(true);
    expect(relatoVisivel(atras(121), agora)).toBe(false);
    expect(relatoVisivel('lixo', agora)).toBe(false);
  });
  it('idadeRelato(12 min) === "há 12 min"', () => {
    expect(idadeRelato(atras(12), agora)).toBe('há 12 min');
    expect(idadeRelato(atras(0), agora)).toBe('agora há pouco');
    expect(idadeRelato(atras(90), agora)).toBe('há 1 h 30 min');
  });
});

describe('sem dado', () => {
  const resp: RiscoDto[] = [{ areaId: 'g051_026', lat: -23.5696, lng: -46.7019, classe: 'baixo', probAlto: 0.01 }];
  it('área ausente é "sem dado"; célula devolvida como baixo NÃO é sem dado', () => {
    expect(semDado('g051_026', [])).toBe(true);
    expect(semDado('g051_026', resp)).toBe(false);
    expect(semDado('g051_027', resp)).toBe(true);
    expect(celulasComDado(resp).has('g051_026')).toBe(true);
  });
});
