import { Alert, Linking, Platform } from 'react-native';

import { appAlert } from './appAlert';

import type { MapCoordinate } from './maps';

export async function openGoogleMapsNav(coord: MapCoordinate, label?: string) {
  const dest = `${coord.latitude},${coord.longitude}`;
  const candidates = Platform.select({
    android: [
      `google.navigation:q=${dest}`,
      `geo:0,0?q=${dest}(${encodeURIComponent(label ?? 'Destino')})`,
      `https://www.google.com/maps/dir/?api=1&destination=${dest}`,
    ],
    ios: [
      `maps://?daddr=${dest}&dirflg=d`,
      `comgooglemaps://?daddr=${dest}&directionsmode=driving`,
      `https://www.google.com/maps/dir/?api=1&destination=${dest}`,
    ],
    default: [`https://www.google.com/maps/dir/?api=1&destination=${dest}`],
  }) ?? [`https://www.google.com/maps/dir/?api=1&destination=${dest}`];

  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // Probar siguiente esquema (p. ej. google.navigation sin permiso en manifest).
    }
  }

  appAlert('Mapas', label ? `No se pudo abrir navegación a ${label}` : 'No se pudo abrir Google Maps');
}

export async function openWazeNav(coord: MapCoordinate) {
  const dest = `${coord.latitude},${coord.longitude}`;
  const candidates = [
    `waze://?ll=${dest}&navigate=yes`,
    `https://waze.com/ul?ll=${dest}&navigate=yes`,
  ];

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

/** Selector de app de navegación — Alert nativo (estable al elegir Maps/Waze). */
export function showNavigationPicker(
  coord: MapCoordinate,
  title: string,
  address?: string,
) {
  Alert.alert(
    title,
    address ?? `${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`,
    [
      { text: 'Google Maps', onPress: () => { void openGoogleMapsNav(coord, title); } },
      { text: 'Waze', onPress: () => { void openWazeNav(coord); } },
      { text: 'Cancelar', style: 'cancel' },
    ],
  );
}
