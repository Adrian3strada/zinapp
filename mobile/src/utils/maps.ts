export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

/** Centro de Zinapécuaro de Figueroa, Michoacán (Nominatim/OSM) */
export const ZINAPECUARO_REGION = {
  latitude: 19.8581,
  longitude: -100.8274,
  latitudeDelta: 0.06,
  longitudeDelta: 0.08,
};

export function parseCoord(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(num) ? num : null;
}

export function toCoordinate(
  lat: string | number | null | undefined,
  lng: string | number | null | undefined
): MapCoordinate | null {
  const latitude = parseCoord(lat);
  const longitude = parseCoord(lng);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

export function regionForCoordinates(coords: MapCoordinate[]) {
  if (coords.length === 0) return ZINAPECUARO_REGION;

  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;
  const latitudeDelta = Math.max((maxLat - minLat) * 1.6, 0.01);
  const longitudeDelta = Math.max((maxLng - minLng) * 1.6, 0.01);

  return { latitude, longitude, latitudeDelta, longitudeDelta };
}
