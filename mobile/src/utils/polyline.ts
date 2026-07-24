import type { MapCoordinate } from './maps';
import { sanitizeCoordinates } from './maps';

/**
 * Decodifica polyline de Valhalla (precisión 6) / Google (precisión 5).
 * Devuelve [lat, lng] pairs.
 */
export function decodePolyline(encoded: string, precision = 6): MapCoordinate[] {
  const coordinates: MapCoordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const factor = 10 ** precision;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push({
      latitude: lat / factor,
      longitude: lng / factor,
    });
  }

  return sanitizeCoordinates(coordinates);
}
