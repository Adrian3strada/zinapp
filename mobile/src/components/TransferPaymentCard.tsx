import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../utils/appAlert';

import type { TransferInfo } from '../config/payments';
import { TRANSFER_INFO } from '../config/payments';
import Button from './Button';
import { colors } from '../theme/colors';
import { HIT_SLOP } from '../theme/spacing';
import { cardShadow } from '../theme/shadows';
import { formatCurrency } from '../utils/format';
import { openWhatsApp, transferReceiptMessage, type TransferKind } from '../utils/whatsapp';
import { appendImage, pickImageFromLibrary, ASPECT_DOCUMENT } from '../utils/imagePicker';
import { orderApi } from '../services/api';
import { getApiErrorMessage } from '../utils/apiErrors';
import { resolveMediaUrl } from '../utils/media';

interface Props {
  orderId: number;
  displayRef?: string;
  total: string;
  compact?: boolean;
  kind?: TransferKind;
  transferInfo?: TransferInfo;
  paymentStatus?: string;
  paymentProofUrl?: string | null;
  canUpload?: boolean;
  canConfirm?: boolean;
  onUpdated?: () => void;
}

export default function TransferPaymentCard({
  orderId,
  displayRef,
  total,
  compact,
  kind = 'order',
  transferInfo = TRANSFER_INFO,
  paymentStatus,
  paymentProofUrl,
  canUpload,
  canConfirm,
  onUpdated,
}: Props) {
  const refLabel = displayRef ?? (orderId > 0 ? `#${orderId}` : '');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const totalFormatted = formatCurrency(total);
  const itemLabel = kind === 'shipment' ? 'envío' : 'pedido';
  const paid = paymentStatus === 'paid';
  const proofUri = resolveMediaUrl(paymentProofUrl);

  const handleCopyClabe = async () => {
    try {
      await Share.share({ message: transferInfo.clabe, title: 'CLABE' });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      appAlert('CLABE', transferInfo.clabe);
    }
  };

  const handleWhatsApp = async () => {
    if (!transferInfo.whatsapp?.trim()) {
      appAlert('WhatsApp', 'El local no indicó un WhatsApp para comprobantes.');
      return;
    }
    try {
      await openWhatsApp(
        transferInfo.whatsapp,
        transferReceiptMessage(refLabel, totalFormatted, kind),
      );
    } catch {
      appAlert('WhatsApp', 'No se pudo abrir WhatsApp. Instálalo o envía el comprobante manualmente.');
    }
  };

  const handleUpload = async () => {
    if (!canUpload || orderId <= 0) return;
    const uri = await pickImageFromLibrary({
      aspect: ASPECT_DOCUMENT,
      cropTitle: 'Recorta el comprobante',
    });
    if (!uri) return;
    setBusy(true);
    try {
      const fd = new FormData();
      await appendImage(fd, 'payment_proof', uri, 'comprobante.jpg');
      await orderApi.uploadPaymentProof(orderId, fd);
      onUpdated?.();
    } catch (err) {
      appAlert('Comprobante', getApiErrorMessage(err, 'No se pudo subir la foto.'));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!canConfirm || orderId <= 0) return;
    setBusy(true);
    try {
      await orderApi.confirmTransfer(orderId);
      onUpdated?.();
    } catch (err) {
      appAlert('Transferencia', getApiErrorMessage(err, 'No se pudo confirmar.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.box, compact && styles.compact]}>
      <View style={styles.header}>
        <Ionicons name="card-outline" size={22} color={colors.primary} />
        <Text style={styles.title}>Pago por transferencia</Text>
      </View>
      <Text style={styles.amount}>Monto: {totalFormatted}</Text>
      {refLabel ? (
        <Text style={styles.ref}>{itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)} {refLabel}</Text>
      ) : null}
      {paymentStatus ? (
        <Text style={[styles.status, paid ? styles.statusPaid : styles.statusWait]}>
          {paid
            ? 'Transferencia confirmada'
            : proofUri
              ? 'Comprobante enviado — esperando confirmación'
              : 'Transfiere ahora. El local no cocina hasta confirmar el pago.'}
        </Text>
      ) : null}
      <Text style={styles.line}>Banco: {transferInfo.bank}</Text>
      <Text style={styles.line}>Titular: {transferInfo.holder}</Text>
      <Pressable style={styles.clabeRow} onPress={handleCopyClabe} hitSlop={HIT_SLOP}>
        <Text style={styles.clabe}>CLABE: {transferInfo.clabe}</Text>
        <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={20} color={colors.primary} />
      </Pressable>
      <Text style={styles.note}>{transferInfo.note}</Text>
      {canUpload && !paid ? (
        <Text style={styles.timeoutNote}>
          Si no confirmamos el pago en 30 minutos, se cancela el pedido. Si ya depositaste, sube el comprobante o mándalo por WhatsApp.
        </Text>
      ) : null}
      {canUpload === false && !canConfirm && !paid ? (
        <Text style={styles.timeoutNote}>
          Si ya transferiste, mándanos el comprobante por WhatsApp.
        </Text>
      ) : null}
      {proofUri ? (
        <Image source={{ uri: proofUri }} style={styles.proof} />
      ) : null}
      {canUpload && !paid ? (
        <Button
          title={proofUri ? 'Cambiar comprobante' : 'Subir foto del comprobante'}
          onPress={handleUpload}
          loading={busy}
          style={styles.waBtn}
        />
      ) : null}
      {canConfirm && !paid ? (
        <Button
          title="Ya llegó el dinero"
          onPress={handleConfirm}
          loading={busy}
          style={styles.waBtn}
        />
      ) : null}
      {transferInfo.whatsapp && !paid ? (
        <Button
          title="Enviar por WhatsApp"
          variant="secondary"
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
  status: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  statusWait: { color: colors.accentDark },
  statusPaid: { color: colors.success },
  line: { fontSize: 14, color: colors.text },
  clabeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  clabe: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1, minWidth: 0, letterSpacing: 0.5 },
  note: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },
  timeoutNote: { fontSize: 12, color: colors.accentDark, lineHeight: 18, marginTop: 6, fontWeight: '600' },
  waBtn: { marginTop: 10 },
  proof: { width: '100%', height: 160, borderRadius: 12, marginTop: 8, backgroundColor: colors.background },
});
