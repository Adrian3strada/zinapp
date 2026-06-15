import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';

import { colors } from '../theme/colors';

interface Props {
  isAvailable: boolean;
  updating: boolean;
  onToggle: (value: boolean) => void;
}

export default function DriverAvailabilityBanner({ isAvailable, updating, onToggle }: Props) {
  return (
    <View style={[styles.banner, !isAvailable && styles.bannerOff]}>
      <View style={styles.iconWrap}>
        <Ionicons
          name={isAvailable ? 'radio-button-on' : 'radio-button-off'}
          size={28}
          color={isAvailable ? colors.success : colors.textMuted}
        />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{isAvailable ? 'Estás disponible' : 'No disponible'}</Text>
        <Text style={styles.sub}>
          {isAvailable
            ? 'Recibes pedidos y compartes ubicación con la app'
            : 'Activa para ver pedidos nuevos y compartir GPS'}
        </Text>
      </View>
      {updating ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Switch
          value={isAvailable}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primaryLight }}
          thumbColor={isAvailable ? colors.primary : colors.textMuted}
          accessibilityLabel="Disponible para entregas"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.success,
  },
  bannerOff: { borderColor: colors.border },
  iconWrap: { width: 32, alignItems: 'center' },
  textWrap: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
});
