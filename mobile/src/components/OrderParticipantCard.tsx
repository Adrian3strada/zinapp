import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import ProfileAvatarDisplay from './ProfileAvatarDisplay';
import { colors } from '../theme/colors';
import { cardShadow } from '../theme/shadows';
import type { User } from '../types';

interface Props {
  label: string;
  user: User;
  subtitle?: string | null;
  onPress: () => void;
}

function displayName(user: User): string {
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ');
  return full || user.username;
}

export default function OrderParticipantCard({ label, user, subtitle, onPress }: Props) {
  const fallback = user.first_name?.[0] ?? user.username[0] ?? '?';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      <ProfileAvatarDisplay
        remoteUrl={user.avatar_url}
        fallbackLetter={fallback}
        size={52}
      />
      <View style={styles.info}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.name}>{displayName(user)}</Text>
        {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  pressed: { opacity: 0.94 },
  info: { flex: 1, minWidth: 0 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
