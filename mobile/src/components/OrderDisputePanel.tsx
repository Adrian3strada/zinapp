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

export default function OrderDisputePanel({ order, onCreated }: Props) {
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState(String(order.total));
  const [loading, setLoading] = useState(false);

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
});
