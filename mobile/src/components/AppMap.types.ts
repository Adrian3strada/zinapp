import type { ViewStyle } from 'react-native';

import type { MapCoordinate, MapRegion } from '../utils/maps';
import type { MapPinType } from './MapPin';

export interface MapMarker {
  id: string;
  coordinate: MapCoordinate;
  title: string;
  description?: string;
  pinType?: MapPinType;
}

export interface MapPolyline {
  id?: string;
  coordinates: MapCoordinate[];
  strokeColor?: string;
  strokeWidth?: number;
  lineDashPattern?: number[];
}

export interface MapFitPadding {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface AppMapProps {
  markers?: MapMarker[];
  polylines?: MapPolyline[];
  region?: MapRegion;
  height?: number;
  style?: ViewStyle;
  showsUserLocation?: boolean;
  followsUserLocation?: boolean;
  emptyMessage?: string;
  onMarkerPress?: (marker: MapMarker) => void;
  followMarkerId?: string | null;
  /** Evita que sheets/overlays tapen la ruta al hacer fitBounds. */
  fitPadding?: MapFitPadding | null;
}
