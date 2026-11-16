import { fireEvent, render, screen } from '@testing-library/react-native';
import { Campo } from '../Campo';

describe('Campo', () => {
  it('campo revelável: "Mostrar" tira a máscara e "Ocultar" volta', async () => {
    await render(<Campo rotulo="Senha" valor="segredo-teste" onChangeText={() => undefined} secureTextEntry revelavel />);
    expect(screen.getByLabelText('Senha').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Mostrar Senha' }));
    expect(screen.getByLabelText('Senha').props.secureTextEntry).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Ocultar Senha' }));
    expect(screen.getByLabelText('Senha').props.secureTextEntry).toBe(true);
  });

  it('sem "revelavel" não há botão de mostrar', async () => {
    await render(<Campo rotulo="Senha" valor="" onChangeText={() => undefined} secureTextEntry />);
    expect(screen.queryByText('Mostrar')).toBeNull();
  });
});
