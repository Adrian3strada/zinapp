import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { appAlert } from '../../utils/appAlert';

import CartCheckoutSection, {
  scheduleKeyToIso,
  type ScheduleKey,
} from '../../components/CartCheckoutSection';
import CartLineItem from '../../components/CartLineItem';
import EmptyState from '../../components/EmptyState';
import ScreenContainer from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useLocation } from '../../hooks/useLocation';
import type { CartScreenProps } from '../../navigation/types';
import { couponApi, orderApi, restaurantApi, authApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { DELIVERY_FEE } from '../../config/delivery';
import { resolveTransferInfo } from '../../config/payments';
import type { Restaurant, SelectedProductOption } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { keyboardAvoidingBehavior } from '../../utils/webPlatform';
import { isInCoverage } from '../../utils/coverage';
import { createIdempotencyKey } from '../../utils/idempotency';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import { toCoordinate } from '../../utils/maps';
import { runWithRetry } from '../../utils/runWithRetry';

export default function CartScreen({ navigation, route }: CartScreenProps) {
  const { user, refreshUser, requestLogin } = useAuth();
  const { keyboardWithHeader, tabBottomPadding } = useTabScreenInsets();
  const { config: appConfig } = useAppConfig();
  const { items, total, updateQuantity, updateItemNotes, clearCart, restaurantId } = useCart();
  const [address, setAddress] = useState(user?.address ?? '');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'online'>('cash');
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [tipAmount, setTipAmount] = useState(0);
  const [scheduleKey, setScheduleKey] = useState<ScheduleKey>('asap');
  const [coverageOk, setCoverageOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [deliveryCoords, setDeliveryCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [addressApproximate, setAddressApproximate] = useState(false);
  const [cartRestaurant, setCartRestaurant] = useState<Restaurant | null>(null);
  const checkoutInFlight = useRef(false);
  const checkoutIdempotencyKey = useRef<string | null>(null);
  const pendingCouponApply = useRef<string | null>(null);
  const { getCurrentPosition, loading: locating } = useLocation();
  const transferInfo = useMemo(
    () =>
      resolveTransferInfo({
        whatsapp: appConfig.support_whatsapp,
      }),
    [appConfig.support_whatsapp],
  );

  useEffect(() => {
    if (!restaurantId) {
      setCartRestaurant(null);
      return;
    }
    let cancelled = false;
    restaurantApi
      .get(restaurantId)
      .then(({ data }) => {
        if (!cancelled) setCartRestaurant(data);
      })
      .catch(() => {
        if (!cancelled) setCartRestaurant(null);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);
  useEffect(() => {
    if (user?.address && !address) {
      setAddress(user.address);
    }
  }, [user?.address]);

  useEffect(() => {
    const code = route.params?.couponCode?.trim();
    if (!code) return;
    setCouponCode(code.toUpperCase());
    setCouponApplied(false);
    setDiscount(0);
    setCouponError(null);
    pendingCouponApply.current = code.toUpperCase();
    navigation.setParams({ couponCode: undefined });
  }, [route.params?.couponCode, navigation]);

  useEffect(() => {
    const pending = pendingCouponApply.current;
    if (!pending || items.length === 0) return;
    let cancelled = false;
    (async () => {
      setCouponValidating(true);
      try {
        const { data } = await couponApi.validate(pending, total);
        if (cancelled) return;
        setDiscount(parseFloat(data.discount_amount));
        setCouponApplied(true);
        setCouponError(null);
        pendingCouponApply.current = null;
      } catch (err) {
        if (cancelled) return;
        setDiscount(0);
        setCouponApplied(false);
        setCouponError(getApiErrorMessage(err, 'Código inválido o no aplicable.'));
        pendingCouponApply.current = null;
      } finally {
        if (!cancelled) setCouponValidating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items.length, total]);

  useEffect(() => {
    if (!couponApplied || !couponCode.trim()) return;

    let cancelled = false;
    setCouponValidating(true);
    const timeout = setTimeout(() => {
      if (!cancelled) setCouponValidating(false);
    }, 12000);

    (async () => {
      try {
        const { data } = await couponApi.validate(couponCode.trim(), total);
        if (!cancelled) {
          setDiscount(parseFloat(data.discount_amount));
          setCouponError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setDiscount(0);
          setCouponApplied(false);
          setCouponError(getApiErrorMessage(err, 'El cupón ya no aplica con este carrito'));
        }
      } finally {
        if (!cancelled) setCouponValidating(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [total, items.length, couponCode, couponApplied]);

  const handleCouponChange = useCallback((text: string) => {
    setCouponCode(text);
    setCouponApplied(false);
    setDiscount(0);
    setCouponError(null);
  }, []);

  const handleAddressChange = useCallback((text: string) => {
    setAddress(text);
    setDeliveryCoords(null);
    setCoverageOk(null);
    setAddressApproximate(false);
  }, []);

  const handleGeocodeAddress = useCallback(async () => {
    if (!address.trim()) {
      appAlert('Dirección', 'Escribe una dirección primero.');
      return;
    }
    setGeocoding(true);
    try {
      const { data } = await runWithRetry(() => restaurantApi.geocode(address));
      setDeliveryCoords({ latitude: data.latitude, longitude: data.longitude });
      setAddress(data.display_name);
      setCoverageOk(data.in_coverage);
      setAddressApproximate(!!data.approximate);
      if (data.approximate) {
        appAlert(
          'Ubicación aproximada',
          'Encontramos la calle o colonia, pero no el número exacto. Si hace falta, ajusta la dirección escrita.',
        );
      } else if (!data.in_coverage) {
        appAlert('Fuera de cobertura', 'Esta dirección está fuera de Zinapécuaro.');
      }
    } catch (err) {
      appAlert('Geocodificación', getApiErrorMessage(err, 'No se encontró la dirección. Intenta con más detalle.'));
    } finally {
      setGeocoding(false);
    }
  }, [address]);

  const handleApplyCoupon = useCallback(async () => {
    if (!couponCode.trim()) return;
    try {
      const { data } = await couponApi.validate(couponCode.trim(), total);
      setDiscount(parseFloat(data.discount_amount));
      setCouponApplied(true);
      setCouponError(null);
      appAlert('Cupón aplicado', data.description || data.code);
    } catch (err) {
      setDiscount(0);
      setCouponApplied(false);
      setCouponError(getApiErrorMessage(err, 'Código inválido o no aplicable.'));
      appAlert('Cupón', getApiErrorMessage(err, 'Código inválido o no aplicable.'));
    }
  }, [couponCode, total]);

  const handleUseMyLocation = useCallback(async () => {
    const coords = await getCurrentPosition();
    if (!coords) {
      appAlert('Ubicación', 'Activa el permiso de ubicación para marcar el punto de entrega.');
      return;
    }
    setDeliveryCoords(coords);
    setAddressApproximate(false);
    if (!address.trim()) {
      setAddress('Mi ubicación actual (Zinapécuaro)');
    }

    const localOk = isInCoverage(coords.latitude, coords.longitude);
    setCoverageOk(localOk);

    if (!localOk) {
      appAlert(
        'GPS fuera de zona',
        'Tu ubicación no está en Zinapécuaro. Escribe tu calle y usa «Buscar dirección».',
      );
      return;
    }

    try {
      const { data } = await restaurantApi.checkCoverage(coords.latitude, coords.longitude);
      setCoverageOk(data.in_coverage);
    } catch {
      // Mantener verificación local; no bloquear si Railway tarda en despertar
    }
  }, [address, getCurrentPosition]);

  const handlePinChange = useCallback((coord: { latitude: number; longitude: number }) => {
    setDeliveryCoords(coord);
    setAddressApproximate(false);
    setCoverageOk(isInCoverage(coord.latitude, coord.longitude));
  }, []);

  useEffect(() => {
    if (!appConfig.online_payments_enabled && paymentMethod === 'online') {
      setPaymentMethod('cash');
    }
  }, [appConfig.online_payments_enabled, paymentMethod]);

  const offerSaveAddress = useCallback(
    (savedAddress: string) => {
      if (user?.role !== 'customer') return;
      const trimmed = savedAddress.trim();
      if (!trimmed || trimmed === (user.address ?? '').trim()) return;
      appAlert(
        '¿Guardar dirección?',
        'Usar esta dirección como tu dirección habitual para próximos pedidos.',
        [
          { text: 'Ahora no', style: 'cancel' },
          {
            text: 'Guardar',
            onPress: async () => {
              try {
                const fd = new FormData();
                fd.append('address', trimmed);
                await authApi.updateMeForm(fd);
                await refreshUser();
              } catch {
                // opcional; no bloquear flujo
              }
            },
          },
        ],
      );
    },
    [user?.role, user?.address, refreshUser],
  );

  const handleCheckout = useCallback(async () => {
    if (checkoutInFlight.current || loading) return;
    if (!user) {
      appAlert(
        'Inicia sesión',
        'Necesitas una cuenta para confirmar tu pedido.',
        [
          { text: 'Ahora no', style: 'cancel' },
          { text: 'Entrar', onPress: requestLogin },
        ],
      );
      return;
    }
    if (!restaurantId || items.length === 0) {
      appAlert('Carrito vacío');
      return;
    }
    if (!address.trim()) {
      appAlert('Error', 'Ingresa la dirección de entrega');
      return;
    }
    if (coverageOk === false) {
      appAlert('Cobertura', 'La dirección está fuera de la zona de entrega.');
      return;
    }
    if (!deliveryCoords) {
      appAlert(
        'Ubicación',
        'Usa «Buscar dirección» o «Usar mi ubicación GPS» antes de confirmar.',
      );
      return;
    }
    if (coverageOk !== true) {
      appAlert('Cobertura', 'Confirma tu dirección con «Buscar dirección» antes de pedir.');
      return;
    }
    if (couponValidating) {
      appAlert('Cupón', 'Espera a que se actualice el descuento.');
      return;
    }

    checkoutInFlight.current = true;
    setLoading(true);
    if (!checkoutIdempotencyKey.current) {
      checkoutIdempotencyKey.current = createIdempotencyKey();
    }
    try {
      const scheduledFor = scheduleKeyToIso(scheduleKey);
      const { data } = await orderApi.create({
        restaurant_id: restaurantId,
        delivery_address: address,
        delivery_latitude: deliveryCoords.latitude,
        delivery_longitude: deliveryCoords.longitude,
        delivery_notes: notes,
        payment_method: paymentMethod,
        coupon_code: couponApplied && couponCode.trim() ? couponCode.trim() : undefined,
        tip_amount: tipAmount > 0 ? tipAmount : undefined,
        scheduled_for: scheduledFor,
        items: items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          notes: i.notes?.trim() || undefined,
          option_ids: i.selectedOptions?.map((o) => o.id),
        })),
      }, { idempotencyKey: checkoutIdempotencyKey.current });
      if (paymentMethod === 'online') {
        const payRes = await orderApi.initiatePayment(data.id);
        clearCart();
        checkoutIdempotencyKey.current = null;
        if (payRes.data.payment_url) {
          await Linking.openURL(payRes.data.payment_url);
        } else if (payRes.data.message) {
          appAlert(
            'Pedido creado — pago pendiente',
            `${payRes.data.message}\n\nPuedes pagar desde el detalle del pedido.`,
          );
        }
        offerSaveAddress(address);
        navigation.navigate('OrderDetail', { orderId: data.id });
        return;
      }
      clearCart();
      checkoutIdempotencyKey.current = null;
      offerSaveAddress(address);
      navigation.navigate('OrderDetail', { orderId: data.id });
    } catch (err) {
      appAlert('No se pudo crear el pedido', getApiErrorMessage(err, 'Verifica la dirección e intenta de nuevo.'));
    } finally {
      checkoutInFlight.current = false;
      setLoading(false);
    }
  }, [
    restaurantId,
    items,
    address,
    coverageOk,
    deliveryCoords,
    couponValidating,
    notes,
    paymentMethod,
    couponApplied,
    couponCode,
    tipAmount,
    scheduleKey,
    loading,
    clearCart,
    navigation,
    offerSaveAddress,
    user,
    requestLogin,
  ]);

  const handleDecrease = useCallback(
    (productId: number, quantity: number, notes?: string, selectedOptions?: SelectedProductOption[]) =>
      updateQuantity(productId, quantity - 1, notes, selectedOptions),
    [updateQuantity],
  );

  const handleIncrease = useCallback(
    (productId: number, quantity: number, notes?: string, selectedOptions?: SelectedProductOption[]) =>
      updateQuantity(productId, quantity + 1, notes, selectedOptions),
    [updateQuantity],
  );

  const grandTotal = useMemo(
    () => Math.max(total + DELIVERY_FEE + tipAmount - discount, 0),
    [total, discount, tipAmount],
  );

  const routePreview = useMemo(() => {
    const from = toCoordinate(cartRestaurant?.latitude, cartRestaurant?.longitude);
    if (!from || !deliveryCoords) return null;
    return {
      from,
      to: deliveryCoords,
      fromTitle: cartRestaurant?.name,
    };
  }, [cartRestaurant, deliveryCoords]);

  if (items.length === 0) {
    return (
      <ScreenContainer>
        <View style={[styles.emptyWrap, { paddingBottom: tabBottomPadding() }]}>
          <EmptyState
            emoji="🛒"
            title="Tu carrito está vacío"
            subtitle="Explora restaurantes y agrega platillos"
            actionLabel="Ver restaurantes"
            onAction={() => navigation.navigate('Inicio')}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={keyboardAvoidingBehavior()}
        keyboardVerticalOffset={keyboardWithHeader()}
      >
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingBottom: tabBottomPadding(spacing.xl) },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.orderHeader}>
            <View style={styles.orderHeaderText}>
              <Text style={styles.sectionTitle}>{cartRestaurant?.name ?? 'Tu pedido'}</Text>
              {cartRestaurant ? (
                <Text style={styles.restaurantSub}>
                  {items.length} artículo{items.length !== 1 ? 's' : ''} · Revisa y confirma abajo
                </Text>
              ) : null}
            </View>
          </View>
          {items.map((item) => (
            <CartLineItem
              key={`${item.product.id}:${item.notes ?? ''}:${(item.selectedOptions ?? []).map((o) => o.id).join(',')}`}
              item={item}
              onDecrease={handleDecrease}
              onIncrease={handleIncrease}
              onNotesChange={updateItemNotes}
            />
          ))}
          <CartCheckoutSection
            address={address}
            notes={notes}
            paymentMethod={paymentMethod}
            couponCode={couponCode}
            couponApplied={couponApplied}
            couponError={couponError}
            discount={discount}
            deliveryCoords={deliveryCoords}
            routePreview={routePreview}
            coverageOk={coverageOk}
            addressApproximate={addressApproximate}
            locating={locating}
            geocoding={geocoding}
            loading={loading}
            couponValidating={couponValidating}
            total={total}
            grandTotal={grandTotal}
            tipAmount={tipAmount}
            scheduleKey={scheduleKey}
            transferInfo={transferInfo}
            onlinePaymentsEnabled={appConfig.online_payments_enabled}
            onAddressChange={handleAddressChange}
            onNotesChange={setNotes}
            onPaymentMethodChange={setPaymentMethod}
            onCouponChange={handleCouponChange}
            onApplyCoupon={handleApplyCoupon}
            onBrowseOffers={() => navigation.navigate('Ofertas')}
            onUseLocation={handleUseMyLocation}
            onGeocode={handleGeocodeAddress}
            onPinChange={handlePinChange}
            onCheckout={handleCheckout}
            onTipChange={setTipAmount}
            onScheduleChange={setScheduleKey}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  emptyWrap: { flex: 1, justifyContent: 'center' },
  list: { padding: spacing.screen },
  orderHeader: { marginBottom: 14 },
  orderHeaderText: { gap: 4 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  restaurantSub: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
});
