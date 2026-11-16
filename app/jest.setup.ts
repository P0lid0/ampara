// Mocks dos módulos nativos: nada aqui fala com aparelho, rede ou disco.
// Testes que precisarem de outro comportamento sobrescrevem com jest.mocked(...).mockResolvedValue(...).

import 'react-native-gesture-handler/jestSetup';

jest.mock('@notifee/react-native', () => require('@notifee/react-native/jest-mock'));

jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const componente = (nome: string) => {
    const C = React.forwardRef((props: Record<string, unknown>, ref: unknown) =>
      React.createElement(View, { ...props, ref, testID: props.testID ?? `maplibre-${nome}` }),
    );
    C.displayName = nome;
    return C;
  };
  return {
    __esModule: true,
    Map: componente('Map'),
    Camera: componente('Camera'),
    Marker: componente('Marker'),
    ViewAnnotation: componente('ViewAnnotation'),
    Callout: componente('Callout'),
    UserLocation: componente('UserLocation'),
    NativeUserLocation: componente('NativeUserLocation'),
    GeoJSONSource: componente('GeoJSONSource'),
    RasterSource: componente('RasterSource'),
    VectorSource: componente('VectorSource'),
    ImageSource: componente('ImageSource'),
    Layer: componente('Layer'),
    Images: componente('Images'),
    LocationManager: { start: jest.fn(), stop: jest.fn(), getLastKnownLocation: jest.fn(async () => null) },
    LogManager: { setLogLevel: jest.fn() },
    NetworkManager: { setConnected: jest.fn() },
    OfflineManager: { createPack: jest.fn(), getPacks: jest.fn(async () => []), deletePack: jest.fn() },
  };
});

jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  const permissao = { granted: true, status: 'granted', canAskAgain: true, expires: 'never' };
  const CameraView = React.forwardRef((props: Record<string, unknown>, ref: unknown) =>
    React.createElement(View, { ...props, ref, testID: props.testID ?? 'camera' }),
  );
  return {
    __esModule: true,
    CameraView,
    useCameraPermissions: jest.fn(() => [permissao, jest.fn(async () => permissao), jest.fn(async () => permissao)]),
    Camera: {
      requestCameraPermissionsAsync: jest.fn(async () => permissao),
      getCameraPermissionsAsync: jest.fn(async () => permissao),
    },
  };
});

jest.mock('expo-secure-store', () => {
  const memoria = new Map<string, string>();
  return {
    __esModule: true,
    __memoria: memoria,
    WHEN_UNLOCKED: 'WHEN_UNLOCKED',
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
    getItemAsync: jest.fn(async (k: string) => (memoria.has(k) ? memoria.get(k)! : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      memoria.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      memoria.delete(k);
    }),
    isAvailableAsync: jest.fn(async () => true),
  };
});

jest.mock('expo-task-manager', () => ({
  __esModule: true,
  defineTask: jest.fn(),
  isTaskDefined: jest.fn(() => false),
  isTaskRegisteredAsync: jest.fn(async () => false),
  unregisterTaskAsync: jest.fn(async () => undefined),
  unregisterAllTasksAsync: jest.fn(async () => undefined),
  getRegisteredTasksAsync: jest.fn(async () => []),
}));

jest.mock('expo-location', () => {
  const concedida = { granted: true, status: 'granted', canAskAgain: true, expires: 'never' };
  return {
    __esModule: true,
    Accuracy: { Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6 },
    PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
    requestForegroundPermissionsAsync: jest.fn(async () => concedida),
    requestBackgroundPermissionsAsync: jest.fn(async () => concedida),
    getForegroundPermissionsAsync: jest.fn(async () => concedida),
    getBackgroundPermissionsAsync: jest.fn(async () => concedida),
    hasServicesEnabledAsync: jest.fn(async () => true),
    startLocationUpdatesAsync: jest.fn(async () => undefined),
    stopLocationUpdatesAsync: jest.fn(async () => undefined),
    hasStartedLocationUpdatesAsync: jest.fn(async () => false),
    // SINTETICO: ponto fixo de teste (Av. Paulista), nunca dado real.
    getCurrentPositionAsync: jest.fn(async () => ({
      coords: { latitude: -23.5614, longitude: -46.6559, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
      timestamp: 0,
    })),
    getLastKnownPositionAsync: jest.fn(async () => null),
    watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
  };
});

jest.mock('expo-audio', () => {
  const tocador = () => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(async () => undefined),
    replace: jest.fn(),
    loop: false,
    volume: 1,
    playing: false,
  });
  return {
    __esModule: true,
    useAudioPlayer: jest.fn(() => tocador()),
    createAudioPlayer: jest.fn(() => tocador()),
    useAudioPlayerStatus: jest.fn(() => ({ playing: false, isLoaded: true })),
    setAudioModeAsync: jest.fn(async () => undefined),
    setIsAudioActiveAsync: jest.fn(async () => undefined),
  };
});

jest.mock('expo-clipboard', () => ({
  __esModule: true,
  setStringAsync: jest.fn(async () => true),
  getStringAsync: jest.fn(async () => ''),
  hasStringAsync: jest.fn(async () => false),
}));

jest.mock('expo-haptics', () => ({
  __esModule: true,
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Soft: 'soft', Rigid: 'rigid' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
}));

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

afterEach(() => {
  const store = jest.requireMock('expo-secure-store') as { __memoria: Map<string, string> };
  store.__memoria.clear();
});

// Área segura sem provedor: zero de margem (BarraAcao e telas com cabeçalho próprio usam o hook).
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
