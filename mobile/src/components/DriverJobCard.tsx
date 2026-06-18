import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Button from './Button';
import LiveBadge from './LiveBadge';
import OrderStatusBadge from './OrderStatusBadge';
import { colors } from '../theme/colors';
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
}: Props) {
  const isFood = kind === 'order';
  const visual = getRestaurantVisual(restaurantName ?? '');
  const isLive = status === 'on_the_way';
  const isPickup = status === 'picked_up';

  return (
    <View style={[styles.card, (isLive || isPickup) && styles.cardLive]}>
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        <View style={styles.typeRow}>
          <View style={[styles.typeBadge, isFood ? styles.typeFood : styles.typeShipment]}>
            <Ionicons
              name={isFood ? 'restaurant' : 'cube'}
              size={12}
              color={isFood ? colors.primary : '#E76F51'}
            />
            <Text style={[styles.typeBadgeText, isFood ? styles.typeFoodText : styles.typeShipmentText]}>
              {isFood ? 'Comida' : 'Envío'}
            </Text>
          </View>
          {status && statusLabel && (
            <View style={styles.badgeRow}>
              <OrderStatusBadge status={status} label={statusLabel} />
              {isLive && <LiveBadge label="Activo" />}
              {isPickup && <LiveBadge label="Recogida" />}
            </View>
          )}
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
            {lines.map((line, i) => (
              <View key={i} style={styles.lineRow}>
                <Ionicons name={line.icon} size={14} color={line.iconColor ?? colors.textMuted} />
                <Text style={styles.lineText} numberOfLines={2}>{line.text}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.total}>{formatCurrency(total)}</Text>
        </View>
      </Pressable>

      {onAccept && (
        <Button
          title={acceptLabel}
          onPress={onAccept}
          disabled={acceptDisabled}
          loading={acceptLoading}
          style={styles.actionBtn}
        />
      )}

      {showActions && (
        <View style={styles.actions}>
          {onNavigate && (
            <Button title="Mapa y navegar" variant="secondary" onPress={onNavigate} />
          )}
          {onPickedUp && (
            <Button title="Marcar recogido" onPress={onPickedUp} />
          )}
          {onDelivered && (
            <Button title="Marcar entregado" onPress={onDelivered} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  cardLive: {
    borderColor: colors.success + '66',
    backgroundColor: colors.primaryLight + '44',
  },
  pressed: { opacity: 0.94 },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  typeFood: { backgroundColor: colors.primaryLight },
  typeShipment: { backgroundColor: '#E76F5122' },
  typeBadgeText: { fontSize: 11, fontWeight: '800' },
  typeFoodText: { color: colors.primary },
  typeShipmentText: { color: '#C45C3E' },
  badgeRow: { flexDirection: 'row', gap: 6, flexShrink: 1 },
  mainRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  shipmentIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#2A9D8F22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shipmentEmoji: { fontSize: 24 },
  info: { flex: 1 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  lineRow: { flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'flex-start' },
  lineText: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  total: { fontSize: 16, fontWeight: '800', color: colors.primary },
  actionBtn: { marginTop: 12 },
  actions: { marginTop: 12, gap: 8 },
});
