import { agruparPorDia, formatarHora, pontoMaisProximo } from '../linhaDoTempo';

// SINTETICO: coordenadas de demonstração.
const p = (em: string, lat = -23.5) => ({ lat, lng: -46.6, em });

describe('linha do tempo da rota', () => {
  it('23:30 em São Paulo (02:30Z do dia seguinte) fica no dia de São Paulo, não no do UTC', () => {
    const g = agruparPorDia([p('2026-11-13T02:30:00Z')]);
    expect(g.map((d) => d.dia)).toEqual(['2026-11-12']);
  });

  it('pontos fora de ordem saem ordenados; dias do mais novo ao mais antigo', () => {
    const g = agruparPorDia([
      p('2026-11-12T20:00:00Z'),
      p('2026-11-10T15:00:00Z'),
      p('2026-11-12T14:00:00Z'),
      p('2026-11-11T15:00:00Z'),
    ]);
    expect(g.map((d) => d.dia)).toEqual(['2026-11-12', '2026-11-11', '2026-11-10']);
    expect(g[0].pontos.map((x) => x.em)).toEqual(['2026-11-12T14:00:00Z', '2026-11-12T20:00:00Z']);
  });

  it('lista vazia não gera dias', () => {
    expect(agruparPorDia([])).toEqual([]);
  });

  it('não altera a lista recebida', () => {
    const entrada = [p('2026-11-12T20:00:00Z'), p('2026-11-12T14:00:00Z')];
    agruparPorDia(entrada);
    expect(entrada[0].em).toBe('2026-11-12T20:00:00Z');
  });

  it('ignora ponto com data inválida em vez de lançar', () => {
    const r = agruparPorDia([p('lixo'), p('2026-11-12T20:00:00Z')]);
    expect(r).toHaveLength(1);
    expect(r[0].pontos).toHaveLength(1);
  });

  describe('pontoMaisProximo', () => {
    const pts = [p('2026-11-12T10:00:00Z'), p('2026-11-12T10:10:00Z'), p('2026-11-12T10:30:00Z')];
    it('instante exato', () => expect(pontoMaisProximo(pts, '2026-11-12T10:10:00Z')).toBe(1));
    it('entre dois pontos, o mais perto', () => {
      expect(pontoMaisProximo(pts, '2026-11-12T10:12:00Z')).toBe(1);
      expect(pontoMaisProximo(pts, '2026-11-12T10:21:00Z')).toBe(2);
    });
    it('antes do primeiro devolve 0', () => expect(pontoMaisProximo(pts, '2026-11-12T08:00:00Z')).toBe(0));
    it('depois do último devolve o último', () => expect(pontoMaisProximo(pts, '2026-11-12T23:00:00Z')).toBe(2));
    it('empate fica com o mais antigo', () => expect(pontoMaisProximo(pts, '2026-11-12T10:05:00Z')).toBe(0));
    it('lista vazia devolve -1', () => expect(pontoMaisProximo([], '2026-11-12T10:00:00Z')).toBe(-1));
  });

  it('formatarHora("2026-11-12T20:41:00Z") === "17:41"', () => {
    expect(formatarHora('2026-11-12T20:41:00Z')).toBe('17:41');
  });

  it('formatarHora usa o fuso informado e mostra meia-noite como 00', () => {
    expect(formatarHora('2026-11-13T03:05:00Z')).toBe('00:05');
    expect(formatarHora('2026-11-12T20:41:00Z', 'UTC')).toBe('20:41');
  });
});
