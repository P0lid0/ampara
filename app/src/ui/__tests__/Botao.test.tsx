import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Botao } from '../Botao';

describe('Botao', () => {
  it('alvo >= 48 dp, papel button e rótulo acessível', async () => {
    const fn = jest.fn();
    await render(<Botao rotulo="Estou ciente" onPress={fn} />);
    const b = screen.getByRole('button', { name: 'Estou ciente' });
    expect(StyleSheet.flatten(b.props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(screen.getByText('Estou ciente')).toBeTruthy();
  });

  it('chama onPress ao tocar', async () => {
    const fn = jest.fn();
    await render(<Botao rotulo="Enviar" onPress={fn} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('desabilitado expõe accessibilityState.disabled e não chama onPress', async () => {
    const fn = jest.fn();
    await render(<Botao rotulo="Enviar" onPress={fn} desabilitado />);
    const b = screen.getByRole('button', { name: 'Enviar' });
    expect(b.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    await fireEvent.press(b);
    expect(fn).not.toHaveBeenCalled();
  });

  it('carregando expõe busy, mantém o rótulo acessível e não chama onPress', async () => {
    const fn = jest.fn();
    await render(<Botao rotulo="Enviar" onPress={fn} carregando />);
    const b = screen.getByRole('button', { name: 'Enviar' });
    expect(b.props.accessibilityState).toEqual(expect.objectContaining({ busy: true, disabled: true }));
    await fireEvent.press(b);
    expect(fn).not.toHaveBeenCalled();
  });

  it('repassa a dica como accessibilityHint', async () => {
    await render(<Botao rotulo="Sair" onPress={jest.fn()} dica="Apaga os dados deste aparelho" />);
    expect(screen.getByRole('button', { name: 'Sair' }).props.accessibilityHint).toBe(
      'Apaga os dados deste aparelho',
    );
  });

  it.each(['primario', 'secundario', 'perigo'] as const)('variante %s mantém alvo >= 48 dp', async (variante) => {
    await render(<Botao rotulo="Ok" onPress={jest.fn()} variante={variante} />);
    const b = screen.getByRole('button', { name: 'Ok' });
    expect(StyleSheet.flatten(b.props.style).minHeight).toBeGreaterThanOrEqual(48);
  });
});
