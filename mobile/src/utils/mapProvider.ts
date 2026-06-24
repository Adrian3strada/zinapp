import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function hasGoogleMapsApiKey(): boolean {
  const androidKey =
    Constants.expoConfig?.android?.config?.googleMaps?.apiKey
    ?? (Constants.expoConfig?.extra as { googleMapsApiKey?: string } | undefined)?.googleMapsApiKey;
  const iosKey = Constants.expoConfig?.ios?.config?.googleMapsApiKey ?? androidKey;
  const key = Platform.OS === 'ios' ? iosKey : androidKey;
  return typeof key === 'string' && key.length > 8;
}

/**
 * MapView en Android release sin Google Maps API key provoca cierre nativo de la app.
 * Solo renderizar mapas nativos cuando hay key configurada (o en desarrollo).
 */
export function shouldRenderNativeMap(): boolean {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android' && !__DEV__ && !hasGoogleMapsApiKey()) return false;
  return true;
}

/** OpenStreetMap en WebView (móvil) o iframe (web) cuando no hay mapa nativo. */
export function shouldUseOsmWebMap(): boolean {
  if (Platform.OS === 'web') return true;
  return !shouldRenderNativeMap();
}

/** @deprecated Usa shouldRenderNativeMap */
export function mapsAvailableOnDevice(): boolean {
  return shouldRenderNativeMap();
}
