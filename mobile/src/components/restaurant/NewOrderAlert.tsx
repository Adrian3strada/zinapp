import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../Button';
import { colors } from '../../theme/colors';
import type { Order } from '../../types';
import { formatCurrency, formatTimeAgo } from '../../utils/format';
import { formatOrderLabel } from '../../utils/orderDisplay';

const COUNTDOWN_SECS = 60;
export const PREP_OPTIONS = [10, 15, 20, 30, 45] as const;

interface Props {
  order: Order;
  busy?: boolean;
  queueCount?: number;
  onAccept: (prepMinutes: number) => void;
  onReject: () => void;
  onDetails?: () => void;
}

function customerName(order: Order): string {
  const c = order.customer_detail;
  if (!c) return 'Cliente';
  const full = [c.first_name, c.last_name].filter(Boolean).join(' ');
  return full || c.username;
}

/** Alerta a pantalla completa de pedido nuevo (estilo DiDi tienda). */
export default function NewOrderAlert({
  order,
  busy = false,
  queueCount = 1,
  onAccept,
  onReject,
  onDetails,
}: Props) {
  const insets = useSafeAreaInsets();
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECS);
  const [prepMinutes, setPrepMinutes] = useState<number>(15);

  useEffect(() => {
    setSecondsLeft(COUNTDOWN_SECS);
    setPrepMinutes(15);
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    const tick = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? COUNTDOWN_SECS : s - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [order.id]);

  const items = useMemo(() => order.items ?? [], [order.items]);
  const urgent = secondsLeft <= 15;
  const timeAgo = formatTimeAgo(order.created_at);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.topBar}>
          <View style={[styles.timerPill, urgent && styles.timerUrgent]}>
            <Ionicons name="alarm-outline" size={16} color={urgent ? '#FFF' : colors.primaryDark} />
            <Text style={[styles.timerText, urgent && styles.timerTextUrgent]}>
              {secondsLeft}s
            </Text>
          </View>
          {queueCount > 1 ? (
            <View style={styles.queuePill}>
              <Text style={styles.queueText}>+{queueCount - 1} en cola</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.eyebrow}>Nuevo pedido</Text>
        <Text style={styles.title}>{formatOrderLabel(order)}</Text>
        <Text style={styles.customer}>
          {customerName(order)}
          {timeAgo ? ` · ${timeAgo}` : ''}
        </Text>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(order.total)}</Text>
          <Text style={styles.payment}>{order.payment_method_display}</Text>
        </View>

        <View style={styles.prepBlock}>
          <Text style={styles.prepTitle}>Tiempo de preparación</Text>
          <Text style={styles.prepSub}>El cliente verá cuándo estará listo</Text>
          <View style={styles.prepRow}>
            {PREP_OPTIONS.map((mins) => {
              const active = prepMinutes === mins;
              return (
                <Pressable
                  key={mins}
                  style={[styles.prepChip, active && styles.prepChipActive]}
                  onPress={() => setPrepMinutes(mins)}
                  disabled={busy}
                >
                  <Text style={[styles.prepChipText, active && styles.prepChipTextActive]}>
                    {mins} min
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView
          style={styles.itemsScroll}
          contentContainerStyle={styles.itemsContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.itemsTitle}>Platillos</Text>
          {items.map((item) => {
            const name = item.product_detail?.name ?? 'Producto';
            const opts = (item.selected_options ?? []).map((o) => o.name).join(', ');
            return (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{name}</Text>
                  {opts ? <Text style={styles.itemOpts}>{opts}</Text> : null}
                  {item.notes?.trim() ? (
                    <Text style={styles.itemNotes}>Nota: {item.notes.trim()}</Text>
                  ) : null}
                </View>
                <Text style={styles.itemPrice}>{formatCurrency(item.subtotal)}</Text>
              </View>
            );
          })}
          {order.delivery_notes?.trim() ? (
            <View style={styles.notesBox}>
              <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.primaryDark} />
              <Text style={styles.notesText}>{order.delivery_notes.trim()}</Text>
            </View>
          ) : null}
          {onDetails ? (
            <Pressable onPress={onDetails} style={styles.detailsLink}>
              <Text style={styles.detailsLinkText}>Ver detalle completo</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </ScrollView>

        <View style={styles.actions}>
          <Button
            title={`Aceptar · ${prepMinutes} min`}
            onPress={() => onAccept(prepMinutes)}
            loading={busy}
            style={styles.acceptBtn}
          />
          <Button
            title="Rechazar"
            variant="danger"
            onPress={onReject}
            loading={busy}
            style={styles.rejectBtn}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  timerUrgent: { backgroundColor: colors.error },
  timerText: { fontSize: 15, fontWeight: '900', color: colors.primaryDark },
  timerTextUrgent: { color: '#FFF' },
  queuePill: {
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  queueText: { fontSize: 12, fontWeight: '800', color: colors.textSecondary },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: { fontSize: 28, fontWeight: '900', color: colors.text, letterSpacing: -0.5, marginTop: 4 },
  customer: { fontSize: 15, fontWeight: '600', color: colors.textSecondary, marginTop: 4 },
  totalCard: {
    marginTop: 16,
    backgroundColor: colors.primaryLight,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.primary + '33',
  },
  totalLabel: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  totalValue: { flex: 1, fontSize: 26, fontWeight: '900', color: colors.primaryDark },
  payment: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  prepBlock: { marginTop: 14, gap: 6 },
  prepTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  prepSub: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  prepRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  prepChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  prepChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  prepChipText: { fontSize: 14, fontWeight: '800', color: colors.textSecondary },
  prepChipTextActive: { color: '#FFF' },
  itemsScroll: { flex: 1, marginTop: 14 },
  itemsContent: { paddingBottom: 12, gap: 10 },
  itemsTitle: { fontSize: 13, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 12,
  },
  qtyBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: { fontSize: 14, fontWeight: '900', color: '#FFF' },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 16, fontWeight: '800', color: colors.text },
  itemOpts: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  itemNotes: { fontSize: 12, color: colors.primaryDark, fontWeight: '600' },
  itemPrice: { fontSize: 14, fontWeight: '800', color: colors.text },
  notesBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
  },
  notesText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18, fontWeight: '600' },
  detailsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  detailsLinkText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  actions: { gap: 10, paddingTop: 8 },
  acceptBtn: { minHeight: 54 },
  rejectBtn: { minHeight: 48 },
});
