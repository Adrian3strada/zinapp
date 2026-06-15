import { Alert, Linking, Platform } from 'react-native';

import type { MapCoordinate } from './maps';

export async function openGoogleMapsNav(coord: MapCoordinate, label?: string) {
  const dest = `${coord.latitude},${coord.longitude}`;
  const url = Platform.select({
    ios: `maps://?daddr=${dest}&dirflg=d`,
    android: `google.navigation:q=${dest}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${dest}`,
  });
  const web = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
  try {
    const supported = await Linking.canOpenURL(url!);
    await Linking.openURL(supported ? url! : web);
  } catch {
    Alert.alert('Mapas', label ? `No se pudo abrir navegación a ${label}` : 'No se pudo abrir Google Maps');
  }
}

export async function openWazeNav(coord: MapCoordinate) {
  const url = `https://waze.com/ul?ll=${coord.latitude},${coord.longitude}&navigate=yes`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Waze', 'No se pudo abrir Waze. ¿Está instalado?');
  }
}

export function showNavigationPicker(
  coord: MapCoordinate,
  title: string,
  address?: string,
) {
  Alert.alert(
    title,
    address ?? `${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`,
    [
      { text: 'Google Maps', onPress: () => openGoogleMapsNav(coord, title) },
      { text: 'Waze', onPress: () => openWazeNav(coord) },
      { text: 'Cancelar', style: 'cancel' },
    ],
  );
}
