import { destinoGuard } from '../guard';

describe('guard de rotas', () => {
  it('sem sessão vai para /entrar, exceto quando já está lá', () => {
    expect(destinoGuard(false, null, ['index'])).toBe('/entrar');
    expect(destinoGuard(false, null, ['entrar'])).toBeNull();
  });
  it('autenticado sai de /entrar', () => {
    expect(destinoGuard(true, 'usuario', ['entrar'])).toBe('/');
    expect(destinoGuard(true, 'emergencia', ['entrar'])).toBe('/historico');
  });
  it('emergência só acessa historico, rota e bo', () => {
    expect(destinoGuard(true, 'emergencia', ['(tabs)', 'historico'])).toBeNull();
    expect(destinoGuard(true, 'emergencia', ['rota'])).toBeNull();
    expect(destinoGuard(true, 'emergencia', ['bo'])).toBeNull();
    expect(destinoGuard(true, 'emergencia', ['(tabs)'])).toBe('/historico');
    expect(destinoGuard(true, 'emergencia', ['(tabs)', 'mapa'])).toBe('/historico');
    expect(destinoGuard(true, 'emergencia', ['(tabs)', 'ajustes'])).toBe('/historico');
    expect(destinoGuard(true, 'emergencia', ['onboarding', 'imei'])).toBe('/historico');
  });
  it('usuário comum acessa o resto', () => {
    expect(destinoGuard(true, 'usuario', ['(tabs)', 'historico'])).toBeNull();
  });
});
