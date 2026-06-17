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

export function isValidCoordinate(coord: MapCoordinate | null | undefined): coord is MapCoordinate {
  if (!coord) return false;
  const { latitude, longitude } = coord;
  return (
    Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
    && !(latitude === 0 && longitude === 0)
  );
}

export function sanitizeCoordinates(coords: MapCoordinate[], maxPoints = 150): MapCoordinate[] {
  const valid = coords.filter(isValidCoordinate);
  if (valid.length <= maxPoints) return valid;
  const step = Math.ceil(valid.length / maxPoints);
  const sampled = valid.filter((_, index) => index % step === 0);
  const last = valid[valid.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

export function toCoordinate(
  lat: string | number | null | undefined,
  lng: string | number | null | undefined
): MapCoordinate | null {
  const latitude = parseCoord(lat);
  const longitude = parseCoord(lng);
  if (latitude === null || longitude === null) return null;
  const coord = { latitude, longitude };
  return isValidCoordinate(coord) ? coord : null;
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
