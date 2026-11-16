import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';
import { ApiErro } from '../../api/cliente';
import { api } from '../../api/endpoints';
import { restaurar, sessaoAtual } from '../../auth/sessao';
import { abrirBanco } from '../../db/db';
import { rotaRepo, sessaoRepo } from '../../db/repos';
import { registrarPontos } from '../fila';
import { estadoRota, iniciarRota, NOME_TAREFA, pararRota, revogarConsentimento, sincronizarAgora } from '../tarefa';

jest.mock('../../api/endpoints', () => ({
  api: { me: { consentimentoRota: jest.fn() }, rota: { enviarPontos: jest.fn() } },
}));
jest.mock('../../auth/sessao', () => ({
  sessaoAtual: jest.fn(),
  restaurar: jest.fn(async () => undefined),
}));

// Capturados no carregamento do módulo (antes de qualquer reset de mock).
const executor = jest.mocked(TaskManager.defineTask).mock.calls.find(([nome]) => nome === 'ampara-rota')?.[1];
const ouvinteApp = jest.mocked(AppState.addEventListener).mock.calls.find(([tipo]) => tipo === 'change')?.[1];

const consentir = jest.mocked(api.me.consentimentoRota);
const enviarPontos = jest.mocked(api.rota.enviarPontos);
const sessao = jest.mocked(sessaoAtual);
const concedida = { granted: true, status: 'granted', canAskAgain: true, expires: 'never' } as never;
const negada = { granted: false, status: 'denied', canAskAgain: false, expires: 'never' } as never;
const USUARIO = { autenticado: true, escopo: 'usuario' as const, expiraEm: '2099-01-01T00:00:00.000Z' };
const SEM_SESSAO = { autenticado: false, escopo: null, expiraEm: null };

// SINTETICO: posição fixa de teste (Pinheiros), nunca dado real.
const local = (msAtras: number, accuracy: number | null = 12): Location.LocationObject => ({
  coords: { latitude: -23.567249, longitude: -46.7019515, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
  timestamp: Date.now() - msAtras,
});

const contar = async () => rotaRepo(await abrirBanco()).contar();

beforeEach(async () => {
  await sessaoRepo(await abrirBanco()).apagarTudo(); // o mock de expo-sqlite guarda o banco entre testes do mesmo arquivo
  await sessaoRepo(await abrirBanco()).set('rota.consentimento', 'sim');
  consentir.mockReset().mockResolvedValue(undefined);
  enviarPontos.mockReset().mockResolvedValue(undefined);
  sessao.mockReset().mockReturnValue(USUARIO);
  jest.mocked(restaurar).mockClear();
  jest.mocked(Location.getForegroundPermissionsAsync).mockReset().mockResolvedValue(concedida);
  jest.mocked(Location.getBackgroundPermissionsAsync).mockReset().mockResolvedValue(concedida);
  jest.mocked(Location.startLocationUpdatesAsync).mockReset().mockResolvedValue(undefined);
  jest.mocked(Location.stopLocationUpdatesAsync).mockReset().mockResolvedValue(undefined);
  jest.mocked(TaskManager.isTaskRegisteredAsync).mockReset().mockResolvedValue(false);
});

describe('tarefa da rota', () => {
  it('a tarefa "ampara-rota" é definida no carregamento do módulo', () => {
    expect(NOME_TAREFA).toBe('ampara-rota');
    expect(executor).toBeInstanceOf(Function);
  });

  it('iniciarRota usa precisão alta, 60 s, 50 m e serviço em primeiro plano com o título da rota', async () => {
    await iniciarRota();
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      'ampara-rota',
      expect.objectContaining({
        accuracy: Location.Accuracy.High,
        timeInterval: 60000,
        distanceInterval: 50,
        foregroundService: expect.objectContaining({ notificationTitle: 'Ampara guardando sua rota (7 dias)' }),
      }),
    );
  });

  it('iniciarRota sem a permissão de localização não liga a tarefa', async () => {
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(negada);
    await iniciarRota();
    expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('RF2: revogarConsentimento chama consentimentoRota(false), pararRota(true) e deixa rota_pendente com 0 linhas', async () => {
    await iniciarRota();
    await registrarPontos(await abrirBanco(), [
      { lat: -23.56, lng: -46.7, precisao: 10, em: new Date(Date.now() - 60_000).toISOString() },
      { lat: -23.57, lng: -46.7, precisao: 10, em: new Date().toISOString() },
    ]);
    expect(await contar()).toBe(2);
    jest.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(true);

    await revogarConsentimento();

    expect(consentir).toHaveBeenCalledWith(false);
    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith('ampara-rota');
    expect(await contar()).toBe(0);
    jest.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(false);
    expect(await estadoRota()).toBe('sem-consentimento');
  });

  it('revogar com a API fora do ar ainda para a rota e apaga a fila, mas avisa o erro', async () => {
    await iniciarRota();
    await registrarPontos(await abrirBanco(), [{ lat: -23.56, lng: -46.7, precisao: 10, em: new Date().toISOString() }]);
    jest.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(true);
    consentir.mockRejectedValue(new ApiErro(0, 'Sem conexão com a internet.'));
    await expect(revogarConsentimento()).rejects.toBeInstanceOf(ApiErro);
    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith('ampara-rota');
    expect(await contar()).toBe(0);
  });

  it('pararRota(false) para a tarefa e mantém a fila; tarefa não registrada não chama stop', async () => {
    await registrarPontos(await abrirBanco(), [{ lat: -23.56, lng: -46.7, precisao: 10, em: new Date().toISOString() }]);
    await pararRota(false);
    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
    jest.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(true);
    await pararRota(false);
    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith('ampara-rota');
    expect(await contar()).toBe(1);
  });

  it('RF4: estadoRota é "sem-permissao" quando background negado, "sem-consentimento" quando recusou, "ativa" quando a tarefa está registrada', async () => {
    // recusou (nunca aceitou neste aparelho)
    await sessaoRepo(await abrirBanco()).apagarTudo();
    expect(await estadoRota()).toBe('sem-consentimento');

    await iniciarRota();
    jest.mocked(Location.getBackgroundPermissionsAsync).mockResolvedValue(negada);
    expect(await estadoRota()).toBe('sem-permissao');

    jest.mocked(Location.getBackgroundPermissionsAsync).mockResolvedValue(concedida);
    jest.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(true);
    expect(await estadoRota()).toBe('ativa');

    jest.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(false);
    expect(await estadoRota()).toBe('pausada');
  });

  it('sem consentimento local o callback não grava, não envia e desliga a tarefa', async () => {
    await sessaoRepo(await abrirBanco()).apagarTudo(); // como depois de um logout
    jest.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(true);
    await registrarPontos(await abrirBanco(), [{ lat: -23.56, lng: -46.7, precisao: 10, em: new Date().toISOString() }]);
    await executor!({ data: { locations: [local(0)] }, error: null, executionInfo: { eventId: '9', taskName: 'ampara-rota' } });
    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith('ampara-rota');
    expect(enviarPontos).not.toHaveBeenCalled();
    expect(await contar()).toBe(0); // fila antiga apagada, posição nova não gravada
  });

  it('sincronizarAgora sem consentimento local não envia a fila', async () => {
    await sessaoRepo(await abrirBanco()).set('rota.consentimento', 'nao');
    await registrarPontos(await abrirBanco(), [{ lat: -23.56, lng: -46.7, precisao: 10, em: new Date().toISOString() }]);
    await sincronizarAgora();
    expect(enviarPontos).not.toHaveBeenCalled();
    expect(await contar()).toBe(1);
  });

  it('callback da tarefa com erro de rede mantém os pontos (nenhum perdido)', async () => {
    const aviso = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    enviarPontos.mockRejectedValue(new ApiErro(0, 'Sem conexão com a internet.'));
    await executor!({ data: { locations: [local(120_000), local(60_000), local(0)] }, error: null, executionInfo: { eventId: '1', taskName: 'ampara-rota' } });
    expect(enviarPontos).toHaveBeenCalledTimes(1); // gravou primeiro e tentou enviar
    expect(await contar()).toBe(3);
    aviso.mockRestore();

    // a rede voltou: a próxima rodada leva os 3 e mais o novo
    enviarPontos.mockReset().mockResolvedValue(undefined);
    await executor!({ data: { locations: [local(0)] }, error: null, executionInfo: { eventId: '2', taskName: 'ampara-rota' } });
    expect(enviarPontos.mock.calls[0][0]).toHaveLength(4);
    expect(await contar()).toBe(0);
  });

  it('callback descarta posição sem precisão e não lança com erro da tarefa', async () => {
    await executor!({ data: { locations: [local(0, null)] }, error: null, executionInfo: { eventId: '3', taskName: 'ampara-rota' } });
    expect(await contar()).toBe(0);
    await expect(
      executor!({ data: undefined, error: { code: 1, message: 'falhou' }, executionInfo: { eventId: '4', taskName: 'ampara-rota' } }),
    ).resolves.toBeUndefined();
  });

  it('sincronizarAgora sem sessão tenta restaurar e, sem token, não envia nada', async () => {
    sessao.mockReturnValue(SEM_SESSAO);
    await registrarPontos(await abrirBanco(), [{ lat: -23.56, lng: -46.7, precisao: 10, em: new Date().toISOString() }]);
    await sincronizarAgora();
    expect(restaurar).toHaveBeenCalledTimes(1);
    expect(enviarPontos).not.toHaveBeenCalled();
    expect(await contar()).toBe(1);
  });

  it('sincronizarAgora no modo emergência não envia rota', async () => {
    sessao.mockReturnValue({ autenticado: true, escopo: 'emergencia', expiraEm: '2099-01-01T00:00:00.000Z' });
    await registrarPontos(await abrirBanco(), [{ lat: -23.56, lng: -46.7, precisao: 10, em: new Date().toISOString() }]);
    await sincronizarAgora();
    expect(enviarPontos).not.toHaveBeenCalled();
  });

  it('o app voltando ao primeiro plano sincroniza a fila', async () => {
    expect(ouvinteApp).toBeInstanceOf(Function);
    await registrarPontos(await abrirBanco(), [{ lat: -23.56, lng: -46.7, precisao: 10, em: new Date().toISOString() }]);
    ouvinteApp!('background');
    expect(sessao).not.toHaveBeenCalled(); // indo para o fundo não sincroniza
    ouvinteApp!('active');
    await sincronizarAgora(); // reaproveita a sincronização disparada pelo ouvinte
    expect(enviarPontos).toHaveBeenCalledTimes(1);
    expect(await contar()).toBe(0);
  });
});
