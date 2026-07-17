import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { cardShadow } from '../theme/shadows';

interface Props {
  isAvailable: boolean;
  isApproved?: boolean;
  updating: boolean;
  onToggle: (value: boolean) => void;
}

export default function DriverAvailabilityBanner({ isAvailable, isApproved = true, updating, onToggle }: Props) {
  return (
    <View style={[styles.banner, !isAvailable && styles.bannerOff, isAvailable && styles.bannerOn]}>
      <View style={[styles.iconWrap, isAvailable && styles.iconWrapOn]}>
        <Ionicons
          name={isAvailable ? 'radio-button-on' : 'moon-outline'}
          size={24}
          color={isAvailable ? colors.success : colors.textMuted}
        />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{isAvailable ? 'Estás en línea' : 'Fuera de línea'}</Text>
        <Text style={styles.sub}>
          {!isApproved
            ? 'Completa tu perfil y espera la aprobación de ZinApp'
            : isAvailable
            ? 'Recibes pedidos y compartes ubicación con la app'
            : 'Activa para ver pedidos nuevos y compartir GPS'}
        </Text>
      </View>
      {updating ? (
        <ActivityIndicator color={colors.shipmentStart} />
      ) : (
        <Switch
          value={isAvailable}
          onValueChange={onToggle}
          disabled={!isApproved}
          trackColor={{ false: colors.border, true: colors.shipmentStart + '55' }}
          thumbColor={isAvailable ? colors.shipmentStart : colors.textMuted}
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
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  bannerOn: { borderColor: colors.success + '55', backgroundColor: '#F0FDF488' },
  bannerOff: { borderColor: colors.border },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOn: { backgroundColor: colors.success + '18' },
  textWrap: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, fontWeight: '500' },
});
