import { extrairImeiDeCodigo, imeiValido, limparImei } from '../luhn';

// SINTETICO: IMEI de teste com Luhn valido, nunca de aparelho real.
describe('imei', () => {
  it('limparImei tira espacos, hifens, pontos e barras', () => {
    expect(limparImei(' 49-015420.323751/8 ')).toBe('490154203237518');
  });

  it('válidos: 490154203237518 e com máscara 49-015420-323751-8', () => {
    expect(imeiValido('490154203237518')).toBe(true);
    expect(imeiValido('49-015420-323751-8')).toBe(true);
  });

  it('inválidos', () => {
    for (const x of ['490154203237519', '49015420323751', '4901542032375188', '49015420323751a', '', '000000000000000', '111111111111111']) {
      expect(imeiValido(x)).toBe(false);
    }
  });

  it('código de barras: EAN-13 e texto livre não viram IMEI', () => {
    expect(extrairImeiDeCodigo('7891000100103')).toBeNull();
    expect(extrairImeiDeCodigo('490154203237518')).toBe('490154203237518');
    expect(extrairImeiDeCodigo('texto qualquer')).toBeNull();
    expect(extrairImeiDeCodigo('IMEI 490154203237518')).toBe('490154203237518');
    expect(extrairImeiDeCodigo('490154203237519')).toBeNull();
  });

  it('não extrai 15 dígitos do meio de um número maior', () => {
    expect(extrairImeiDeCodigo('4901542032375188')).toBeNull();
    expect(extrairImeiDeCodigo('IMEI 4901542032375188')).toBeNull();
    expect(extrairImeiDeCodigo('IMEI 490154203237518.')).toBe('490154203237518');
  });
});
