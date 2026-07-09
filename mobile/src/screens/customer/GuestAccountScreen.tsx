import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Button from '../../components/Button';
import HomeHero from '../../components/HomeHero';
import { useAuth } from '../../context/AuthContext';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';

const BENEFITS = [
  { icon: 'cart-outline' as const, text: 'Pedir comida a domicilio', color: colors.primary },
  { icon: 'receipt-outline' as const, text: 'Ver y seguir tus pedidos en vivo', color: colors.shipmentStart },
  { icon: 'pricetag-outline' as const, text: 'Usar cupones y promociones', color: colors.accent },
];

export default function GuestAccountScreen() {
  const { requestLogin } = useAuth();
  const { insets, scrollPaddingBottom, pagePadding } = useTabScreenInsets();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingHorizontal: pagePadding },
        scrollPaddingBottom(),
      ]}
      showsVerticalScrollIndicator={false}
    >
      <HomeHero
        topInset={insets.top}
        subtitle="Explora Zinapécuaro sin cuenta"
        style={[styles.hero, { marginHorizontal: -pagePadding }]}
      >
        <Text style={styles.heroTitle}>Modo invitado</Text>
        <Text style={styles.heroText}>
          Mira restaurantes, menús y servicios. Crea tu cuenta cuando quieras pedir.
        </Text>
      </HomeHero>

      <View style={[styles.card, cardShadow, styles.cardOverlap]}>
        <View style={styles.cardHeader}>
          <LinearGradient colors={[colors.primaryLight, '#FFF']} style={styles.cardHeaderBg}>
            <Ionicons name="sparkles-outline" size={22} color={colors.primary} />
            <Text style={styles.cardTitle}>Con una cuenta puedes</Text>
          </LinearGradient>
        </View>
        <View style={styles.cardBody}>
          {BENEFITS.map((item) => (
            <View key={item.text} style={styles.benefitRow}>
              <View style={[styles.benefitIcon, { backgroundColor: item.color + '18' }]}>
                <Ionicons name={item.icon} size={18} color={item.color} />
              </View>
              <Text style={styles.benefitText}>{item.text}</Text>
            </View>
          ))}
          <Button title="Iniciar sesión" onPress={requestLogin} size="lg" style={styles.btn} />
          <Button title="Crear cuenta gratis" variant="secondary" onPress={requestLogin} size="lg" />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.background },
  hero: { marginBottom: 0 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#FFF', marginTop: spacing.lg },
  heroText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
    lineHeight: 20,
    fontWeight: '500',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardOverlap: { marginTop: -28, zIndex: 2 },
  cardHeader: { overflow: 'hidden' },
  cardHeaderBg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  cardBody: { padding: 20, gap: 14 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { flex: 1, fontSize: 14, color: colors.textSecondary, fontWeight: '600', lineHeight: 19 },
  btn: { marginTop: 4 },
});
