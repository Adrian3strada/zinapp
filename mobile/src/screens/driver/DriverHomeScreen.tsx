import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppMap, { type MapMarker } from '../../components/AppMap';
import ActiveDeliverySheet from '../../components/driver/ActiveDeliverySheet';
import DriverSideMenu from '../../components/driver/DriverSideMenu';
import OrderRequestSheet from '../../components/driver/OrderRequestSheet';
import SheetEnter from '../../components/driver/SheetEnter';
import SlideAction from '../../components/driver/SlideAction';
import { useAuth } from '../../context/AuthContext';
import { useDriverProfileContext } from '../../context/DriverProfileContext';
import { useDriverActiveDeliveries } from '../../hooks/useDriverHasActiveDelivery';
import { useStreetRoutes } from '../../hooks/useStreetRoutes';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import type { AvailableOrdersScreenProps } from '../../navigation/types';
import { deliveryApi, orderApi } from '../../services/api';
import { colors } from '../../theme/colors';
import type { Order } from '../../types';
import { appAlert } from '../../utils/appAlert';
import { getApiErrorMessage } from '../../utils/apiErrors';
import {
  clearOrderPickedUpLocally,
  getActiveDeliveryStep,
  markOrderPickedUpLocally,
  type ActiveDeliveryStep,
} from '../../utils/driverDeliveryProgress';
import {
  getGoogleMapsNavUrl,
  openExternalUrl,
  showNavigationPicker,
} from '../../utils/navigationLinks';
import {
  isValidCoordinate,
  regionForCoordinates,
  toCoordinate,
  ZINAPECUARO_REGION,
  type MapCoordinate,
  type MapRegion,
} from '../../utils/maps';
import {
  haversineMeters,
  trimRouteAhead,
  type StreetRouteSegment,
} from '../../utils/routing';

export default function DriverHomeScreen({ navigation }: AvailableOrdersScreenProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { listPaddingBottom } = useTabScreenInsets();
  const { isAvailable, profile, updating, toggleAvailability } = useDriverProfileContext();
  const isApproved = profile?.verification_status === 'approved';
  const {
    hasActiveDelivery,
    activeOrder,
    refreshActive,
  } = useDriverActiveDeliveries(4000);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [skippedIds, setSkippedIds] = useState<Set<number>>(() => new Set());
  const [userLocation, setUserLocation] = useState<MapCoordinate | null>(null);
  const [mapHeight, setMapHeight] = useState(Dimensions.get('window').height);
  const [pickupTick, setPickupTick] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoadingOrders(true);
    try {
      const { data } = await orderApi.available();
      setOrders(data);
    } catch {
      if (!silent) setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(() => loadOrders(true), 12000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadOrders(true);
      void refreshActive();
    });
    return unsubscribe;
  }, [navigation, loadOrders, refreshActive]);

  const deliveryStep: ActiveDeliveryStep | null = useMemo(() => {
    if (!activeOrder) return null;
    void pickupTick;
    return getActiveDeliveryStep(activeOrder.id);
  }, [activeOrder, pickupTick]);

  const lastMapLocationAt = useRef(0);
  const lastMapLocation = useRef<MapCoordinate | null>(null);
  /** Origen estable para pedir la ruta (no en cada GPS). */
  const [routeFrom, setRouteFrom] = useState<MapCoordinate | null>(null);
  const routeFromRef = useRef<MapCoordinate | null>(null);
  const fullRouteRef = useRef<MapCoordinate[]>([]);
  const routeProgressRef = useRef(0);
  const [remainingCoords, setRemainingCoords] = useState<MapCoordinate[]>([]);

  useEffect(() => {
    routeFromRef.current = null;
    setRouteFrom(null);
    fullRouteRef.current = [];
    routeProgressRef.current = 0;
    setRemainingCoords([]);
  }, [activeOrder?.id, deliveryStep]);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coord = {
          latitude: initial.coords.latitude,
          longitude: initial.coords.longitude,
        };
        setUserLocation(coord);
        lastMapLocation.current = coord;
        lastMapLocationAt.current = Date.now();
        if (hasActiveDelivery && !routeFromRef.current) {
          routeFromRef.current = coord;
          setRouteFrom(coord);
        }
      } catch {
        // keep default region
      }
      subscription = await Location.watchPositionAsync(
        {
          accuracy: hasActiveDelivery
            ? Location.Accuracy.High
            : Location.Accuracy.Balanced,
          // En entrega: ticks frecuentes para ir “comiendo” la línea azul.
          distanceInterval: hasActiveDelivery ? 8 : 20,
          timeInterval: hasActiveDelivery ? 2000 : 8000,
        },
        (position) => {
          const next = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          const prev = lastMapLocation.current;
          const now = Date.now();
          if (prev && !hasActiveDelivery) {
            const dLat = (next.latitude - prev.latitude) * 111_320;
            const cos = Math.max(Math.abs(Math.cos((next.latitude * Math.PI) / 180)), 0.01);
            const dLng = (next.longitude - prev.longitude) * 111_320 * cos;
            const meters = Math.sqrt(dLat * dLat + dLng * dLng);
            if (meters < 20 && now - lastMapLocationAt.current < 5000) return;
          }
          lastMapLocation.current = next;
          lastMapLocationAt.current = now;
          setUserLocation(next);

          if (!hasActiveDelivery) return;

          if (!routeFromRef.current) {
            routeFromRef.current = next;
            setRouteFrom(next);
          } else {
            // Si se desvía mucho, pide ruta nueva; si no, solo recorta.
            const drift = haversineMeters(routeFromRef.current, next);
            if (drift > 400) {
              routeFromRef.current = next;
              setRouteFrom(next);
              routeProgressRef.current = 0;
            }
          }

          if (fullRouteRef.current.length >= 2) {
            const trimmed = trimRouteAhead(
              fullRouteRef.current,
              next,
              routeProgressRef.current,
            );
            routeProgressRef.current = trimmed.progressIndex;
            setRemainingCoords(trimmed.coordinates);
          }
        },
      );
    })();
    return () => subscription?.remove();
  }, [hasActiveDelivery]);

  const visibleOrders = useMemo(
    () => orders.filter((o) => !skippedIds.has(o.id)),
    [orders, skippedIds],
  );

  const offerOrder = useMemo(() => {
    if (!isAvailable || !isApproved || hasActiveDelivery) return null;
    return visibleOrders[0] ?? null;
  }, [isAvailable, isApproved, hasActiveDelivery, visibleOrders]);

  const restaurantCoord = useMemo(
    () =>
      activeOrder
        ? toCoordinate(
            activeOrder.restaurant_detail?.latitude,
            activeOrder.restaurant_detail?.longitude,
          )
        : null,
    [activeOrder],
  );

  const deliveryCoord = useMemo(
    () =>
      activeOrder
        ? toCoordinate(activeOrder.delivery_latitude, activeOrder.delivery_longitude)
        : null,
    [activeOrder],
  );

  const nextStopCoord = useMemo(() => {
    if (!activeOrder || !deliveryStep) return null;
    return deliveryStep === 'pickup' ? restaurantCoord : deliveryCoord;
  }, [activeOrder, deliveryStep, restaurantCoord, deliveryCoord]);

  const routeSegments = useMemo((): StreetRouteSegment[] => {
    if (!activeOrder || !nextStopCoord || !routeFrom) return [];
    return [
      {
        id: 'to-next-stop',
        from: routeFrom,
        to: nextStopCoord,
        strokeColor: colors.primary,
        strokeWidth: 4,
        // Ruta fija; el recorte local va “comiendo” la línea al avanzar.
        dynamic: false,
      },
    ];
  }, [activeOrder, nextStopCoord, routeFrom]);

  const { polylines, stats } = useStreetRoutes(routeSegments);
  const nextStopStats = stats['to-next-stop'] ?? null;

  useEffect(() => {
    const line = polylines.find((p) => p.id === 'to-next-stop') ?? polylines[0];
    if (!line?.coordinates || line.coordinates.length < 2) return;
    fullRouteRef.current = line.coordinates;
    routeProgressRef.current = 0;
    const origin = userLocation ?? routeFrom;
    if (origin) {
      const trimmed = trimRouteAhead(line.coordinates, origin, 0);
      routeProgressRef.current = trimmed.progressIndex;
      setRemainingCoords(trimmed.coordinates);
    } else {
      setRemainingCoords(line.coordinates);
    }
  }, [polylines, routeFrom]);

  const remainingPolylines = useMemo(() => {
    if (!activeOrder || remainingCoords.length < 2) return [];
    return [
      {
        id: 'to-next-stop',
        coordinates: remainingCoords,
        strokeColor: colors.primary,
        strokeWidth: 4,
      },
    ];
  }, [activeOrder, remainingCoords]);

  const markers = useMemo((): MapMarker[] => {
    const list: MapMarker[] = [];

    if (activeOrder) {
      // Entrega activa: solo paradas fijas + ruta restante (sin pin GPS que tiembla).
      if (deliveryStep === 'pickup' && restaurantCoord) {
        list.push({
          id: 'restaurant',
          coordinate: restaurantCoord,
          title: activeOrder.restaurant_detail?.name ?? 'Restaurante',
          pinType: 'restaurant',
        });
      }
      if (deliveryCoord) {
        list.push({
          id: 'delivery',
          coordinate: deliveryCoord,
          title: 'Entrega',
          description: activeOrder.delivery_address,
          pinType: 'delivery',
        });
      }
      return list;
    }

    if (isValidCoordinate(userLocation)) {
      list.push({
        id: 'me',
        coordinate: userLocation,
        title: 'Tú',
        pinType: 'driver',
      });
    }

    for (const order of visibleOrders.slice(0, 8)) {
      const restaurant = toCoordinate(
        order.restaurant_detail?.latitude,
        order.restaurant_detail?.longitude,
      );
      if (restaurant) {
        list.push({
          id: `rest-${order.id}`,
          coordinate: restaurant,
          title: order.restaurant_detail?.name ?? 'Restaurante',
          description: 'Recoger',
          pinType: 'restaurant',
        });
      }
      const delivery = toCoordinate(order.delivery_latitude, order.delivery_longitude);
      if (delivery) {
        list.push({
          id: `del-${order.id}`,
          coordinate: delivery,
          title: 'Entrega',
          description: order.delivery_address,
          pinType: 'delivery',
        });
      }
    }
    return list;
  }, [userLocation, activeOrder, deliveryStep, restaurantCoord, deliveryCoord, visibleOrders]);

  const [deliveryMapRegion, setDeliveryMapRegion] = useState<MapRegion | null>(null);

  useEffect(() => {
    if (!activeOrder) {
      setDeliveryMapRegion(null);
      return;
    }
    setDeliveryMapRegion((prev) => {
      if (prev) return prev;
      const coords = [restaurantCoord, deliveryCoord, userLocation].filter(isValidCoordinate);
      return coords.length ? regionForCoordinates(coords) : null;
    });
  }, [activeOrder?.id, restaurantCoord, deliveryCoord, userLocation]);

  const mapRegion = useMemo(() => {
    if (activeOrder) {
      return deliveryMapRegion ?? ZINAPECUARO_REGION;
    }
    if (offerOrder) {
      const coords = [
        toCoordinate(
          offerOrder.restaurant_detail?.latitude,
          offerOrder.restaurant_detail?.longitude,
        ),
        toCoordinate(offerOrder.delivery_latitude, offerOrder.delivery_longitude),
        userLocation,
      ].filter(isValidCoordinate);
      if (coords.length) return regionForCoordinates(coords);
    }
    if (isValidCoordinate(userLocation)) {
      return {
        ...userLocation,
        latitudeDelta: 0.035,
        longitudeDelta: 0.035,
      };
    }
    return ZINAPECUARO_REGION;
  }, [activeOrder, deliveryMapRegion, offerOrder, userLocation]);

  const handleConnect = useCallback(async () => {
    if (!isApproved) {
      appAlert(
        'Cuenta pendiente',
        'Completa tu perfil e INE en Mi perfil y espera la aprobación.',
      );
      navigation.navigate('Perfil');
      return;
    }
    await toggleAvailability(!isAvailable);
  }, [isApproved, isAvailable, navigation, toggleAvailability]);

  const handleAccept = useCallback(async () => {
    if (!offerOrder || accepting || hasActiveDelivery) {
      if (hasActiveDelivery) {
        appAlert('Entrega en curso', 'Termina tu entrega actual antes de aceptar otra.');
      }
      return;
    }
    setAccepting(true);
    try {
      await orderApi.acceptDelivery(offerOrder.id);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          await deliveryApi.updateLocation(
            position.coords.latitude,
            position.coords.longitude,
          );
        }
      } catch {
        // GPS syncs in background
      }
      setSkippedIds(new Set());
      await loadOrders(true);
      await refreshActive();
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo aceptar el pedido'));
    } finally {
      setAccepting(false);
    }
  }, [offerOrder, accepting, hasActiveDelivery, loadOrders, refreshActive]);

  const handleSkip = useCallback(() => {
    if (!offerOrder) return;
    setSkippedIds((prev) => new Set(prev).add(offerOrder.id));
  }, [offerOrder]);

  const openNavToNextStop = useCallback(() => {
    if (!nextStopCoord || !activeOrder || !deliveryStep) return;
    const title =
      deliveryStep === 'pickup' ? 'Ir al restaurante' : 'Ir a la entrega';
    const address =
      deliveryStep === 'pickup'
        ? activeOrder.restaurant_detail?.name
        : activeOrder.delivery_address;
    if (Platform.OS === 'web') {
      openExternalUrl(getGoogleMapsNavUrl(nextStopCoord));
      return;
    }
    showNavigationPicker(nextStopCoord, title, address);
  }, [nextStopCoord, activeOrder, deliveryStep]);

  const handleConfirmPickup = useCallback(async () => {
    if (!activeOrder) return;
    markOrderPickedUpLocally(activeOrder.id);
    setPickupTick((n) => n + 1);
  }, [activeOrder]);

  const handleMarkDelivered = useCallback(async () => {
    if (!activeOrder || delivering) return;
    const orderId = activeOrder.id;
    setDelivering(true);
    try {
      await orderApi.markDelivered(orderId);
      clearOrderPickedUpLocally(orderId);
      setPickupTick((n) => n + 1);
      await refreshActive();
      await loadOrders(true);
      navigation.navigate('OrderDetail', { orderId, promptReview: true });
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo marcar entregado'));
    } finally {
      setDelivering(false);
    }
  }, [activeOrder, delivering, refreshActive, loadOrders, navigation]);

  const greeting = user?.first_name?.trim()
    ? `Hola, ${user.first_name}`
    : 'Hola, repartidor';

  const statusLabel = activeOrder
    ? deliveryStep === 'pickup'
      ? 'En camino al restaurante'
      : 'En camino a entregar'
    : !isApproved
      ? 'Pendiente de aprobación'
      : isAvailable
        ? 'Conectado · recibiendo pedidos'
        : 'Desconectado';

  const bottomPad = listPaddingBottom(18);

  return (
    <View
      style={styles.root}
      onLayout={(e) => setMapHeight(e.nativeEvent.layout.height)}
    >
      <AppMap
        key={activeOrder ? `delivery-${activeOrder.id}` : 'idle'}
        height={mapHeight}
        region={mapRegion}
        markers={markers}
        polylines={activeOrder ? remainingPolylines : []}
        followMarkerId={null}
        style={styles.map}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable
          style={styles.menuBtn}
          onPress={() => setMenuOpen(true)}
          accessibilityLabel="Abrir menú"
        >
          <Ionicons name="menu" size={22} color={colors.text} />
        </Pressable>

        <View style={styles.statusCard}>
          <View
            style={[
              styles.statusDot,
              activeOrder || (isAvailable && isApproved)
                ? styles.statusDotOn
                : styles.statusDotOff,
            ]}
          />
          <View style={styles.statusTextWrap}>
            <Text style={styles.greeting} numberOfLines={1}>
              {greeting}
            </Text>
            <Text style={styles.statusLabel} numberOfLines={1}>
              {statusLabel}
            </Text>
          </View>
          {loadingOrders && isAvailable && !activeOrder ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : isAvailable && !activeOrder && visibleOrders.length > 0 ? (
            <View style={styles.countPill}>
              <Text style={styles.countText}>{visibleOrders.length}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.bottomStack, bottomPad]} pointerEvents="box-none">
        {!isApproved && !activeOrder ? (
          <View style={styles.tipBanner}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primaryDark} />
            <Text style={styles.tipText}>
              Completa foto e INE en Mi perfil para poder conectarte.
            </Text>
          </View>
        ) : null}

        {activeOrder && deliveryStep ? (
          <SheetEnter animKey={`active-${activeOrder.id}-${deliveryStep}`}>
            <ActiveDeliverySheet
              order={activeOrder}
              step={deliveryStep}
              delivering={delivering}
              routeStats={nextStopStats}
              onNavigate={openNavToNextStop}
              onConfirmPickup={handleConfirmPickup}
              onMarkDelivered={handleMarkDelivered}
              onDetails={() =>
                navigation.navigate('OrderDetail', { orderId: activeOrder.id })
              }
            />
          </SheetEnter>
        ) : offerOrder ? (
          <SheetEnter animKey={`offer-${offerOrder.id}`}>
            <OrderRequestSheet
              order={offerOrder}
              accepting={accepting}
              acceptDisabled={!isApproved || !isAvailable || hasActiveDelivery}
              onAccept={handleAccept}
              onSkip={handleSkip}
              onDetails={() =>
                navigation.navigate('OrderDetail', { orderId: offerOrder.id })
              }
            />
          </SheetEnter>
        ) : (
          <SheetEnter animKey={`connect-${isAvailable ? 'on' : 'off'}`}>
            <View style={styles.connectCard}>
              <Text style={styles.connectHint}>
                {!isApproved
                  ? 'Tu cuenta aún no está aprobada'
                  : isAvailable
                    ? visibleOrders.length === 0
                      ? 'Buscando pedidos cerca de ti…'
                      : 'Pedidos cerca en el mapa'
                    : 'Conéctate para recibir pedidos'}
              </Text>
              <SlideAction
                label={isAvailable ? 'Desliza para desconectar' : 'Desliza para conectar'}
                completeLabel={isAvailable ? 'Desconectando…' : 'Conectando…'}
                icon={isAvailable ? 'pause' : 'flash'}
                color={isAvailable ? colors.textSecondary : colors.primary}
                disabled={!isApproved || updating}
                loading={updating}
                onComplete={handleConnect}
              />
            </View>
          </SheetEnter>
        )}
      </View>

      <DriverSideMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        profile={profile}
        updating={updating}
        onToggleAvailability={(value) => {
          void toggleAvailability(value);
        }}
        onNavigateInicio={() => navigation.navigate('Inicio')}
        onNavigateEntregas={() => navigation.navigate('Entregas')}
        onNavigatePerfil={() => navigation.navigate('Perfil')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  map: {
    borderRadius: 0,
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  statusCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: 44,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusDotOn: { backgroundColor: colors.success },
  statusDotOff: { backgroundColor: colors.textMuted },
  statusTextWrap: { flex: 1, minWidth: 0 },
  greeting: { fontSize: 13, fontWeight: '800', color: colors.text },
  statusLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  countPill: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  countText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  bottomStack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 10,
  },
  tipBanner: {
    marginHorizontal: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    padding: 12,
  },
  tipText: { flex: 1, fontSize: 13, color: colors.primaryDark, fontWeight: '600', lineHeight: 18 },
  connectCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
    borderTopWidth: 1,
    borderColor: colors.borderLight,
  },
  connectHint: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
