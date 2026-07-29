import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Button from './Button';
import LiveBadge from './LiveBadge';
import OrderStatusBadge from './OrderStatusBadge';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { cardShadow } from '../theme/shadows';
import { formatCurrency } from '../utils/format';
import FoodImage from './FoodImage';
import { getRestaurantVisual } from '../utils/foodVisuals';

export type DriverJobKind = 'order' | 'shipment';

interface Line {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  text: string;
}

interface Props {
  kind: DriverJobKind;
  id: number;
  title: string;
  subtitle?: string;
  lines: Line[];
  total: string;
  status?: string;
  statusLabel?: string;
  restaurantName?: string;
  onPress: () => void;
  onAccept?: () => void;
  acceptLabel?: string;
  acceptDisabled?: boolean;
  acceptLoading?: boolean;
  onNavigate?: () => void;
  onDelivered?: () => void;
  onPickedUp?: () => void;
  showActions?: boolean;
  navigateLabel?: string;
}

export default function DriverJobCard({
  kind,
  title,
  subtitle,
  lines,
  total,
  status,
  statusLabel,
  restaurantName,
  onPress,
  onAccept,
  acceptLabel = 'Aceptar entrega',
  acceptDisabled,
  acceptLoading,
  onNavigate,
  onDelivered,
  onPickedUp,
  showActions,
  navigateLabel = 'Navegar',
}: Props) {
  const isFood = kind === 'order';
  const visual = getRestaurantVisual(restaurantName ?? '');
  const isLive = status === 'on_the_way';
  const isPickup = status === 'picked_up';
  const isReady = status === 'ready';

  return (
    <View style={[styles.card, (isLive || isPickup) && styles.cardLive, isReady && styles.cardReady]}>
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        <View style={styles.typeRow}>
          <View style={[styles.typeBadge, isFood ? styles.typeFood : styles.typeShipment]}>
            <Ionicons
              name={isFood ? 'restaurant' : 'cube'}
              size={14}
              color={isFood ? colors.primary : colors.shipmentStart}
            />
          </View>
          {status && statusLabel ? (
            isLive || isPickup ? (
              <LiveBadge label={isLive ? 'En ruta' : 'Recogida'} />
            ) : (
              <OrderStatusBadge status={status} label={statusLabel} />
            )
          ) : null}
        </View>

        <View style={styles.mainRow}>
          {isFood ? (
            <FoodImage emoji={visual.emoji} color={visual.color} size="sm" />
          ) : (
            <View style={styles.shipmentIcon}>
              <Text style={styles.shipmentEmoji}>📦</Text>
            </View>
          )}
          <View style={styles.info}>
            <Text style={styles.title}>{title}</Text>
            {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            <View style={styles.linesWrap}>
              {lines.map((line, i) => (
                <View key={i} style={styles.lineRow}>
                  <View style={styles.lineIcon}>
                    <Ionicons name={line.icon} size={13} color={line.iconColor ?? colors.primaryDark} />
                  </View>
                  <Text style={styles.lineText} numberOfLines={2}>
                    {line.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.totalWrap}>
            <Text style={styles.totalLabel}>Ganar</Text>
            <Text style={styles.total}>{formatCurrency(total)}</Text>
          </View>
        </View>
      </Pressable>

      {onAccept ? (
        <Button
          title={acceptLabel}
          onPress={onAccept}
          disabled={acceptDisabled}
          loading={acceptLoading}
          style={styles.actionBtn}
        />
      ) : null}

      {showActions ? (
        <View style={styles.actions}>
          {onNavigate ? (
            <Pressable style={[styles.actionChip, styles.actionChipPrimary]} onPress={onNavigate}>
              <Ionicons name="navigate" size={16} color="#FFF" />
              <Text style={[styles.actionChipText, styles.actionChipTextPrimary]}>{navigateLabel}</Text>
            </Pressable>
          ) : null}
          {onPickedUp ? (
            <Pressable style={[styles.actionChip, styles.actionChipPrimary]} onPress={onPickedUp}>
              <Ionicons name="bag-check-outline" size={16} color="#FFF" />
              <Text style={[styles.actionChipText, styles.actionChipTextPrimary]}>Recogido</Text>
            </Pressable>
          ) : null}
          {onDelivered ? (
            <Pressable style={[styles.actionChip, styles.actionChipSuccess]} onPress={onDelivered}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#FFF" />
              <Text style={[styles.actionChipText, styles.actionChipTextPrimary]}>Entregado</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  cardLive: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  cardReady: {
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  pressed: { opacity: 0.94 },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  typeBadge: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeFood: { backgroundColor: colors.primaryLight },
  typeShipment: { backgroundColor: '#EEF2FF' },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },
  typeFoodText: { color: colors.primary },
  typeShipmentText: { color: colors.shipmentStart },
  badgeRow: { flexDirection: 'row', gap: 6, flexShrink: 1 },
  mainRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  shipmentIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shipmentEmoji: { fontSize: 24 },
  info: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2, fontWeight: '500' },
  linesWrap: { marginTop: 8, gap: 6 },
  lineRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  lineIcon: {
    width: 22,
    height: 22,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  lineText: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 17, fontWeight: '500' },
  totalWrap: { alignItems: 'flex-end', gap: 2 },
  totalLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase' },
  total: { fontSize: 17, fontWeight: '700', color: colors.primaryDark },
  actionBtn: { marginTop: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionChip: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary + '55',
  },
  actionChipPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionChipSuccess: { backgroundColor: colors.success, borderColor: colors.success },
  actionChipText: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },
  actionChipTextPrimary: { color: '#FFF' },
});
