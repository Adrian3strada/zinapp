import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { cardShadow } from '../theme/shadows';
import { spacing } from '../theme/spacing';

export type ListSkeletonVariant = 'restaurant' | 'order' | 'job' | 'coupon' | 'stat';

interface Props {
  count?: number;
  variant?: ListSkeletonVariant;
  style?: ViewStyle;
}

function Bone({
  width,
  height,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  style?: ViewStyle;
}) {
  return <View style={[styles.bone, { width, height }, style]} />;
}

function RestaurantSkeleton() {
  return (
    <View style={styles.card}>
      <Bone width={72} height={72} style={styles.rounded} />
      <View style={styles.cardBody}>
        <Bone width="70%" height={16} />
        <Bone width="45%" height={12} style={styles.gapSm} />
        <Bone width="90%" height={12} style={styles.gapSm} />
      </View>
    </View>
  );
}

function OrderSkeleton() {
  return (
    <View style={styles.card}>
      <Bone width={48} height={48} style={styles.roundedSm} />
      <View style={styles.cardBody}>
        <Bone width="60%" height={16} />
        <Bone width="35%" height={12} style={styles.gapSm} />
        <Bone width="50%" height={20} style={styles.gapMd} />
      </View>
      <Bone width={56} height={18} />
    </View>
  );
}

function JobSkeleton() {
  return (
    <View style={[styles.card, styles.jobCard]}>
      <View style={styles.jobTop}>
        <Bone width={72} height={22} style={styles.pill} />
        <Bone width={88} height={22} style={styles.pill} />
      </View>
      <View style={styles.jobMain}>
        <Bone width={48} height={48} style={styles.roundedSm} />
        <View style={styles.cardBody}>
          <Bone width="55%" height={16} />
          <Bone width="80%" height={12} style={styles.gapSm} />
          <Bone width="95%" height={12} style={styles.gapSm} />
        </View>
        <Bone width={52} height={18} />
      </View>
      <Bone width="100%" height={44} style={styles.gapMd} />
    </View>
  );
}

function CouponSkeleton() {
  return (
    <View style={[styles.card, styles.couponCard]}>
      <View style={styles.rowBetween}>
        <Bone width={100} height={28} style={styles.pill} />
        <Bone width={120} height={16} />
      </View>
      <Bone width="85%" height={12} style={styles.gapMd} />
      <Bone width="100%" height={44} style={styles.gapMd} />
    </View>
  );
}

function StatSkeleton() {
  return (
    <View style={styles.statGrid}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.statCard}>
          <Bone width={28} height={28} style={styles.roundedSm} />
          <Bone width={48} height={28} style={styles.gapSm} />
          <Bone width="80%" height={12} style={styles.gapSm} />
        </View>
      ))}
    </View>
  );
}

const VARIANTS: Record<ListSkeletonVariant, React.ComponentType> = {
  restaurant: RestaurantSkeleton,
  order: OrderSkeleton,
  job: JobSkeleton,
  coupon: CouponSkeleton,
  stat: StatSkeleton,
};

export default function ListSkeleton({ count = 4, variant = 'restaurant', style }: Props) {
  const Item = VARIANTS[variant];

  if (variant === 'stat') {
    return (
      <View style={[styles.wrap, style]}>
        <Item />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      {Array.from({ length: count }, (_, i) => (
        <Item key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  bone: {
    backgroundColor: colors.borderLight,
    borderRadius: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  jobCard: { flexDirection: 'column', alignItems: 'stretch' },
  couponCard: { flexDirection: 'column', alignItems: 'stretch' },
  cardBody: { flex: 1, gap: 4 },
  rounded: { borderRadius: 18 },
  roundedSm: { borderRadius: 14 },
  pill: { borderRadius: 10 },
  gapSm: { marginTop: 6 },
  gapMd: { marginTop: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobTop: { flexDirection: 'row', justifyContent: 'space-between' },
  jobMain: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 6,
    ...cardShadow,
  },
});
