import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import ProfileAvatarDisplay from './ProfileAvatarDisplay';
import SearchField from './SearchField';
import { colors } from '../theme/colors';
import { HIT_SLOP } from '../theme/spacing';

interface Props {
  topInset: number;
  firstName?: string | null;
  avatarUrl?: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onProfilePress?: () => void;
  onSeeAllPress?: () => void;
}

function initials(name?: string | null): string {
  const n = (name ?? 'Z').trim();
  return n.charAt(0).toUpperCase() || 'Z';
}

/** Header compacto comida-first (estilo DiDi / Uber Eats). */
export default function CustomerHomeHeader({
  topInset,
  firstName,
  avatarUrl,
  search,
  onSearchChange,
  onProfilePress,
  onSeeAllPress,
}: Props) {
  const greeting = firstName?.trim() ? `Hola, ${firstName}` : '¿Qué se te antoja?';

  return (
    <View style={[styles.wrap, { paddingTop: topInset + 10 }]}>
      <View style={styles.topRow}>
        <View style={styles.textBlock}>
          <Text style={styles.greeting} numberOfLines={1}>
            {greeting}
          </Text>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={14} color={colors.text} />
            <Text style={styles.location}>Zinapécuaro, Mich.</Text>
          </View>
        </View>
        {onProfilePress ? (
          <Pressable onPress={onProfilePress} hitSlop={HIT_SLOP} accessibilityLabel="Ir a mi perfil">
            <ProfileAvatarDisplay
              remoteUrl={avatarUrl}
              fallbackLetter={initials(firstName)}
              size={40}
            />
          </Pressable>
        ) : null}
      </View>

      <SearchField
        value={search}
        onChangeText={onSearchChange}
        placeholder="Buscar restaurantes o comida…"
      />

      {onSeeAllPress ? (
        <Pressable style={styles.seeAll} onPress={onSeeAllPress} hitSlop={HIT_SLOP}>
          <Text style={styles.seeAllText}>Ver mapa y filtros</Text>
          <Ionicons name="map-outline" size={16} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginBottom: 4 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  textBlock: { flex: 1, minWidth: 0, gap: 2 },
  greeting: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.4,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  location: { fontSize: 13, fontWeight: '700', color: colors.text },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: -4,
  },
  seeAllText: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
