import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appAlert } from '../utils/appAlert';

import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { HIT_SLOP, spacing } from '../theme/spacing';
import { cardShadow } from '../theme/shadows';
import type { LocalService } from '../types';
import { openSocialLink } from '../utils/socialLinks';
import { openWhatsApp } from '../utils/whatsapp';
import ServiceLogo from './ServiceLogo';

interface Props {
  service: LocalService;
}

const NEW_DAYS = 21;

function contactDigits(phone?: string | null): string {
  return (phone ?? '').replace(/\D/g, '');
}

function isNewService(createdAt?: string): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created < NEW_DAYS * 24 * 60 * 60 * 1000;
}

function MetaRow({
  icon,
  text,
  compact,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  compact?: boolean;
}) {
  return (
    <View style={styles.metaRow}>
      <Ionicons
        name={icon}
        size={compact ? 14 : 16}
        color={colors.textMuted}
        style={styles.metaIcon}
      />
      <Text style={[styles.metaText, compact && styles.metaTextCompact]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

export default function ServiceBusinessCard({ service }: Props) {
  const insets = useSafeAreaInsets();
  const [detailOpen, setDetailOpen] = useState(false);

  const phone = service.phone?.trim();
  const whatsapp = (service.whatsapp?.trim() || phone) ?? '';
  const address = service.address?.trim();
  const schedule = service.schedule?.trim();
  const instagram = service.instagram?.trim();
  const facebook = service.facebook?.trim();
  const description = service.description?.trim() || 'Servicio local en Zinapécuaro';
  const longDescription = description.length > 90 || description.split(/\s+/).length > 18;

  const showNew = isNewService(service.created_at);
  const showFeatured = service.sort_order === 0;

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

  const handleSocial = async (platform: 'instagram' | 'facebook', value?: string) => {
    try {
      await openSocialLink(platform, value);
    } catch (err) {
      appAlert(
        platform === 'instagram' ? 'Instagram' : 'Facebook',
        err instanceof Error ? err.message : 'No se pudo abrir.',
      );
    }
  };

  const primaryActions = (
    [
      phone
        ? {
            key: 'call',
            label: 'Llamar',
            icon: 'call' as const,
            color: colors.primary,
            style: styles.actionBtn,
            onPress: handleCall,
          }
        : null,
      whatsapp
        ? {
            key: 'whatsapp',
            label: 'WhatsApp',
            icon: 'logo-whatsapp' as const,
            color: '#25D366',
            style: [styles.actionBtn, styles.whatsappBtn],
            onPress: handleWhatsApp,
          }
        : null,
    ] as const
  ).filter(Boolean) as Array<{
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    style: object | object[];
    onPress: () => void;
  }>;

  const socialActions = (
    [
      instagram
        ? {
            key: 'instagram',
            icon: 'logo-instagram' as const,
            color: '#E1306C',
            label: 'Instagram',
            onPress: () => handleSocial('instagram', instagram),
          }
        : null,
      facebook
        ? {
            key: 'facebook',
            icon: 'logo-facebook' as const,
            color: '#1877F2',
            label: 'Facebook',
            onPress: () => handleSocial('facebook', facebook),
          }
        : null,
    ] as const
  ).filter(Boolean) as Array<{
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    label: string;
    onPress: () => void;
  }>;

  const badges = (
    <View style={styles.badgeRow}>
      {showFeatured ? (
        <View style={[styles.badge, styles.badgeFeatured]}>
          <Text style={[styles.badgeText, styles.badgeFeaturedText]}>Destacado</Text>
        </View>
      ) : null}
      {showNew ? (
        <View style={[styles.badge, styles.badgeNew]}>
          <Text style={[styles.badgeText, styles.badgeNewText]}>Nuevo</Text>
        </View>
      ) : null}
    </View>
  );

  const actionRow = (
    <View style={styles.actions}>
      {primaryActions.length > 0 ? (
        primaryActions.map((action) => (
          <Pressable
            key={action.key}
            style={({ pressed }) => [
              action.style,
              styles.actionFlex,
              pressed && styles.actionPressed,
            ]}
            onPress={action.onPress}
          >
            <Ionicons name={action.icon} size={16} color={action.color} />
            <Text style={styles.actionText} numberOfLines={1}>
              {action.label}
            </Text>
          </Pressable>
        ))
      ) : (
        <Text style={styles.noContact}>Sin datos de contacto por ahora</Text>
      )}
      {socialActions.map((action) => (
        <Pressable
          key={action.key}
          style={({ pressed }) => [styles.socialIconBtn, pressed && styles.actionPressed]}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <Ionicons name={action.icon} size={18} color={action.color} />
        </Pressable>
      ))}
    </View>
  );

  return (
    <>
      <View style={styles.card}>
        <Pressable
          onPress={() => setDetailOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${service.name}. Ver detalle`}
          style={({ pressed }) => [styles.cardBody, pressed && styles.cardPressed]}
        >
          <View style={styles.header}>
            <ServiceLogo
              category={service.category}
              logoUrl={service.logo_url}
              logo={service.logo}
              size="xs"
              style={styles.logo}
            />
            <View style={styles.titleBlock}>
              <Text style={styles.name} numberOfLines={2}>
                {service.name}
              </Text>
              <View style={styles.metaChips}>
                {!!service.category_display && (
                  <View style={styles.categoryChip}>
                    <Text style={styles.categoryText} numberOfLines={1}>
                      {service.category_display}
                    </Text>
                  </View>
                )}
                {badges}
              </View>
            </View>
          </View>

          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
          {longDescription ? (
            <Text style={styles.moreHint}>Ver más</Text>
          ) : null}

          {(schedule || address) && (
            <View style={styles.metaBlock}>
              {schedule ? <MetaRow icon="time-outline" text={schedule} compact /> : null}
              {address ? <MetaRow icon="location-outline" text={address} compact /> : null}
            </View>
          )}
        </Pressable>

        {actionRow}
      </View>

      <Modal
        visible={detailOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setDetailOpen(false)} />
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <ServiceLogo
                category={service.category}
                logoUrl={service.logo_url}
                logo={service.logo}
                size="sm"
              />
              <View style={styles.modalTitleBlock}>
                <Text style={styles.modalName} numberOfLines={2}>
                  {service.name}
                </Text>
                {!!service.category_display && (
                  <Text style={styles.modalCategory}>{service.category_display}</Text>
                )}
                {badges}
              </View>
              <Pressable
                onPress={() => setDetailOpen(false)}
                hitSlop={HIT_SLOP}
                style={styles.modalClose}
                accessibilityLabel="Cerrar"
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalDescription}>{description}</Text>
              {(schedule || address || phone) && (
                <View style={styles.metaBlock}>
                  {schedule ? <MetaRow icon="time-outline" text={schedule} /> : null}
                  {address ? <MetaRow icon="location-outline" text={address} /> : null}
                  {phone ? <MetaRow icon="call-outline" text={phone} /> : null}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>{actionRow}</View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...cardShadow,
  },
  cardBody: {
    gap: spacing.sm,
  },
  cardPressed: { opacity: 0.96 },
  header: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    flexShrink: 0,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  metaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flexShrink: 0,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  badgeFeatured: {
    backgroundColor: colors.serviceStart + '18',
  },
  badgeNew: {
    backgroundColor: colors.success + '18',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  badgeFeaturedText: { color: colors.serviceEnd },
  badgeNewText: { color: colors.success },
  categoryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  moreHint: {
    marginTop: -4,
    fontSize: 12,
    fontWeight: '700',
    color: colors.serviceEnd,
  },
  metaBlock: {
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaIcon: {
    flexShrink: 0,
  },
  metaText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    fontWeight: '500',
  },
  metaTextCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionFlex: {
    flexGrow: 1,
    flexBasis: 110,
    minWidth: 0,
    maxWidth: '100%',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionPressed: { opacity: 0.88 },
  whatsappBtn: {
    backgroundColor: '#25D36618',
    borderColor: '#25D36644',
  },
  actionText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  socialIconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexShrink: 0,
  },
  noContact: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheetLg,
    borderTopRightRadius: radii.sheetLg,
    maxHeight: Platform.OS === 'web' ? '88%' : '90%',
    paddingTop: 8,
    paddingHorizontal: spacing.lg,
    ...cardShadow,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  modalTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  modalName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  modalCategory: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  modalClose: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  modalScrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.md,
  },
});
