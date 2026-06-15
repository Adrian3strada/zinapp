import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { HIT_SLOP } from '../theme/spacing';

interface Props {
  imageUri?: string | null;
  remoteUrl?: string | null;
  fallbackLetter: string;
  onPick: () => void;
  label?: string;
  size?: number;
}

export default function ProfileAvatarPicker({
  imageUri,
  remoteUrl,
  fallbackLetter,
  onPick,
  label = 'Cambiar foto',
  size = 96,
}: Props) {
  const source = imageUri ? { uri: imageUri } : remoteUrl ? { uri: remoteUrl } : null;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPick}
        hitSlop={HIT_SLOP}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      >
        {source ? (
          <Image source={source} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />
        ) : (
          <Text style={[styles.letter, { fontSize: size * 0.38 }]}>
            {fallbackLetter.toUpperCase()}
          </Text>
        )}
        <View style={styles.badge}>
          <Ionicons name="camera" size={16} color="#FFF" />
        </View>
      </Pressable>
      <Pressable onPress={onPick} hitSlop={HIT_SLOP}>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
  avatar: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.45)',
    overflow: 'hidden',
  },
  image: { resizeMode: 'cover' },
  letter: { fontWeight: '800', color: '#FFF' },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  label: { color: 'rgba(255,255,255,0.95)', fontWeight: '600', fontSize: 14 },
});
