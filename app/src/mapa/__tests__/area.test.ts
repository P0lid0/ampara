import { areaCentro, areaId, areaLimites, areasNoBbox } from '../area';

describe('grade de áreas', () => {
  it('areaId(-23.5672490, -46.7019515) === "g051_026" (estação Pinheiros, teste de referência do contrato)', () => {
    expect(areaId(-23.567249, -46.7019515)).toBe('g051_026');
  });
  it('areaId(-23.0, -46.6) === "fora" e areaId(-24.0, -46.6) === "fora"', () => {
    expect(areaId(-23.0, -46.6)).toBe('fora');
    expect(areaId(-24.0, -46.6)).toBe('fora');
    expect(areaId(-23.35, -46.6)).toBe('fora'); // limite superior exclusivo
    expect(areaId(-23.5, -46.36)).toBe('fora');
  });
  it('areaCentro("g051_026") fica dentro da célula: areaId(areaCentro(id)) === id', () => {
    const c = areaCentro('g051_026')!;
    expect(c.lat).toBeCloseTo(-23.56825, 5);
    expect(c.lng).toBeCloseTo(-46.70015, 5);
    expect(areaId(c.lat, c.lng)).toBe('g051_026');
  });
  it('areaLimites tem 0.0045 de altura e 0.0049 de largura', () => {
    const l = areaLimites('g051_026')!;
    expect(l.maxLat - l.minLat).toBeCloseTo(0.0045, 10);
    expect(l.maxLng - l.minLng).toBeCloseTo(0.0049, 10);
  });
  it('id inválido ou fora da grade devolve null', () => {
    expect(areaLimites('fora')).toBeNull();
    expect(areaCentro('g999_999')).toBeNull();
    expect(areaLimites('x')).toBeNull();
  });
  it('areasNoBbox lista as células da área visível e recorta ao limite da capital', () => {
    const ids = areasNoBbox({ minLat: -23.5696, minLng: -46.7019, maxLat: -23.5696, maxLng: -46.7019 });
    expect(ids).toEqual(['g051_026']);
    expect(areasNoBbox({ minLat: -10, minLng: -10, maxLat: -9, maxLng: -9 })).toEqual([]);
  });
});
