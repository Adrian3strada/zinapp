import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../utils/appAlert';
import { formatOrderLabel } from '../../utils/orderDisplay';

import AppMap, { MapMarker } from '../../components/AppMap';
import RouteStatsBar from '../../components/RouteStatsBar';
import ScreenContainer from '../../components/ScreenContainer';
import { useStreetRoutes } from '../../hooks/useStreetRoutes';
import type { DriverMapScreenProps } from '../../navigation/types';
import { orderApi, shipmentApi } from '../../services/api';
import { colors } from '../../theme/colors';
import type { Order, Shipment } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { regionForCoordinates, toCoordinate, type MapCoordinate } from '../../utils/maps';
import type { StreetRouteSegment } from '../../utils/routing';
import { showNavigationPicker } from '../../utils/navigationLinks';
import { mapHeight } from '../../utils/responsive';

export default function DriverMapScreen({ route }: DriverMapScreenProps) {
  const { orderId, shipmentId } = route.params;
  const isShipment = shipmentId != null;
  const [order, setOrder] = useState<Order | null>(null);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasDataRef = useRef(false);
  const [userLocation, setUserLocation] = useState<MapCoordinate | null>(null);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 40,
          timeInterval: 4000,
        },
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
      );
    })();

    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    hasDataRef.current = false;

    if (isShipment && shipmentId) {
      const load = (showLoading = false) => {
        if (showLoading) setLoading(true);
        return shipmentApi
          .get(shipmentId)
          .then(({ data }) => {
            hasDataRef.current = true;
            setShipment(data);
            setLoadError(null);
          })
          .catch((err) => {
            const msg = getApiErrorMessage(err, 'No se cargó el envío');
            setLoadError(msg);
            if (!hasDataRef.current) {
              appAlert('Error', msg);
            }
          })
          .finally(() => {
            if (showLoading) setLoading(false);
          });
      };

      load(true);
      const interval = setInterval(() => load(false), 5000);
      return () => clearInterval(interval);
    }

    if (orderId) {
      const load = (showLoading = false) => {
        if (showLoading) setLoading(true);
        return orderApi
          .get(orderId)
          .then(({ data }) => {
            hasDataRef.current = true;
            setOrder(data);
            setLoadError(null);
          })
          .catch((err) => {
            const msg = getApiErrorMessage(err, 'No se cargó el pedido');
            setLoadError(msg);
            if (!hasDataRef.current) {
              appAlert('Error', msg);
            }
          })
          .finally(() => {
            if (showLoading) setLoading(false);
          });
      };

      load(true);
      const interval = setInterval(() => load(false), 5000);
      return () => clearInterval(interval);
    }

    setLoading(false);
    return undefined;
  }, [orderId, shipmentId, isShipment]);

  const {
    markers,
    routeSegments,
    primaryCoord,
    secondaryCoord,
    nextStopLabel,
    title,
    subtitle,
  } = useMemo(() => {
    if (shipment) {
      const list: MapMarker[] = [];
      const segments: StreetRouteSegment[] = [];
      const pickup = toCoordinate(shipment.pickup_latitude, shipment.pickup_longitude);
      const delivery = toCoordinate(shipment.delivery_latitude, shipment.delivery_longitude);

      if (pickup) {
        list.push({
          id: 'pickup',
          coordinate: pickup,
          title: 'Recoger',
          pinType: 'pickup',
        });
      }
      if (delivery) {
        list.push({
          id: 'delivery',
          coordinate: delivery,
          title: 'Entregar',
          pinType: 'delivery',
        });
      }
      if (pickup && delivery) {
        segments.push({
          id: 'pickup-delivery',
          from: pickup,
          to: delivery,
          strokeColor: colors.border,
          strokeWidth: 2,
          lineDashPattern: [8, 6],
        });
      }

      const onTheWay = shipment.status === 'on_the_way';
      const goingToPickup = shipment.status === 'picked_up';
      const nextStop = onTheWay ? delivery : pickup;
      if (userLocation && nextStop) {
        segments.push({
          id: 'to-next-stop',
          from: userLocation,
          to: nextStop,
          strokeColor: colors.primary,
          strokeWidth: 4,
          dynamic: true,
        });
      }

      return {
        markers: list,
        routeSegments: segments,
        primaryCoord: pickup,
        secondaryCoord: delivery,
        nextStopLabel: onTheWay ? 'Entregar paquete' : goingToPickup ? 'Recoger paquete' : 'Recoger paquete',
        title: `Navegación · Envío #${shipment.id}`,
        subtitle: onTheWay ? shipment.delivery_address : shipment.pickup_address,
      };
    }

    if (!order) {
      return {
        markers: [],
        routeSegments: [],
        primaryCoord: null,
        secondaryCoord: null,
        nextStopLabel: '',
        title: '',
        subtitle: '',
      };
    }

    const list: MapMarker[] = [];
    const segments: StreetRouteSegment[] = [];
    const restaurant = toCoordinate(
      order.restaurant_detail?.latitude,
      order.restaurant_detail?.longitude,
    );
    const delivery = toCoordinate(order.delivery_latitude, order.delivery_longitude);
    const goToDelivery = order.status === 'on_the_way';

    if (restaurant) {
      list.push({
        id: 'restaurant',
        coordinate: restaurant,
        title: order.restaurant_detail?.name ?? 'Restaurante',
        pinType: 'restaurant',
      });
    }
    if (delivery) {
      list.push({
        id: 'delivery',
        coordinate: delivery,
        title: 'Entrega',
        pinType: 'delivery',
      });
    }
    if (restaurant && delivery) {
      segments.push({
        id: 'restaurant-delivery',
        from: restaurant,
        to: delivery,
        strokeColor: colors.border,
        strokeWidth: 2,
        lineDashPattern: [8, 6],
      });
    }

    const nextStop = goToDelivery ? delivery : restaurant;
    if (userLocation && nextStop) {
      segments.push({
        id: 'to-next-stop',
        from: userLocation,
        to: nextStop,
        strokeColor: colors.primary,
        strokeWidth: 4,
        dynamic: true,
      });
    }

    return {
      markers: list,
      routeSegments: segments,
      primaryCoord: restaurant,
      secondaryCoord: delivery,
      nextStopLabel: goToDelivery ? 'Ir a entrega' : 'Ir al restaurante',
      title: `Navegación · ${formatOrderLabel(order)}`,
      subtitle: goToDelivery ? order.delivery_address : (order.restaurant_detail?.name ?? ''),
    };
  }, [order, shipment, userLocation]);

  const { polylines, stats, loading: routesLoading } = useStreetRoutes(routeSegments);

  const routeStatItems = useMemo(() => {
    const items = [];
    if (stats['to-next-stop']) {
      items.push({
        label: nextStopLabel,
        stats: stats['to-next-stop'],
        icon: 'navigate' as const,
      });
    }
    const fullRouteId = isShipment ? 'pickup-delivery' : 'restaurant-delivery';
    if (stats[fullRouteId]) {
      items.push({
        label: isShipment ? 'Ruta completa' : 'Ruta del pedido',
        stats: stats[fullRouteId],
        icon: 'map' as const,
      });
    }
    return items;
  }, [stats, nextStopLabel, isShipment]);

  const region = useMemo(
    () => regionForCoordinates(markers.map((m) => m.coordinate)),
    [markers],
  );

  if (loading && !order && !shipment) {
    return <ScreenContainer loading />;
  }

  if (loadError && !order && !shipment) {
    return <ScreenContainer error={loadError} />;
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.address} numberOfLines={2}>{subtitle}</Text>
        {nextStopLabel ? (
          <View style={styles.nextStopBanner}>
            <Ionicons name="flag" size={16} color={colors.primary} />
            <Text style={styles.nextStopText}>Siguiente parada: {nextStopLabel}</Text>
          </View>
        ) : null}
        <RouteStatsBar items={routeStatItems} loading={routesLoading} />
        <View style={styles.navRow}>
          {primaryCoord && (
            <Pressable
              style={styles.navBtnSecondary}
              onPress={() =>
                showNavigationPicker(
                  primaryCoord,
                  isShipment ? 'Ir a recoger' : 'Ir al restaurante',
                  isShipment ? shipment?.pickup_address : order?.restaurant_detail?.name,
                )
              }
            >
              <Ionicons name={isShipment ? 'cube' : 'restaurant'} size={18} color={colors.primary} />
              <Text style={styles.navTextSecondary}>
                {isShipment ? 'Recoger' : 'Restaurante'}
              </Text>
            </Pressable>
          )}
          {secondaryCoord && (
            <Pressable
              style={styles.navBtn}
              onPress={() =>
                showNavigationPicker(
                  secondaryCoord,
                  'Ir a entrega',
                  isShipment ? shipment?.delivery_address : order?.delivery_address,
                )
              }
            >
              <Ionicons name="navigate" size={18} color="#FFF" />
              <Text style={styles.navText}>Entrega</Text>
            </Pressable>
          )}
        </View>
      </View>
      <AppMap
        markers={markers}
        polylines={polylines}
        region={region}
        height={mapHeight(0.45)}
        showsUserLocation
        followsUserLocation
        emptyMessage="Sin puntos en el mapa. Verifica que tenga dirección con coordenadas."
      />
      <Text style={styles.hint}>
        El punto azul eres tú. La línea sólida es tu ruta al siguiente parada. Toca los botones para abrir Google Maps o Waze.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, gap: 10 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  address: { fontSize: 14, color: colors.textSecondary },
  nextStopBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  nextStopText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  navRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 12,
  },
  navBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    padding: 12,
    borderRadius: 12,
  },
  navText: { color: '#FFF', fontWeight: '700' },
  navTextSecondary: { color: colors.primary, fontWeight: '700' },
  hint: { padding: 16, color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
