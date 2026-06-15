import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import LiveBadge from './LiveBadge';
import RouteStatsBar from './RouteStatsBar';
import { colors } from '../theme/colors';
import { useStreetRoutes } from '../hooks/useStreetRoutes';
import type { Order, OrderStatus } from '../types';
import { formatTimeAgo } from '../utils/format';
import type { StreetRouteSegment } from '../utils/routing';
import { regionForCoordinates, toCoordinate } from '../utils/maps';
import { mapHeight } from '../utils/responsive';
import AppMap, { MapMarker } from './AppMap';

interface Props {
  order: Order;
  height?: number;
  showDriver?: boolean;
  trackDriver?: boolean;
}

const PRE_DRIVER_STATUSES: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready'];

export default function OrderMap({
  order,
  height,
  showDriver = true,
  trackDriver = false,
}: Props) {
  const mapHeightValue = height ?? mapHeight(0.34);

  const { markers, routeSegments, missing, driverNote, locationAgo, isTracking } = useMemo(() => {
    const list: MapMarker[] = [];
    const segments: StreetRouteSegment[] = [];
    const absent: string[] = [];
    let note: string | null = null;

    const restaurant = toCoordinate(
      order.restaurant_detail?.latitude,
      order.restaurant_detail?.longitude,
    );
    const delivery = toCoordinate(order.delivery_latitude, order.delivery_longitude);
    const driver = toCoordinate(order.driver_latitude, order.driver_longitude);

    if (restaurant) {
      list.push({
        id: 'restaurant',
        coordinate: restaurant,
        title: order.restaurant_detail?.name ?? 'Restaurante',
        description: 'Recoger pedido',
        pinType: 'restaurant',
      });
    } else {
      absent.push('restaurante');
    }

    if (delivery) {
      list.push({
        id: 'delivery',
        coordinate: delivery,
        title: 'Entrega',
        description: order.delivery_address,
        pinType: 'delivery',
      });
    } else {
      absent.push('entrega');
    }

    if (restaurant && delivery) {
      segments.push({
        id: 'restaurant-delivery',
        from: restaurant,
        to: delivery,
        strokeColor: colors.border,
        strokeWidth: 3,
        lineDashPattern: [8, 6],
      });
    }

    const tracking = trackDriver && order.status === 'on_the_way';

    if (showDriver && order.driver) {
      if (driver) {
        list.push({
          id: 'driver',
          coordinate: driver,
          title: 'Repartidor',
          description: order.driver_detail?.first_name ?? 'En camino',
          pinType: 'driver',
        });

        if (delivery && order.status === 'on_the_way') {
          segments.push({
            id: 'driver-delivery',
            from: driver,
            to: delivery,
            strokeColor: colors.primary,
            strokeWidth: 4,
            dynamic: true,
          });
        } else if (restaurant) {
          segments.push({
            id: 'driver-restaurant',
            from: driver,
            to: restaurant,
            strokeColor: colors.primary,
            strokeWidth: 4,
            dynamic: true,
          });
        }

        if (tracking) {
          note = 'Seguimiento en vivo del repartidor.';
        }
      } else if (order.status === 'on_the_way') {
        absent.push('ubicación del repartidor');
        note = 'Esperando ubicación GPS del repartidor...';
      }
    } else if (showDriver && PRE_DRIVER_STATUSES.includes(order.status)) {
      note = 'El repartidor aparecerá en el mapa cuando tome el pedido.';
    }

    const ago = formatTimeAgo(order.driver_location_updated_at);

    return {
      markers: list,
      routeSegments: segments,
      missing: absent,
      driverNote: note,
      locationAgo: ago,
      isTracking: tracking && !!list.find((m) => m.id === 'driver'),
    };
  }, [order, showDriver, trackDriver]);

  const { polylines, stats, loading } = useStreetRoutes(routeSegments);

  const routeStatItems = useMemo(() => {
    const items = [];
    if (order.status === 'on_the_way' && stats['driver-delivery']) {
      items.push({
        label: 'ETA repartidor',
        stats: stats['driver-delivery'],
        icon: 'bicycle' as const,
      });
    } else if (stats['driver-restaurant']) {
      items.push({
        label: 'Repartidor al restaurante',
        stats: stats['driver-restaurant'],
        icon: 'bicycle' as const,
      });
    }
    if (stats['restaurant-delivery']) {
      items.push({
        label: 'Ruta total',
        stats: stats['restaurant-delivery'],
        icon: 'map' as const,
      });
    }
    return items;
  }, [stats, order.status]);

  if (markers.length === 0) {
    return (
      <View style={[styles.fallback, { height: mapHeightValue }]}>
        <Text style={styles.fallbackEmoji}>📍</Text>
        <Text style={styles.fallbackText}>
          Sin coordenadas para este pedido.
        </Text>
        {missing.length > 0 && (
          <Text style={styles.fallbackHint}>
            Falta: {missing.join(', ')}.{'\n'}
            En el carrito usa «Buscar dirección» o «Usar mi ubicación».
          </Text>
        )}
      </View>
    );
  }

  const region = regionForCoordinates(markers.map((m) => m.coordinate));

  return (
    <View>
      {isTracking && (
        <View style={styles.liveWrap}>
          <LiveBadge suffix={locationAgo} />
        </View>
      )}
      <AppMap
        markers={markers}
        polylines={polylines}
        region={region}
        height={mapHeightValue}
        followMarkerId={isTracking ? 'driver' : null}
      />
      <RouteStatsBar items={routeStatItems} loading={loading} />
      <View style={styles.legend}>
        {markers.some((m) => m.pinType === 'restaurant') && (
          <Text style={styles.legendItem}>🍽️ Restaurante</Text>
        )}
        {markers.some((m) => m.pinType === 'delivery') && (
          <Text style={styles.legendItem}>📍 Entrega</Text>
        )}
        {markers.some((m) => m.pinType === 'driver') && (
          <Text style={styles.legendItem}>🛵 Repartidor</Text>
        )}
      </View>
      {driverNote && <Text style={styles.driverNote}>{driverNote}</Text>}
      {missing.length > 0 && (
        <Text style={styles.missingNote}>
          Pendiente: {missing.join(', ')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  fallbackEmoji: { fontSize: 32, marginBottom: 8 },
  fallbackText: { color: colors.textSecondary, textAlign: 'center', fontSize: 14, fontWeight: '600' },
  fallbackHint: { color: colors.textMuted, textAlign: 'center', fontSize: 12, marginTop: 8, lineHeight: 18 },
  liveWrap: { marginBottom: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10, justifyContent: 'center' },
  legendItem: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  driverNote: {
    fontSize: 12,
    color: colors.info,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  missingNote: { fontSize: 11, color: colors.warning, textAlign: 'center', marginTop: 6 },
});
