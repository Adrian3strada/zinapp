import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/** True cuando la app corre dentro de Expo Go (no APK/dev build). */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/** Push remoto de Expo requiere development build o APK — no Expo Go ni web. */
export function supportsRemotePush(): boolean {
  if (Platform.OS === 'web') return false;
  return !isExpoGo();
}
