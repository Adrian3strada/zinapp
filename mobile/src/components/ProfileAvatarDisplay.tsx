import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

interface Props {
  remoteUrl?: string | null;
  fallbackLetter: string;
  size?: number;
  variant?: 'hero' | 'card';
}

export default function ProfileAvatarDisplay({
  remoteUrl,
  fallbackLetter,
  size = 96,
  variant = 'card',
}: Props) {
  const radius = size / 2;
  const isHero = variant === 'hero';

  return (
    <View
      style={[
        styles.avatar,
        isHero ? styles.avatarHero : styles.avatarCard,
        { width: size, height: size, borderRadius: radius },
      ]}
    >
      {remoteUrl ? (
        <Image
          source={{ uri: remoteUrl }}
          style={{ width: size, height: size, borderRadius: radius }}
        />
      ) : (
        <Text style={[styles.letter, isHero ? styles.letterHero : styles.letterCard, { fontSize: size * 0.38 }]}>
          {fallbackLetter.toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarHero: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  avatarCard: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary + '33',
  },
  letter: { fontWeight: '800' },
  letterHero: { color: colors.surface },
  letterCard: { color: colors.primary },
});
