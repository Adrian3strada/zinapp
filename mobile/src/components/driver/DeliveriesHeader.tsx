import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { cardShadow } from '../../theme/shadows';
import { formatCurrency } from '../../utils/format';

interface Props {
  topInset: number;
  activeCount: number;
  historyCount: number;
  isAvailable: boolean;
  activeEarnings: number;
  onContinue?: () => void;
}

/** Header compacto DiDi-like para Mis entregas. */
export default function DeliveriesHeader({
  topInset,
  activeCount,
  historyCount,
  isAvailable,
  activeEarnings,
  onContinue,
}: Props) {
  return (
    <View style={[styles.wrap, { paddingTop: topInset + 12 }]}>
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>Historial</Text>
          <Text style={styles.title}>Mis entregas</Text>
        </View>
        <View style={[styles.livePill, isAvailable ? styles.liveOn : styles.liveOff]}>
          <View style={[styles.dot, { backgroundColor: isAvailable ? colors.success : colors.textMuted }]} />
          <Text style={[styles.liveText, { color: isAvailable ? colors.success : colors.textMuted }]}>
            {isAvailable ? 'En línea' : 'Offline'}
          </Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{activeCount}</Text>
          <Text style={styles.metricLabel}>Activas</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{formatCurrency(String(activeEarnings))}</Text>
          <Text style={styles.metricLabel}>En curso</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{historyCount}</Text>
          <Text style={styles.metricLabel}>Anteriores</Text>
        </View>
      </View>

      {activeCount > 0 && onContinue ? (
        <Pressable style={[styles.continueBtn, cardShadow]} onPress={onContinue}>
          <Ionicons name="navigate-circle" size={22} color="#FFF" />
          <View style={styles.continueText}>
            <Text style={styles.continueTitle}>Continuar entrega</Text>
            <Text style={styles.continueSub}>Abre el mapa de Inicio</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.85)" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titleBlock: { gap: 2 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: { fontSize: 26, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  liveOn: { backgroundColor: colors.success + '18' },
  liveOff: { backgroundColor: colors.background },
  dot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontSize: 11, fontWeight: '800' },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  metric: { flex: 1, alignItems: 'center', gap: 2 },
  metricValue: { fontSize: 17, fontWeight: '900', color: colors.text },
  metricLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  divider: { width: 1, height: 28, backgroundColor: colors.border },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  continueText: { flex: 1, gap: 1 },
  continueTitle: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  continueSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
});
