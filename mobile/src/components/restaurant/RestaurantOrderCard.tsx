import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Button from '../Button';
import OrderStatusBadge from '../OrderStatusBadge';
import { colors, statusColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { Order } from '../../types';
import { formatOrderLabel } from '../../utils/orderDisplay';
import { formatCurrency, formatTimeAgo } from '../../utils/format';

interface Props {
  order: Order;
  onPress: () => void;
  onAdvance?: () => void;
  advanceLabel?: string;
  busy?: boolean;
}

function customerName(order: Order): string {
  const c = order.customer_detail;
  if (!c) return 'Cliente';
  const full = [c.first_name, c.last_name].filter(Boolean).join(' ');
  return full || c.username;
}

function usePrepCountdown(estimatedReadyAt?: string | null): {
  label: string;
  overdue: boolean;
} | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!estimatedReadyAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [estimatedReadyAt]);

  if (!estimatedReadyAt) return null;
  const target = new Date(estimatedReadyAt).getTime();
  if (!Number.isFinite(target)) return null;
  const diffSec = Math.round((target - now) / 1000);
  if (diffSec >= 0) {
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return {
      label: mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secs}s`,
      overdue: false,
    };
  }
  const late = Math.abs(diffSec);
  const mins = Math.floor(late / 60);
  return {
    label: mins > 0 ? `+${mins} min` : `+${late}s`,
    overdue: true,
  };
}

/** Card de cocina: platillos grandes + countdown + CTA Listo. */
export default function RestaurantOrderCard({
  order,
  onPress,
  onAdvance,
  advanceLabel,
  busy,
}: Props) {
  const accent = statusColors[order.status] ?? colors.primary;
  const timeAgo = formatTimeAgo(order.created_at);
  const items = order.items ?? [];
  const isReady = order.status === 'ready';
  const isKitchen = order.status === 'accepted' || order.status === 'preparing';
  const prep = usePrepCountdown(isKitchen ? order.estimated_ready_at : null);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: accent },
        isKitchen && styles.cardKitchen,
        isReady && styles.cardReady,
        prep?.overdue && styles.cardOverdue,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.orderRef}>{formatOrderLabel(order)}</Text>
          <Text style={styles.customer}>
            {customerName(order)}
            {timeAgo ? ` · ${timeAgo}` : ''}
          </Text>
        </View>
        {prep ? (
          <View style={[styles.prepPill, prep.overdue && styles.prepPillOverdue]}>
            <Ionicons
              name={prep.overdue ? 'warning-outline' : 'timer-outline'}
              size={14}
              color={prep.overdue ? '#FFF' : colors.primaryDark}
            />
            <Text style={[styles.prepPillText, prep.overdue && styles.prepPillTextOverdue]}>
              {prep.overdue ? `Retraso ${prep.label}` : prep.label}
            </Text>
          </View>
        ) : (
          <OrderStatusBadge status={order.status} label={order.status_display} />
        )}
      </View>

      {order.prep_minutes && isKitchen ? (
        <Text style={styles.prepHint}>Prep. estimada: {order.prep_minutes} min</Text>
      ) : null}

      <View style={styles.itemsBlock}>
        {items.slice(0, 5).map((item) => {
          const name = item.product_detail?.name ?? 'Producto';
          const opts = (item.selected_options ?? []).map((o) => o.name).join(', ');
          return (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.qty}>{item.quantity}×</Text>
              <View style={styles.itemText}>
                <Text style={styles.itemName}>{name}</Text>
                {opts ? <Text style={styles.itemOpts}>{opts}</Text> : null}
                {item.notes?.trim() ? (
                  <Text style={styles.itemNotes}>{item.notes.trim()}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
        {items.length > 5 ? (
          <Text style={styles.moreItems}>+{items.length - 5} más</Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Text style={styles.total}>{formatCurrency(order.total)}</Text>
        <View style={styles.footerMeta}>
          {order.driver_detail ? (
            <View style={styles.metaChip}>
              <Ionicons name="bicycle-outline" size={13} color={colors.success} />
              <Text style={[styles.metaText, { color: colors.success }]}>Repartidor</Text>
            </View>
          ) : isReady ? (
            <View style={styles.metaChip}>
              <Ionicons name="hourglass-outline" size={13} color={colors.warning} />
              <Text style={[styles.metaText, { color: colors.warning }]}>Esperando</Text>
            </View>
          ) : (
            <Text style={styles.payment}>{order.payment_method_display}</Text>
          )}
        </View>
      </View>

      {order.delivery_notes?.trim() ? (
        <View style={styles.notesBox}>
          <Ionicons name="chatbox-ellipses-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.notesText} numberOfLines={2}>
            {order.delivery_notes.trim()}
          </Text>
        </View>
      ) : null}

      {advanceLabel && onAdvance ? (
        <Button
          title={advanceLabel}
          onPress={onAdvance}
          loading={busy}
          style={styles.advanceBtn}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderLeftWidth: 4,
    overflow: 'hidden',
    paddingBottom: spacing.md,
    ...cardShadow,
  },
  cardKitchen: {
    borderColor: colors.primary + '44',
    backgroundColor: '#FFFBF7',
  },
  cardReady: {
    borderColor: colors.success + '44',
    backgroundColor: '#F0FDF4',
  },
  cardOverdue: {
    borderColor: colors.error + '66',
    backgroundColor: '#FEF2F2',
  },
  cardPressed: { opacity: 0.96 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  orderRef: { fontSize: 17, fontWeight: '900', color: colors.text },
  customer: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
  prepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  prepPillOverdue: { backgroundColor: colors.error },
  prepPillText: { fontSize: 12, fontWeight: '900', color: colors.primaryDark },
  prepPillTextOverdue: { color: '#FFF' },
  prepHint: {
    marginTop: 6,
    paddingHorizontal: spacing.lg,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  itemsBlock: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: 8,
  },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  qty: { fontSize: 16, fontWeight: '900', color: colors.primaryDark, minWidth: 28 },
  itemText: { flex: 1, gap: 1 },
  itemName: { fontSize: 16, fontWeight: '800', color: colors.text },
  itemOpts: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  itemNotes: { fontSize: 12, color: colors.primaryDark, fontWeight: '700' },
  moreItems: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  total: { fontSize: 18, fontWeight: '900', color: colors.text },
  footerMeta: { flexDirection: 'row', alignItems: 'center' },
  payment: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontWeight: '700' },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
  },
  notesText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  advanceBtn: { marginHorizontal: spacing.lg, marginTop: spacing.md },
});
