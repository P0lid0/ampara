import { fireEvent, render, screen } from '@testing-library/react-native';
import { Interruptor } from '../Interruptor';
import { Grupo, TituloGrupo } from '../Grupo';
import { coresApoio } from '../../theme/tokens';

describe('Interruptor', () => {
  it('desligado: diz "Desligado" por escrito e usa o trilho cinzaChave (visível parado)', async () => {
    await render(<Interruptor rotulo="Alarme sem tela cheia" valor={false} aoMudar={jest.fn()} />);
    expect(screen.getByText('Desligado')).toBeTruthy();
    const chave = screen.getByLabelText('Alarme sem tela cheia');
    expect(chave.props.value).toBe(false);
    expect(chave.props.tintColor).toBe(coresApoio.cinzaChave);
  });

  it('ligado: diz "Ligado"; tocar chama aoMudar com o novo valor', async () => {
    const fn = jest.fn();
    await render(<Interruptor rotulo="Sou guardião" dica="Recebe alarmes" valor aoMudar={fn} />);
    expect(screen.getByText('Ligado')).toBeTruthy();
    expect(screen.getByText('Recebe alarmes')).toBeTruthy();
    await fireEvent(screen.getByLabelText('Sou guardião'), 'valueChange', false);
    expect(fn).toHaveBeenCalledWith(false);
  });
});

describe('Grupo', () => {
  it('mostra o título como cabeçalho e todas as linhas', async () => {
    await render(
      <>
        <TituloGrupo>Alarme</TituloGrupo>
        <Grupo>
          <Interruptor rotulo="A" valor={false} aoMudar={jest.fn()} />
          {null}
          <Interruptor rotulo="B" valor aoMudar={jest.fn()} />
        </Grupo>
      </>,
    );
    expect(screen.getByRole('header', { name: 'Alarme' })).toBeTruthy();
    expect(screen.getByLabelText('A')).toBeTruthy();
    expect(screen.getByLabelText('B')).toBeTruthy();
  });
});
