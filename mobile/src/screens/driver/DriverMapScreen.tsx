import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../utils/appAlert';
import { formatOrderLabel } from '../../utils/orderDisplay';

import AppMap, { MapMarker } from '../../components/AppMap';
import RouteStatsBar from '../../components/RouteStatsBar';
import ScreenContainer from '../../components/ScreenContainer';
import { useStreetRoutes } from '../../hooks/useStreetRoutes';
import type { DriverMapScreenProps } from '../../navigation/types';
import { orderApi } from '../../services/api';
import { colors } from '../../theme/colors';
import type { Order } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { regionForCoordinates, toCoordinate, type MapCoordinate } from '../../utils/maps';
import type { StreetRouteSegment } from '../../utils/routing';
import {
  getGoogleMapsNavUrl,
  openExternalUrl,
  showNavigationPicker,
} from '../../utils/navigationLinks';
import { mapHeight } from '../../utils/responsive';

type NavButtonProps = {
  coord: MapCoordinate;
  label: string;
  title: string;
  address?: string;
  primary?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
};

function NavigationTargetButton({
  coord,
  label,
  title,
  address,
  primary,
  icon,
}: NavButtonProps) {
  const iconColor = primary ? '#FFF' : colors.shipmentStart;

  return (
    <Pressable
      style={[
        primary ? styles.navBtn : styles.navBtnSecondary,
        Platform.OS === 'web' ? ({ cursor: 'pointer', zIndex: 5 } as object) : null,
      ]}
      accessibilityRole="link"
      accessibilityLabel={`${label}: abrir en Google Maps`}
      onPress={() => {
        // Web: sync en el mismo tick del tap (sin modal / async).
        if (Platform.OS === 'web') {
          openExternalUrl(getGoogleMapsNavUrl(coord));
          return;
        }
        showNavigationPicker(coord, title, address);
      }}
    >
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={primary ? styles.navText : styles.navTextSecondary}>{label}</Text>
    </Pressable>
  );
}

export default function DriverMapScreen({ route }: DriverMapScreenProps) {
  const { orderId } = route.params;
  const [order, setOrder] = useState<Order | null>(null);
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
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 3,
          timeInterval: 2000,
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
  }, [orderId]);

  const {
    markers,
    routeSegments,
    primaryCoord,
    secondaryCoord,
    nextStopLabel,
    title,
    subtitle,
  } = useMemo(() => {
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
  }, [order, userLocation]);

  const { polylines, stats, loading: routesLoading } = useStreetRoutes(routeSegments);

  const mapMarkers = useMemo(() => {
    const list = [...markers];
    if (userLocation) {
      list.push({
        id: 'me',
        coordinate: userLocation,
        title: 'Tú',
        pinType: 'me',
      });
    }
    return list;
  }, [markers, userLocation]);

  const region = useMemo(
    () => regionForCoordinates(mapMarkers.map((m) => m.coordinate)),
    [mapMarkers],
  );

  const routeStatItems = useMemo(() => {
    const items = [];
    if (stats['to-next-stop']) {
      items.push({
        label: nextStopLabel,
        stats: stats['to-next-stop'],
        icon: 'navigate' as const,
      });
    }
    if (stats['restaurant-delivery']) {
      items.push({
        label: 'Ruta del pedido',
        stats: stats['restaurant-delivery'],
        icon: 'map' as const,
      });
    }
    return items;
  }, [stats, nextStopLabel]);

  if (loading && !order) {
    return <ScreenContainer loading />;
  }

  if (loadError && !order) {
    return <ScreenContainer error={loadError} />;
  }

  return (
    <ScreenContainer>
      <LinearGradient colors={[colors.shipmentStart, colors.shipmentEnd]} style={styles.hero}>
        <Text style={styles.heroEyebrow}>Navegación</Text>
        <Text style={styles.title} numberOfLines={1}>{title.replace('Navegación · ', '')}</Text>
        <Text style={styles.address} numberOfLines={2}>{subtitle}</Text>
        {nextStopLabel ? (
          <View style={styles.nextStopBanner}>
            <Ionicons name="flag" size={16} color="#FFF" />
            <Text style={styles.nextStopText}>Siguiente parada: {nextStopLabel}</Text>
          </View>
        ) : null}
      </LinearGradient>
      <View style={styles.panel}>
        <RouteStatsBar items={routeStatItems} loading={routesLoading} />
        <View style={styles.navRow}>
          {primaryCoord ? (
            <NavigationTargetButton
              coord={primaryCoord}
              label="Restaurante"
              title="Ir al restaurante"
              address={order?.restaurant_detail?.name}
              icon="restaurant"
            />
          ) : null}
          {secondaryCoord ? (
            <NavigationTargetButton
              coord={secondaryCoord}
              label="Entrega"
              title="Ir a entrega"
              address={order?.delivery_address}
              icon="navigate"
              primary
            />
          ) : null}
        </View>
      </View>
      <View style={styles.mapWrap}>
        <AppMap
          markers={mapMarkers}
          polylines={polylines}
          region={region}
          height={mapHeight(0.52)}
          followMarkerId={userLocation ? 'me' : null}
          emptyMessage="Sin puntos en el mapa. Verifica que tenga dirección con coordenadas."
        />
      </View>
      <Text style={styles.hint}>
        El pin azul eres tú. La línea sólida es tu ruta a la siguiente parada. Toca los botones para abrir Google Maps o Waze.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 6,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  panel: {
    position: 'relative',
    padding: 16,
    gap: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    zIndex: 5,
    elevation: 5,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  address: { fontSize: 14, color: 'rgba(255,255,255,0.88)', lineHeight: 20 },
  nextStopBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 4,
  },
  nextStopText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  navRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  navBtn: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.shipmentStart,
    padding: 12,
    borderRadius: 14,
  },
  navBtnSecondary: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  navText: { color: '#FFF', fontWeight: '800' },
  navTextSecondary: { color: colors.shipmentStart, fontWeight: '800' },
  mapWrap: { zIndex: 0, position: 'relative' },
  hint: { padding: 16, color: colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
