import { razaoContraste, paresDeTexto } from '../contraste';
import { cores, tamanhos } from '../tokens';

describe('cores da marca', () => {
  it('mantém as quatro cores da identidade', () => {
    expect(cores.petroleo).toBe('#0F4C4A');
    expect(cores.esmeralda).toBe('#14B88A');
    expect(cores.areia).toBe('#F4EFE6');
    expect(cores.alarme).toBe('#E5484D');
  });

  it('alvo mínimo de 48 dp e fonte mínima de 16', () => {
    expect(tamanhos.alvoMin).toBe(48);
    expect(tamanhos.fonteMin).toBe(16);
  });
});

describe('razaoContraste', () => {
  it('preto sobre branco dá 21:1', () => {
    expect(razaoContraste('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('é simétrica e vale 1 para cores iguais', () => {
    expect(razaoContraste('#FFFFFF', '#000000')).toBeCloseTo(razaoContraste('#000000', '#FFFFFF'), 5);
    expect(razaoContraste('#14B88A', '#14B88A')).toBeCloseTo(1, 5);
  });

  it('aceita hexadecimal curto e minúsculo', () => {
    expect(razaoContraste('#000', '#fff')).toBeCloseTo(21, 0);
  });

  it('rejeita cor que não é hexadecimal', () => {
    expect(() => razaoContraste('vermelho', '#FFFFFF')).toThrow();
  });

  it('texto branco sobre esmeralda e sobre alarme NÃO passa de 4.5:1', () => {
    expect(razaoContraste(cores.branco, cores.esmeralda)).toBeLessThan(4.5);
    expect(razaoContraste(cores.branco, cores.alarme)).toBeLessThan(4.5);
  });
});

describe('pares de texto usados no app', () => {
  it('cobre os quatro pares exigidos', () => {
    const chaves = paresDeTexto.map((p) => `${p.texto}/${p.fundo}`);
    expect(chaves).toEqual(
      expect.arrayContaining(['tinta/areia', 'areia/petroleo', 'tinta/esmeralda', 'sobreAlarme/alarme']),
    );
  });

  it.each(paresDeTexto)('$nome >= 4.5:1', (p) => {
    expect(razaoContraste(cores[p.texto], cores[p.fundo])).toBeGreaterThanOrEqual(4.5);
  });
});
