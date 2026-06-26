import type { ViewStyle } from 'react-native';
import type { Region } from 'react-native-maps';

import type { MapCoordinate } from '../utils/maps';
import type { MapPinType } from './MapPin';

export interface MapMarker {
  id: string;
  coordinate: MapCoordinate;
  title: string;
  description?: string;
  pinType?: MapPinType;
}

export interface MapPolyline {
  coordinates: MapCoordinate[];
  strokeColor?: string;
  strokeWidth?: number;
  lineDashPattern?: number[];
}

export interface AppMapProps {
  markers?: MapMarker[];
  polylines?: MapPolyline[];
  region?: Region;
  height?: number;
  style?: ViewStyle;
  showsUserLocation?: boolean;
  followsUserLocation?: boolean;
  emptyMessage?: string;
  onMarkerPress?: (marker: MapMarker) => void;
  followMarkerId?: string | null;
}
