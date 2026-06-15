import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { HIT_SLOP, spacing } from '../theme/spacing';
import { cardShadow } from '../theme/shadows';

interface Props {
  title: string;
  subtitle: string;
  emoji: string;
  colors: [string, string];
  onPress: () => void;
  style?: ViewStyle;
  badge?: number;
}

export default function ServiceSectionCard({
  title,
  subtitle,
  emoji,
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
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <View style={styles.emojiCircle}>
          <Text style={styles.emoji}>{emoji}</Text>
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
        <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.9)" />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 20,
    overflow: 'hidden',
    minHeight: 108,
    ...cardShadow,
  },
  pressed: { opacity: 0.94, transform: [{ scale: 0.995 }] },
  gradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
    minHeight: 108,
  },
  emojiCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  emoji: { fontSize: 28 },
  textBlock: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    fontWeight: '500',
    lineHeight: 18,
  },
});
