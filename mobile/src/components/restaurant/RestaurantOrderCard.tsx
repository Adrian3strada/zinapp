import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Button from '../Button';
import OrderStatusBadge from '../OrderStatusBadge';
import { colors, statusColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { Order } from '../../types';
import { formatOrderLabel } from '../../utils/orderDisplay';
import { formatCurrency, formatTimeAgo } from '../../utils/format';

const PAYMENT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  cash: 'cash-outline',
  transfer: 'card-outline',
  online: 'globe-outline',
};

interface Props {
  order: Order;
  onPress: () => void;
  onAccept?: () => void;
  onReject?: () => void;
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

function itemsSummary(order: Order): string {
  if (!order.items?.length) return 'Sin platillos';
  const preview = order.items
    .slice(0, 3)
    .map((item) => {
      const name = item.product_detail?.name ?? 'Producto';
      const opts = (item.selected_options ?? []).map((o) => o.name).join(', ');
      const notes = item.notes?.trim();
      const detail = [opts, notes].filter(Boolean).join(' · ');
      return detail
        ? `${item.quantity}× ${name} (${detail})`
        : `${item.quantity}× ${name}`;
    })
    .join(' · ');
  const extra = order.items.length > 3 ? ` +${order.items.length - 3} más` : '';
  return preview + extra;
}

export default function RestaurantOrderCard({
  order,
  onPress,
  onAccept,
  onReject,
  onAdvance,
  advanceLabel,
  busy,
}: Props) {
  const accent = statusColors[order.status] ?? colors.primary;
  const isPending = order.status === 'pending';
  const isUrgent = isPending;
  const timeAgo = formatTimeAgo(order.created_at);
  const paymentIcon = PAYMENT_ICONS[order.payment_method] ?? 'wallet-outline';
  const itemCount = order.items?.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: accent },
        isUrgent && styles.cardUrgent,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      {isUrgent ? (
        <View style={styles.urgentStrip}>
          <Ionicons name="notifications" size={14} color="#FFF" />
          <Text style={styles.urgentText}>Nuevo pedido — responde pronto</Text>
        </View>
      ) : null}

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.orderRef}>{formatOrderLabel(order)}</Text>
          {timeAgo ? <Text style={styles.timeAgo}>{timeAgo}</Text> : null}
        </View>
        <OrderStatusBadge status={order.status} label={order.status_display} />
      </View>

      <View style={styles.customerRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{customerName(order).charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{customerName(order)}</Text>
          <Text style={styles.itemsLine} numberOfLines={2}>
            {itemsSummary(order)}
          </Text>
        </View>
        <View style={styles.totalBlock}>
          <Text style={styles.total}>{formatCurrency(order.total)}</Text>
          <Text style={styles.itemCount}>
            {itemCount} platillo{itemCount === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaChip}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.metaChipText} numberOfLines={1}>
            {order.delivery_address}
          </Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.paymentChip}>
          <Ionicons name={paymentIcon} size={14} color={colors.primary} />
          <Text style={styles.paymentText}>{order.payment_method_display}</Text>
        </View>
        {order.payment_method === 'online' && order.payment_status !== 'paid' && (
          <View style={styles.paymentWarn}>
            <Text style={styles.paymentWarnText}>Pago pendiente</Text>
          </View>
        )}
        {order.driver_detail ? (
          <View style={styles.driverChip}>
            <Ionicons name="bicycle-outline" size={14} color={colors.success} />
            <Text style={styles.driverText}>Repartidor asignado</Text>
          </View>
        ) : order.status === 'ready' ? (
          <View style={styles.driverChip}>
            <Ionicons name="hourglass-outline" size={14} color={colors.warning} />
            <Text style={[styles.driverText, { color: colors.warning }]}>Esperando repartidor</Text>
          </View>
        ) : null}
      </View>

      {order.delivery_notes ? (
        <View style={styles.notesBox}>
          <Ionicons name="chatbox-ellipses-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.notesText} numberOfLines={2}>
            {order.delivery_notes}
          </Text>
        </View>
      ) : null}

      {isPending && onAccept && onReject ? (
        <View style={styles.actions}>
          <Button title="Aceptar" onPress={onAccept} loading={busy} style={styles.actionBtn} />
          <Button
            title="Rechazar"
            variant="danger"
            onPress={onReject}
            loading={busy}
            style={styles.actionBtn}
          />
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

      <View style={styles.detailHint}>
        <Text style={styles.detailHintText}>Ver detalle completo</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderLeftWidth: 4,
    overflow: 'hidden',
    ...cardShadow,
  },
  cardUrgent: {
    borderColor: colors.warning + '55',
  },
  cardPressed: { opacity: 0.96 },
  urgentStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.warning,
    paddingVertical: 8,
  },
  urgentText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  headerLeft: { flex: 1 },
  orderRef: { fontSize: 17, fontWeight: '800', color: colors.text },
  timeAgo: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '800', color: colors.primary },
  customerInfo: { flex: 1, minWidth: 0 },
  customerName: { fontSize: 15, fontWeight: '700', color: colors.text },
  itemsLine: { fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  totalBlock: { alignItems: 'flex-end' },
  total: { fontSize: 20, fontWeight: '800', color: colors.primary },
  itemCount: { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  metaRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metaChipText: { flex: 1, fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  paymentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  paymentText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  paymentWarn: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  paymentWarnText: { fontSize: 10, fontWeight: '700', color: '#E65100' },
  driverChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  driverText: { fontSize: 11, fontWeight: '700', color: colors.success },
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
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  actionBtn: { flex: 1, minWidth: 0 },
  advanceBtn: { marginHorizontal: spacing.lg, marginTop: spacing.md },
  detailHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  detailHintText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
});
