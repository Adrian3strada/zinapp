import React from 'react';
import { View, ViewProps } from 'react-native';

export const PROVIDER_DEFAULT = undefined;

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type MapProps = ViewProps & {
  initialRegion?: Region;
  provider?: unknown;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  followsUserLocation?: boolean;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;
  liteMode?: boolean;
  onPress?: (event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => void;
};

const MapView = React.forwardRef<View, MapProps>(function MapView(_props, _ref) {
  return null;
});

export default MapView;

export function Marker(_props: Record<string, unknown>) {
  return null;
}

export function Polyline(_props: Record<string, unknown>) {
  return null;
}
