import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';

import CartCheckoutSection from '../../components/CartCheckoutSection';
import CartLineItem from '../../components/CartLineItem';
import EmptyState from '../../components/EmptyState';
import ScreenContainer from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useLocation } from '../../hooks/useLocation';
import type { CartScreenProps } from '../../navigation/types';
import { couponApi, orderApi, restaurantApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { DELIVERY_FEE } from '../../config/delivery';
import { getApiErrorMessage } from '../../utils/apiErrors';

export default function CartScreen({ navigation }: CartScreenProps) {
  const { user } = useAuth();
  const { items, total, updateQuantity, clearCart, restaurantId } = useCart();
  const [address, setAddress] = useState(user?.address ?? '');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'online'>('cash');
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [coverageOk, setCoverageOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [deliveryCoords, setDeliveryCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [addressApproximate, setAddressApproximate] = useState(false);
  const { getCurrentPosition, loading: locating } = useLocation();

  useEffect(() => {
    if (user?.address && !address) {
      setAddress(user.address);
    }
  }, [user?.address]);

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
      Alert.alert('Dirección', 'Escribe una dirección primero.');
      return;
    }
    setGeocoding(true);
    try {
      const { data } = await restaurantApi.geocode(address);
      setDeliveryCoords({ latitude: data.latitude, longitude: data.longitude });
      setAddress(data.display_name);
      setCoverageOk(data.in_coverage);
      setAddressApproximate(!!data.approximate);
      if (data.approximate) {
        Alert.alert(
          'Ubicación aproximada',
          'Encontramos la calle o colonia, pero no el número exacto. Confirma que el punto en el mapa sea correcto, o usa «Usar mi ubicación».',
        );
      } else if (!data.in_coverage) {
        Alert.alert('Fuera de cobertura', 'Esta dirección está fuera de Zinapécuaro.');
      }
    } catch (err) {
      Alert.alert('Geocodificación', getApiErrorMessage(err, 'No se encontró la dirección. Intenta con más detalle.'));
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
      Alert.alert('Cupón aplicado', data.description || data.code);
    } catch (err) {
      setDiscount(0);
      setCouponApplied(false);
      setCouponError(getApiErrorMessage(err, 'Código inválido o no aplicable.'));
      Alert.alert('Cupón', getApiErrorMessage(err, 'Código inválido o no aplicable.'));
    }
  }, [couponCode, total]);

  const handlePinChange = useCallback(async (coord: { latitude: number; longitude: number }) => {
    setDeliveryCoords(coord);
    setAddressApproximate(false);
    try {
      const { data } = await restaurantApi.checkCoverage(coord.latitude, coord.longitude);
      setCoverageOk(data.in_coverage);
    } catch {
      setCoverageOk(null);
    }
  }, []);

  const handleUseMyLocation = useCallback(async () => {
    const coords = await getCurrentPosition();
    if (!coords) {
      Alert.alert('Ubicación', 'Activa el permiso de ubicación para marcar el punto de entrega.');
      return;
    }
    setDeliveryCoords(coords);
    setAddressApproximate(false);
    if (!address.trim()) {
      setAddress('Mi ubicación actual (Zinapécuaro)');
    }
    try {
      const { data } = await restaurantApi.checkCoverage(coords.latitude, coords.longitude);
      setCoverageOk(data.in_coverage);
      if (!data.in_coverage) {
        Alert.alert(
          'GPS fuera de zona',
          'Tu ubicación actual no está en Zinapécuaro. Escribe tu calle y usa «Buscar dirección en mapa».',
        );
      }
    } catch (err) {
      setCoverageOk(null);
      Alert.alert('Cobertura', getApiErrorMessage(err, 'No se pudo verificar la zona de entrega.'));
    }
  }, [address, getCurrentPosition]);

  const handleCheckout = useCallback(async () => {
    if (!restaurantId || items.length === 0) {
      Alert.alert('Carrito vacío');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Error', 'Ingresa la dirección de entrega');
      return;
    }
    if (coverageOk === false) {
      Alert.alert('Cobertura', 'La dirección está fuera de la zona de entrega.');
      return;
    }
    if (!deliveryCoords) {
      Alert.alert(
        'Ubicación',
        'Marca tu punto de entrega en el mapa, con «Buscar dirección» o «Usar mi ubicación».',
      );
      return;
    }
    if (coverageOk !== true) {
      Alert.alert('Cobertura', 'Confirma tu dirección en el mapa antes de pedir.');
      return;
    }
    if (couponValidating) {
      Alert.alert('Cupón', 'Espera a que se actualice el descuento.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await orderApi.create({
        restaurant_id: restaurantId,
        delivery_address: address,
        delivery_latitude: deliveryCoords.latitude,
        delivery_longitude: deliveryCoords.longitude,
        delivery_notes: notes,
        payment_method: paymentMethod,
        coupon_code: couponApplied && couponCode.trim() ? couponCode.trim() : undefined,
        items: items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
        })),
      });
      if (paymentMethod === 'online') {
        const payRes = await orderApi.initiatePayment(data.id);
        if (payRes.data.payment_url) {
          clearCart();
          await Linking.openURL(payRes.data.payment_url);
          navigation.navigate('OrderDetail', { orderId: data.id });
          return;
        }
        if (payRes.data.message) {
          Alert.alert('Pago en línea', payRes.data.message);
        }
      }
      clearCart();
      navigation.navigate('OrderDetail', { orderId: data.id });
    } catch (err) {
      Alert.alert('No se pudo crear el pedido', getApiErrorMessage(err, 'Verifica la dirección e intenta de nuevo.'));
    } finally {
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
    clearCart,
    navigation,
  ]);

  const handleDecrease = useCallback(
    (productId: number, quantity: number) => updateQuantity(productId, quantity - 1),
    [updateQuantity],
  );

  const handleIncrease = useCallback(
    (productId: number, quantity: number) => updateQuantity(productId, quantity + 1),
    [updateQuantity],
  );

  const grandTotal = useMemo(
    () => Math.max(total + DELIVERY_FEE - discount, 0),
    [total, discount],
  );

  if (items.length === 0) {
    return (
      <ScreenContainer>
        <EmptyState
          emoji="🛒"
          title="Tu carrito está vacío"
          subtitle="Explora restaurantes y agrega platillos"
          actionLabel="Ver restaurantes"
          onAction={() => navigation.navigate('Inicio')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Tu pedido</Text>
          {items.map((item) => (
            <CartLineItem
              key={item.product.id}
              item={item}
              onDecrease={handleDecrease}
              onIncrease={handleIncrease}
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
            coverageOk={coverageOk}
            addressApproximate={addressApproximate}
            locating={locating}
            geocoding={geocoding}
            loading={loading}
            couponValidating={couponValidating}
            total={total}
            grandTotal={grandTotal}
            onAddressChange={handleAddressChange}
            onNotesChange={setNotes}
            onPaymentMethodChange={setPaymentMethod}
            onCouponChange={handleCouponChange}
            onApplyCoupon={handleApplyCoupon}
            onUseLocation={handleUseMyLocation}
            onGeocode={handleGeocodeAddress}
            onPinChange={handlePinChange}
            onCheckout={handleCheckout}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: spacing.screen, paddingBottom: spacing.xxl },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 12 },
});
