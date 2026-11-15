import { act, render, screen } from '@testing-library/react-native';
import { useCameraPermissions } from 'expo-camera';
import { LeitorCodigo } from '../LeitorCodigo';

const padrao = jest.mocked(useCameraPermissions).getMockImplementation();
afterEach(() => jest.mocked(useCameraPermissions).mockImplementation(padrao!));

const negada = { granted: false, status: 'denied', canAskAgain: true, expires: 'never' };

describe('LeitorCodigo', () => {
  it('permissão concedida: lê uma única vez mesmo com leituras repetidas', async () => {
    const aoLer = jest.fn();
    await render(<LeitorCodigo tipos={['code128']} aoLer={aoLer} aoNegar={jest.fn()} />);
    const camera = screen.getByTestId('camera');
    await act(async () => {
      camera.props.onBarcodeScanned({ data: 'A' });
      camera.props.onBarcodeScanned({ data: 'B' });
    });
    expect(aoLer).toHaveBeenCalledTimes(1);
    expect(aoLer).toHaveBeenCalledWith('A');
  });

  it('pedir() negado chama aoNegar uma única vez', async () => {
    const pedir = jest.fn(async () => negada);
    jest.mocked(useCameraPermissions).mockReturnValue([negada, pedir, jest.fn()] as never);
    const aoNegar = jest.fn();
    await render(<LeitorCodigo tipos={['code128']} aoLer={jest.fn()} aoNegar={aoNegar} />);
    await act(async () => undefined);
    expect(pedir).toHaveBeenCalledTimes(1);
    expect(aoNegar).toHaveBeenCalledTimes(1);
  });

  it('pedir() que falha também cai em aoNegar', async () => {
    const pedir = jest.fn(async () => {
      throw new Error('falhou');
    });
    jest.mocked(useCameraPermissions).mockReturnValue([negada, pedir, jest.fn()] as never);
    const aoNegar = jest.fn();
    await render(<LeitorCodigo tipos={['code128']} aoLer={jest.fn()} aoNegar={aoNegar} />);
    await act(async () => undefined);
    expect(aoNegar).toHaveBeenCalledTimes(1);
  });
});
