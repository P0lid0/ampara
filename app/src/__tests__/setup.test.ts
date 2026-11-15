// Confere que o jest.setup troca os módulos nativos por mocks (nenhum toca aparelho).
import notifee, { AndroidImportance } from '@notifee/react-native';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Clipboard from 'expo-clipboard';
import { useAudioPlayer } from 'expo-audio';
import { CameraView } from 'expo-camera';
import { Map } from '@maplibre/maplibre-react-native';

describe('mocks nativos do jest.setup', () => {
  it('notifee usa o mock oficial com os enums reais', async () => {
    expect(AndroidImportance.HIGH).toBe(4);
    await expect(notifee.createChannel({ id: 'alarme', name: 'Alarme' })).resolves.toBeDefined();
  });

  it('secure-store guarda em memória e limpa entre testes (parte 1)', async () => {
    await SecureStore.setItemAsync('token', 'x');
    await expect(SecureStore.getItemAsync('token')).resolves.toBe('x');
  });

  it('secure-store guarda em memória e limpa entre testes (parte 2)', async () => {
    await expect(SecureStore.getItemAsync('token')).resolves.toBeNull();
  });

  it('localização, tarefas, áudio, área de transferência, câmera e mapa são mocks', async () => {
    await expect(Location.requestForegroundPermissionsAsync()).resolves.toEqual(
      expect.objectContaining({ granted: true }),
    );
    expect(jest.isMockFunction(TaskManager.defineTask)).toBe(true);
    expect(jest.isMockFunction(Clipboard.setStringAsync)).toBe(true);
    expect(jest.isMockFunction(useAudioPlayer)).toBe(true);
    expect(CameraView).toBeDefined();
    expect(Map).toBeDefined();
  });
});
