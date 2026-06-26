import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../utils/appAlert';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { cardShadow } from '../theme/shadows';
import type { LocalService } from '../types';
import { resolveMediaUrl } from '../utils/media';
import { openWhatsApp } from '../utils/whatsapp';
import FoodImage from './FoodImage';

interface Props {
  service: LocalService;
}

function contactDigits(phone?: string | null): string {
  return (phone ?? '').replace(/\D/g, '');
}

export default function ServiceBusinessCard({ service }: Props) {
  const logoUri = resolveMediaUrl(service.logo_url ?? service.logo);
  const phone = service.phone?.trim();
  const whatsapp = (service.whatsapp?.trim() || phone) ?? '';

  const handleCall = async () => {
    if (!phone) {
      appAlert('Sin teléfono', 'Este negocio no tiene número para llamar.');
      return;
    }
    const url = `tel:${contactDigits(phone)}`;
    try {
      await Linking.openURL(url);
    } catch {
      appAlert('Llamada', 'No se pudo abrir la app de teléfono.');
    }
  };

  const handleWhatsApp = async () => {
    if (!whatsapp) {
      appAlert('Sin WhatsApp', 'Este negocio no tiene contacto por WhatsApp.');
      return;
    }
    try {
      await openWhatsApp(
        whatsapp,
        `Hola, vi tu negocio «${service.name}» en ZinApp Zinapécuaro y me gustaría más información.`,
      );
    } catch (err) {
      appAlert('WhatsApp', err instanceof Error ? err.message : 'No se pudo abrir WhatsApp.');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <FoodImage
          emoji="💼"
          color={colors.secondary}
          size="md"
          imageUri={logoUri}
          style={styles.logo}
        />
        <View style={styles.info}>
          <Text style={styles.name}>{service.name}</Text>
          <Text style={styles.description} numberOfLines={4}>
            {service.description?.trim() || 'Servicio local en Zinapécuaro'}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        {phone ? (
          <Pressable style={styles.actionBtn} onPress={handleCall}>
            <Ionicons name="call" size={18} color={colors.primary} />
            <Text style={styles.actionText}>Llamar</Text>
          </Pressable>
        ) : null}
        {whatsapp ? (
          <Pressable style={[styles.actionBtn, styles.whatsappBtn]} onPress={handleWhatsApp}>
            <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
            <Text style={styles.actionText}>WhatsApp</Text>
          </Pressable>
        ) : null}
        {!phone && !whatsapp ? (
          <Text style={styles.noContact}>Sin datos de contacto por ahora</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.md,
    ...cardShadow,
  },
  header: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 18,
  },
  info: { flex: 1, gap: 6 },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  whatsappBtn: {
    backgroundColor: '#25D36618',
    borderColor: '#25D36644',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  noContact: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
