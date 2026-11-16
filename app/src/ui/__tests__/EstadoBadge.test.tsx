import { render, screen } from '@testing-library/react-native';
import { EstadoBadge, iconesEstado, type Estado } from '../EstadoBadge';

const casos: { estado: Estado; texto: string }[] = [
  { estado: 'aberta', texto: 'Aberta' },
  { estado: 'cancelada', texto: 'Cancelada' },
  { estado: 'encerrada', texto: 'Encerrada' },
  { estado: 'teste', texto: 'Teste' },
  { estado: 'online', texto: 'Conectado' },
  { estado: 'offline', texto: 'Sem conexão' },
  { estado: 'feito', texto: 'Feito' },
  { estado: 'pendente', texto: 'Pendente' },
];

describe('EstadoBadge', () => {
  it.each(casos)('$estado mostra o texto "$texto" e um ícone (nunca só cor)', async ({ estado, texto }) => {
    await render(<EstadoBadge estado={estado} />);
    expect(screen.getByText(texto)).toBeTruthy();
    expect(screen.getByTestId(`estado-icone-${estado}`)).toBeTruthy();
  });

  it.each(casos)('$estado tem rótulo acessível com o texto', async ({ estado, texto }) => {
    await render(<EstadoBadge estado={estado} />);
    expect(screen.getByLabelText(new RegExp(texto))).toBeTruthy();
  });

  it('cada estado tem ícone vetorial próprio', () => {
    const icones = casos.map(({ estado }) => iconesEstado[estado]);
    expect(new Set(icones).size).toBe(casos.length);
  });
});
