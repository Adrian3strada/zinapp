import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import type { TransferInfo } from '../config/payments';
import { TRANSFER_INFO } from '../config/payments';
import Button from './Button';
import { colors } from '../theme/colors';
import { HIT_SLOP } from '../theme/spacing';
import { cardShadow } from '../theme/shadows';
import { formatCurrency } from '../utils/format';
import { openWhatsApp, transferReceiptMessage, type TransferKind } from '../utils/whatsapp';

interface Props {
  orderId: number;
  total: string;
  compact?: boolean;
  kind?: TransferKind;
  transferInfo?: TransferInfo;
}

export default function TransferPaymentCard({
  orderId,
  total,
  compact,
  kind = 'order',
  transferInfo = TRANSFER_INFO,
}: Props) {
  const [copied, setCopied] = useState(false);
  const totalFormatted = formatCurrency(total);
  const itemLabel = kind === 'shipment' ? 'envío' : 'pedido';

  const handleCopyClabe = async () => {
    try {
      await Share.share({ message: transferInfo.clabe, title: 'CLABE' });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert('CLABE', transferInfo.clabe);
    }
  };

  const handleWhatsApp = async () => {
    if (!transferInfo.whatsapp?.trim()) {
      Alert.alert('WhatsApp', 'El local no indicó un WhatsApp para comprobantes.');
      return;
    }
    try {
      await openWhatsApp(
        transferInfo.whatsapp,
        transferReceiptMessage(orderId, totalFormatted, kind),
      );
    } catch {
      Alert.alert('WhatsApp', 'No se pudo abrir WhatsApp. Instálalo o envía el comprobante manualmente.');
    }
  };

  return (
    <View style={[styles.box, compact && styles.compact]}>
      <View style={styles.header}>
        <Ionicons name="card-outline" size={22} color={colors.primary} />
        <Text style={styles.title}>Pago por transferencia</Text>
      </View>
      <Text style={styles.amount}>Monto: {totalFormatted}</Text>
      {orderId > 0 && (
        <Text style={styles.ref}>{itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)} #{orderId}</Text>
      )}
      <Text style={styles.line}>Banco: {transferInfo.bank}</Text>
      <Text style={styles.line}>Titular: {transferInfo.holder}</Text>
      <Pressable style={styles.clabeRow} onPress={handleCopyClabe} hitSlop={HIT_SLOP}>
        <Text style={styles.clabe}>CLABE: {transferInfo.clabe}</Text>
        <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={20} color={colors.primary} />
      </Pressable>
      <Text style={styles.note}>{transferInfo.note}</Text>
      {transferInfo.whatsapp ? (
        <Button
          title="Enviar comprobante por WhatsApp"
          onPress={handleWhatsApp}
          style={styles.waBtn}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: 16,
    gap: 6,
    ...cardShadow,
  },
  compact: { marginTop: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '800', color: colors.primary },
  amount: { fontSize: 18, fontWeight: '800', color: colors.text },
  ref: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  line: { fontSize: 14, color: colors.text },
  clabeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  clabe: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1, letterSpacing: 0.5 },
  note: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },
  waBtn: { marginTop: 10 },
});
