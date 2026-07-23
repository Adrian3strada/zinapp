import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import EmptyState from '../../components/EmptyState';
import ScreenContainer from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import type { OffersScreenProps } from '../../navigation/types';
import { couponApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { PublicCoupon } from '../../types';
import { appAlert } from '../../utils/appAlert';
import { formatCurrency } from '../../utils/format';
import { getApiErrorMessage } from '../../utils/apiErrors';

function discountLabel(coupon: PublicCoupon): string {
  if (coupon.discount_percent > 0) return `${coupon.discount_percent}% de descuento`;
  const fixed = parseFloat(coupon.discount_fixed);
  if (fixed > 0) return `${formatCurrency(coupon.discount_fixed)} de descuento`;
  return 'Descuento especial';
}

export default function OffersScreen({ navigation }: OffersScreenProps) {
  const { user, isGuest, requestLogin } = useAuth();
  const [coupons, setCoupons] = useState<PublicCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user || isGuest) {
      setCoupons([]);
      setLoading(false);
      return;
    }
    try {
      const { data } = await couponApi.listActive();
      setCoupons(data);
    } catch (err) {
      appAlert('Ofertas', getApiErrorMessage(err, 'No se pudieron cargar los cupones.'));
    } finally {
      setLoading(false);
    }
  }, [user, isGuest]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const useInCart = useCallback(
    (coupon: PublicCoupon) => {
      navigation.navigate('Main', {
        screen: 'Carrito',
        params: { couponCode: coupon.code },
      });
    },
    [navigation],
  );

  return (
    <ScreenContainer>
      <FlatList
        data={coupons}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <Text style={styles.subtitle}>
            Elige un cupón y lo llevamos al carrito listo para aplicar.
          </Text>
        }
        ListEmptyComponent={
          !loading ? (
            isGuest || !user ? (
              <EmptyState
                emoji="🏷️"
                title="Inicia sesión para ver cupones"
                subtitle="Los códigos de descuento solo están disponibles con tu cuenta."
                actionLabel="Iniciar sesión"
                onAction={requestLogin}
              />
            ) : (
              <EmptyState
                emoji="🏷️"
                title="Sin ofertas activas"
                subtitle="Vuelve pronto o pide sin cupón"
                actionLabel="Ver restaurantes"
                onAction={() => navigation.navigate('Comida')}
              />
            )
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.card, cardShadow]}>
            <View style={styles.cardTop}>
              <Text style={styles.code}>{item.code.toUpperCase()}</Text>
              <Ionicons name="pricetag" size={22} color={colors.primary} />
            </View>
            <Text style={styles.discount}>{discountLabel(item)}</Text>
            {item.description ? (
              <Text style={styles.desc}>{item.description}</Text>
            ) : null}
            {parseFloat(item.min_order_amount) > 0 && (
              <Text style={styles.min}>
                Mínimo de pedido: {formatCurrency(item.min_order_amount)}
              </Text>
            )}
            <Pressable style={styles.useBtn} onPress={() => useInCart(item)}>
              <Text style={styles.useBtnText}>Usar en el carrito</Text>
              <Ionicons name="cart-outline" size={16} color="#FFF" />
            </Pressable>
          </View>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.screen, gap: 12, flexGrow: 1 },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 20, fontWeight: '900', color: colors.primary, letterSpacing: 1 },
  discount: { fontSize: 15, fontWeight: '700', color: colors.text },
  desc: { fontSize: 13, color: colors.textSecondary },
  min: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  useBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
  },
  useBtnText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
});
