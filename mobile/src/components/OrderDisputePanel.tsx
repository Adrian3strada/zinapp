import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Button from './Button';
import FormField from './FormField';
import { disputeApi } from '../services/api';
import { colors } from '../theme/colors';
import { appAlert } from '../utils/appAlert';
import { getApiErrorMessage } from '../utils/apiErrors';
import type { Order, OrderDispute } from '../types';

interface Props {
  order: Order;
  onCreated?: (dispute: OrderDispute) => void;
}

const STATUS_COLORS: Record<OrderDispute['status'], string> = {
  pending: colors.warning,
  approved: colors.success,
  rejected: colors.error,
  refunded: colors.primary,
};

export default function OrderDisputePanel({ order, onCreated }: Props) {
  const existing = order.dispute;
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState(String(order.total));
  const [loading, setLoading] = useState(false);

  if (existing) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Disputa / reembolso</Text>
        <View style={[styles.statusBadge, { borderColor: STATUS_COLORS[existing.status] }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[existing.status] }]}>
            {existing.status_display}
          </Text>
        </View>
        <Text style={styles.meta}>Monto solicitado: ${existing.requested_amount}</Text>
        <Text style={styles.meta}>Motivo: {existing.reason}</Text>
        {existing.admin_notes ? (
          <Text style={styles.notes}>Notas del equipo: {existing.admin_notes}</Text>
        ) : null}
        {existing.status === 'pending' ? (
          <Text style={styles.hint}>Estamos revisando tu solicitud. Te contactaremos pronto.</Text>
        ) : null}
      </View>
    );
  }

  const submit = async () => {
    if (!reason.trim()) {
      appAlert('Disputa', 'Describe el problema.');
      return;
    }
    const parsed = parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      appAlert('Disputa', 'Indica un monto válido.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await disputeApi.create({
        order: order.id,
        reason: reason.trim(),
        requested_amount: parsed.toFixed(2),
      });
      appAlert('Solicitud enviada', 'Revisaremos tu disputa y te contactaremos.');
      onCreated?.(data);
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo enviar la disputa.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Solicitar reembolso / disputa</Text>
      <Text style={styles.hint}>
        Solo para pedidos entregados o cancelados. Indica el monto que solicitas (máx. ${order.total}).
      </Text>
      <FormField
        label="Motivo"
        value={reason}
        onChangeText={setReason}
        multiline
        embedded
        placeholder="Ej. pedido incompleto, producto incorrecto..."
      />
      <FormField
        label="Monto solicitado ($)"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        embedded
      />
      <Button title="Enviar solicitud" onPress={submit} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
  },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  statusBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 12, fontWeight: '800' },
  meta: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  notes: { fontSize: 13, color: colors.text, lineHeight: 18, fontStyle: 'italic' },
});
