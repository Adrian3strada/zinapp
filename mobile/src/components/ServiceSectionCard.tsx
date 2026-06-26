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
  subtitle: string;
  icon: ServiceCategoryIcon;
  colors: [string, string];
  onPress: () => void;
  style?: ViewStyle;
  badge?: number;
}

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
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents={webPassThroughPointerEvents()}
        style={styles.gradient}
      >
        <View style={styles.decor} />
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={26} color="#FFF" />
          {badge != null && badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          )}
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.arrow}>
          <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.95)" />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 22,
    overflow: 'hidden',
    minHeight: 112,
    ...softShadow,
  },
  pressed: { opacity: 0.95 },
  gradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    minHeight: 112,
    position: 'relative',
  },
  decor: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
    right: -30,
    top: -30,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  textBlock: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 4,
    fontWeight: '500',
    lineHeight: 18,
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
