import { Linking, Platform } from 'react-native';

import { appAlert } from './appAlert';
import type { MapCoordinate } from './maps';

export function getGoogleMapsNavUrl(coord: MapCoordinate): string {
  const dest = `${coord.latitude},${coord.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

export function getWazeNavUrl(coord: MapCoordinate): string {
  const dest = `${coord.latitude},${coord.longitude}`;
  return `https://waze.com/ul?ll=${encodeURIComponent(dest)}&navigate=yes`;
}

/**
 * Abre URL externa. En web debe llamarse en el mismo tick del tap.
 * Preferimos pestaña nueva; si el navegador bloquea, navegamos en la misma
 * (la sesión web ya persiste en localStorage).
 */
export function openExternalUrl(url: string): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (opened) return true;
    } catch {
      // fall through
    }
    try {
      window.location.assign(url);
      return true;
    } catch {
      return false;
    }
  }

  void Linking.openURL(url).catch(() => {
    /* caller may show error */
  });
  return true;
}

export async function openGoogleMapsNav(coord: MapCoordinate, label?: string) {
  const dest = `${coord.latitude},${coord.longitude}`;
  const webUrl = getGoogleMapsNavUrl(coord);

  if (Platform.OS === 'web') {
    if (!openExternalUrl(webUrl)) {
      appAlert('Mapas', label ? `No se pudo abrir navegación a ${label}` : 'No se pudo abrir Google Maps');
    }
    return;
  }

  const candidates = Platform.select({
    android: [
      `google.navigation:q=${dest}`,
      `geo:0,0?q=${dest}(${encodeURIComponent(label ?? 'Destino')})`,
      webUrl,
    ],
    ios: [
      `maps://?daddr=${dest}&dirflg=d`,
      `comgooglemaps://?daddr=${dest}&directionsmode=driving`,
      webUrl,
    ],
    default: [webUrl],
  }) ?? [webUrl];

  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // Probar siguiente esquema
    }
  }

  appAlert('Mapas', label ? `No se pudo abrir navegación a ${label}` : 'No se pudo abrir Google Maps');
}

export async function openWazeNav(coord: MapCoordinate) {
  const webUrl = getWazeNavUrl(coord);

  if (Platform.OS === 'web') {
    if (!openExternalUrl(webUrl)) {
      appAlert('Waze', 'No se pudo abrir Waze.');
    }
    return;
  }

  const dest = `${coord.latitude},${coord.longitude}`;
  const candidates = [`waze://?ll=${dest}&navigate=yes`, webUrl];

  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // intentar URL web
    }
  }

  appAlert('Waze', 'No se pudo abrir Waze. ¿Está instalado?');
}

/**
 * Selector Maps/Waze.
 * En web abre Google Maps al momento (sin modal): iOS Safari bloquea
 * popups diferidos tras cerrar un diálogo.
 */
export function showNavigationPicker(
  coord: MapCoordinate,
  title: string,
  address?: string,
) {
  if (Platform.OS === 'web') {
    void openGoogleMapsNav(coord, title);
    return;
  }

  appAlert(
    title,
    address ?? `${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`,
    [
      { text: 'Google Maps', onPress: () => { void openGoogleMapsNav(coord, title); } },
      { text: 'Waze', onPress: () => { void openWazeNav(coord); } },
      { text: 'Cancelar', style: 'cancel' },
    ],
  );
}
