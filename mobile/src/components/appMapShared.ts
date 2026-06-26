import { colors } from '../theme/colors';
import type { MapMarker } from './AppMap.types';
import type { MapPinType } from './MapPin';
import type { OsmMapMarker } from '../utils/osmMapHtml';

export function osmMarkerColor(pinType?: MapPinType, id?: string): string {
  if (id === 'me') return '#2563EB';
  switch (pinType) {
    case 'delivery':
      return '#22C55E';
    case 'driver':
      return colors.secondary;
    case 'pickup':
      return colors.accent;
    case 'restaurant':
    default:
      return colors.primary;
  }
}

export function toOsmMapMarkers(
  markers: MapMarker[],
  followMarkerId?: string | null,
): OsmMapMarker[] {
  return markers.map((m) => ({
    id: m.id,
    coordinate: m.coordinate,
    color: osmMarkerColor(m.pinType, m.id),
    label: m.title,
    pinType: m.pinType ?? (m.id === 'driver' ? 'driver' : m.id === 'me' ? 'me' : undefined),
    pulse: followMarkerId === m.id,
  }));
}
