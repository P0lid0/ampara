import type { ExpoConfig } from 'expo/config';

// Configuração única do app (substitui o app.json do template).
const config: ExpoConfig = {
  name: 'Ampara',
  slug: 'ampara',
  version: '1.0.0',
  scheme: 'ampara',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
  },
  android: {
    package: 'br.fiap.ampara',
    adaptiveIcon: {
      backgroundColor: '#F4EFE6',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_LOCATION',
      'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.USE_FULL_SCREEN_INTENT',
      'android.permission.VIBRATE',
      'android.permission.CAMERA',
    ],
    // O app não grava áudio (a sirene só toca); câmera e áudio pediriam microfone por padrão.
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      'expo-camera',
      {
        cameraPermission: 'O Ampara usa a câmera para ler o código de barras do IMEI e o QR do convite de guardião.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-location',
      {
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    'expo-sqlite',
    'expo-secure-store',
    [
      'expo-audio',
      {
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          // Permite http://10.0.2.2:5080 (API local) e :8080 (VM) no emulador.
          usesCleartextTraffic: true,
        },
      },
    ],
    '@maplibre/maplibre-react-native',
  ],
};

export default config;
