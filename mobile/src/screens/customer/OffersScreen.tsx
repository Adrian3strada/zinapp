import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import EmptyState from '../../components/EmptyState';
import ScreenContainer from '../../components/ScreenContainer';
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
  const [coupons, setCoupons] = useState<PublicCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await couponApi.listActive();
      setCoupons(data);
    } catch (err) {
      appAlert('Ofertas', getApiErrorMessage(err, 'No se pudieron cargar los cupones.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

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
            Copia el código y úsalo en el carrito al confirmar tu pedido.
          </Text>
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              emoji="🏷️"
              title="Sin ofertas activas"
              subtitle="Vuelve pronto o pide sin cupón"
              actionLabel="Ver restaurantes"
              onAction={() => navigation.navigate('Comida')}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, cardShadow]}
            onPress={() => {
              appAlert('Cupón', `Usa el código ${item.code.toUpperCase()} en tu carrito.`);
            }}
          >
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
          </Pressable>
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
});
