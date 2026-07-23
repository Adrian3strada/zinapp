import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from '../../utils/maps';
import type { StreetRouteSegment } from '../../utils/routing';

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

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: initial.coords.latitude,
          longitude: initial.coords.longitude,
        });
      } catch {
        // keep default region
      }
      subscription = await Location.watchPositionAsync(
        {
          accuracy: hasActiveDelivery
            ? Location.Accuracy.BestForNavigation
            : Location.Accuracy.Balanced,
          distanceInterval: hasActiveDelivery ? 5 : 12,
          timeInterval: hasActiveDelivery ? 2500 : 5000,
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
  }, [hasActiveDelivery]);

  const deliveryStep: ActiveDeliveryStep | null = useMemo(() => {
    if (!activeOrder) return null;
    // force re-read when pickupTick changes
    void pickupTick;
    return getActiveDeliveryStep(activeOrder.id);
  }, [activeOrder, pickupTick]);

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
    if (!activeOrder || !nextStopCoord || !userLocation) return [];
    return [
      {
        id: 'to-next-stop',
        from: userLocation,
        to: nextStopCoord,
        strokeColor: colors.accent,
        strokeWidth: 4,
        dynamic: true,
      },
    ];
  }, [activeOrder, nextStopCoord, userLocation]);

  const { polylines, stats } = useStreetRoutes(routeSegments);
  const nextStopStats = stats['to-next-stop'] ?? null;

  const markers = useMemo((): MapMarker[] => {
    const list: MapMarker[] = [];
    if (isValidCoordinate(userLocation)) {
      list.push({
        id: 'me',
        coordinate: userLocation,
        title: 'Tú',
        pinType: 'driver',
      });
    }

    if (activeOrder) {
      if (restaurantCoord) {
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
  }, [userLocation, activeOrder, restaurantCoord, deliveryCoord, visibleOrders]);

  const mapRegion = useMemo(() => {
    if (activeOrder) {
      const coords = [userLocation, restaurantCoord, deliveryCoord, nextStopCoord].filter(
        isValidCoordinate,
      );
      if (coords.length) return regionForCoordinates(coords);
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
  }, [activeOrder, offerOrder, userLocation, restaurantCoord, deliveryCoord, nextStopCoord]);

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
        height={mapHeight}
        region={mapRegion}
        markers={markers}
        polylines={activeOrder ? polylines : []}
        followMarkerId={activeOrder && userLocation ? 'me' : offerOrder ? null : 'me'}
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
            <ActivityIndicator size="small" color={colors.accent} />
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
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.accentDark} />
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
                color={isAvailable ? colors.textSecondary : colors.accent}
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
    backgroundColor: colors.accent,
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
    backgroundColor: colors.accentLight,
    borderRadius: 16,
    padding: 12,
  },
  tipText: { flex: 1, fontSize: 13, color: colors.accentDark, fontWeight: '600', lineHeight: 18 },
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
