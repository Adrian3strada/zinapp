import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../utils/appAlert';

import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { cardShadow } from '../theme/shadows';
import type { LocalService } from '../types';
import { openSocialLink } from '../utils/socialLinks';
import { openWhatsApp } from '../utils/whatsapp';
import ServiceLogo from './ServiceLogo';

interface Props {
  service: LocalService;
}

function contactDigits(phone?: string | null): string {
  return (phone ?? '').replace(/\D/g, '');
}

function MetaRow({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={16} color={colors.textMuted} style={styles.metaIcon} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

export default function ServiceBusinessCard({ service }: Props) {
  const phone = service.phone?.trim();
  const whatsapp = (service.whatsapp?.trim() || phone) ?? '';
  const address = service.address?.trim();
  const schedule = service.schedule?.trim();
  const instagram = service.instagram?.trim();
  const facebook = service.facebook?.trim();
  const description = service.description?.trim() || 'Servicio local en Zinapécuaro';

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

  const primaryActions = [
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
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    style: object | object[];
    onPress: () => void;
  }>;

  const socialActions = [
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
  ].filter(Boolean) as Array<{
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    label: string;
    onPress: () => void;
  }>;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <ServiceLogo
          category={service.category}
          logoUrl={service.logo_url}
          logo={service.logo}
          size="md"
          style={styles.logo}
        />
        <View style={styles.titleBlock}>
          {!!service.category_display && (
            <Text style={styles.categoryText} numberOfLines={1}>
              {service.category_display}
            </Text>
          )}
          <Text style={styles.name}>{service.name}</Text>
        </View>
      </View>

      <Text style={styles.description} numberOfLines={3}>
        {description}
      </Text>

      {(schedule || address || phone) && (
        <View style={styles.metaBlock}>
          {schedule ? <MetaRow icon="time-outline" text={schedule} /> : null}
          {address ? <MetaRow icon="location-outline" text={address} /> : null}
          {phone ? <MetaRow icon="call-outline" text={phone} /> : null}
        </View>
      )}

      {primaryActions.length > 0 ? (
        <View style={styles.actions}>
          {primaryActions.map((action) => (
            <Pressable
              key={action.key}
              style={({ pressed }) => [
                action.style,
                styles.actionFlex,
                pressed && styles.actionPressed,
              ]}
              onPress={action.onPress}
            >
              <Ionicons name={action.icon} size={18} color={action.color} />
              <Text style={styles.actionText} numberOfLines={1}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.noContact}>Sin datos de contacto por ahora</Text>
      )}

      {socialActions.length > 0 ? (
        <View style={styles.socialRow}>
          {socialActions.map((action) => (
            <Pressable
              key={action.key}
              style={({ pressed }) => [styles.socialIconBtn, pressed && styles.actionPressed]}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <Ionicons name={action.icon} size={20} color={action.color} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...cardShadow,
  },
  header: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    flexShrink: 0,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  metaBlock: {
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  metaIcon: {
    marginTop: 2,
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionFlex: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 0,
    maxWidth: '100%',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    paddingVertical: 11,
    paddingHorizontal: 12,
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
  socialBtn: {
    backgroundColor: colors.background,
  },
  actionText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 8,
  },
  socialIconBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  noContact: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
