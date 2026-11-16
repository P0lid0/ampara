import { deviceIdValido } from '../pareamento';

describe('deviceIdValido', () => {
  it.each(['chaveiro-ampara-ab12cd', 'chaveiro-0001', 'chaveiro-a'])('aceita %s', (s) => {
    expect(deviceIdValido(s)).toBe(true);
  });

  it.each([
    '',
    'Chaveiro-1',
    'chaveiro-',
    'chaveiro-a b',
    'chaveiro--a',
    'chaveiro-a-',
    ' chaveiro-0001',
    'chaveiro-0001\n',
    'outro-0001',
  ])('rejeita %j', (s) => {
    expect(deviceIdValido(s)).toBe(false);
  });

  it('limita a 40 caracteres', () => {
    const quarenta = 'chaveiro-' + 'a'.repeat(31);
    expect(quarenta).toHaveLength(40);
    expect(deviceIdValido(quarenta)).toBe(true);
    expect(deviceIdValido(quarenta + 'a')).toBe(false);
  });
});
