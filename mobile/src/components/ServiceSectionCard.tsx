import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { HIT_SLOP, spacing } from '../theme/spacing';
import { softShadow } from '../theme/shadows';
import type { ServiceCategoryIcon } from '../utils/serviceCategories';
import { webPassThroughPointerEvents } from '../utils/webPlatform';

interface Props {
  title: string;
  /** Texto corto bajo el título (opcional en layout tipo Didi). */
  subtitle?: string;
  icon: ServiceCategoryIcon;
  colors: [string, string];
  onPress: () => void;
  style?: ViewStyle;
  badge?: number;
}

/** Cuadrito de acceso rápido estilo Didi: icono + etiqueta. */
export default function ServiceSectionCard({
  title,
  subtitle,
  icon,
  colors: gradientColors,
  onPress,
  style,
  badge,
}: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed, style]}
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
    >
      <View style={styles.tile}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          pointerEvents={webPassThroughPointerEvents()}
          style={styles.iconBox}
        >
          <Ionicons name={icon} size={30} color="#FFF" />
          {badge != null && badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          )}
        </LinearGradient>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 0,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  tile: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
  },
  iconBox: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...softShadow,
  },  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: 2,
  },
});
