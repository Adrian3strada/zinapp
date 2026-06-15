import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmptyState from '../../components/EmptyState';
import ScreenContainer from '../../components/ScreenContainer';
import type { OffersScreenProps } from '../../navigation/types';
import { couponApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { PublicCoupon } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { formatCurrency } from '../../utils/format';

function formatDiscount(coupon: PublicCoupon): string {
  if (coupon.discount_percent > 0) {
    return `${coupon.discount_percent}% de descuento`;
  }
  const fixed = parseFloat(coupon.discount_fixed);
  if (fixed > 0) return `${formatCurrency(fixed)} de descuento`;
  return 'Promoción especial';
}

function CouponCard({
  coupon,
  onUse,
}: {
  coupon: PublicCoupon;
  onUse: () => void;
}) {
  return (
    <View style={styles.couponCard}>
      <LinearGradient colors={['#FFF8E7', colors.surface]} style={styles.couponGradient}>
        <View style={styles.couponTop}>
          <View style={styles.codeBadge}>
            <Ionicons name="pricetag" size={14} color={colors.warning} />
            <Text style={styles.codeText}>{coupon.code}</Text>
          </View>
          <Text style={styles.discount}>{formatDiscount(coupon)}</Text>
        </View>
        {!!coupon.description && (
          <Text style={styles.couponDesc}>{coupon.description}</Text>
        )}
        {parseFloat(coupon.min_order_amount) > 0 && (
          <Text style={styles.couponMin}>
            Pedido mínimo: {formatCurrency(coupon.min_order_amount)}
          </Text>
        )}
        <Pressable style={styles.useBtn} onPress={onUse}>
          <Text style={styles.useBtnText}>Usar en comida</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </Pressable>
      </LinearGradient>
    </View>
  );
}

export default function OffersScreen({ navigation }: OffersScreenProps) {
  const insets = useSafeAreaInsets();
  const [coupons, setCoupons] = useState<PublicCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const { data } = await couponApi.listActive();
      setCoupons(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar las ofertas'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const goToFood = useCallback(() => {
    navigation.navigate('Comida');
  }, [navigation]);

  return (
    <ScreenContainer loading={loading && coupons.length === 0} error={error} onRetry={() => load()}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
      >
        <LinearGradient colors={['#E85D04', '#C44D00']} style={styles.hero}>
          <Text style={styles.heroEmoji}>🏷️</Text>
          <Text style={styles.heroTitle}>Ofertas</Text>
          <Text style={styles.heroSub}>
            Cupones activos para tu próximo pedido de comida
          </Text>
        </LinearGradient>

        {coupons.length === 0 && !loading && !error ? (
          <EmptyState
            emoji="🏷️"
            title="Sin ofertas activas"
            subtitle="Vuelve pronto — publicaremos promociones aquí"
            actionLabel="Ver restaurantes"
            onAction={goToFood}
          />
        ) : (
          coupons.map((coupon) => (
            <CouponCard key={coupon.id} coupon={coupon} onUse={goToFood} />
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.screen },
  hero: {
    marginHorizontal: -spacing.screen,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroEmoji: { fontSize: 40, marginBottom: 8 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  heroSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  couponCard: {
    borderRadius: 16,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...cardShadow,
  },
  couponGradient: { padding: spacing.lg },
  couponTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warning + '22',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  codeText: { fontSize: 16, fontWeight: '800', color: colors.warning, letterSpacing: 1 },
  discount: { fontSize: 14, fontWeight: '700', color: colors.primary, flex: 1, textAlign: 'right' },
  couponDesc: { fontSize: 14, color: colors.text, marginTop: 10, lineHeight: 20 },
  couponMin: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  useBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
  },
  useBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
});
