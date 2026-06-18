import Constants, { ExecutionEnvironment } from 'expo-constants';

/** True cuando la app corre dentro de Expo Go (no APK/dev build). */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/** Push remoto de Expo requiere development build o APK — no Expo Go (SDK 53+). */
export function supportsRemotePush(): boolean {
  return !isExpoGo();
}
