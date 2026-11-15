import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Texto } from '../Texto';

describe('Texto', () => {
  it.each(['titulo', 'corpo', 'legenda'] as const)(
    'variante %s tem fonte >= 16 e não trava a escala',
    async (variante) => {
      await render(<Texto variante={variante}>Olá</Texto>);
      const t = screen.getByText('Olá');
      expect(StyleSheet.flatten(t.props.style).fontSize).toBeGreaterThanOrEqual(16);
      expect(t.props.allowFontScaling).not.toBe(false);
    },
  );

  it('sem variante usa corpo (>= 16)', async () => {
    await render(<Texto>Padrão</Texto>);
    expect(StyleSheet.flatten(screen.getByText('Padrão').props.style).fontSize).toBeGreaterThanOrEqual(16);
  });

  it('titulo é anunciado como cabeçalho', async () => {
    await render(<Texto variante="titulo">Guardiões</Texto>);
    expect(screen.getByRole('header', { name: 'Guardiões' })).toBeTruthy();
  });

  it('não deixa um estilo externo reduzir a fonte abaixo de 16 nem travar a escala', async () => {
    await render(
      <Texto style={{ fontSize: 10 }} allowFontScaling={false}>
        Pequeno
      </Texto>,
    );
    const t = screen.getByText('Pequeno');
    expect(StyleSheet.flatten(t.props.style).fontSize).toBeGreaterThanOrEqual(16);
    expect(t.props.allowFontScaling).not.toBe(false);
  });
});
