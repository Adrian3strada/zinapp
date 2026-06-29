import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Button from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';

const BENEFITS = [
  { icon: 'cart-outline' as const, text: 'Pedir comida a domicilio' },
  { icon: 'receipt-outline' as const, text: 'Ver y seguir tus pedidos' },
  { icon: 'pricetag-outline' as const, text: 'Usar cupones y propinas' },
];

export default function GuestAccountScreen() {
  const { requestLogin } = useAuth();
  const { insets, scrollPaddingBottom, pagePadding } = useTabScreenInsets();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingHorizontal: pagePadding, paddingTop: insets.top + spacing.lg },
        scrollPaddingBottom(),
      ]}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.hero}
      >
        <Ionicons name="person-circle-outline" size={56} color="#FFF" />
        <Text style={styles.heroTitle}>Modo invitado</Text>
        <Text style={styles.heroText}>
          Explora restaurantes, menús y servicios. Crea una cuenta cuando quieras pedir.
        </Text>
      </LinearGradient>

      <View style={[styles.card, cardShadow]}>
        <Text style={styles.cardTitle}>Con una cuenta puedes</Text>
        {BENEFITS.map((item) => (
          <View key={item.text} style={styles.benefitRow}>
            <Ionicons name={item.icon} size={20} color={colors.primary} />
            <Text style={styles.benefitText}>{item.text}</Text>
          </View>
        ))}
        <Button title="Iniciar sesión" onPress={requestLogin} size="lg" style={styles.btn} />
        <Button title="Crear cuenta" variant="secondary" onPress={requestLogin} size="lg" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  hero: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  heroText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitText: { flex: 1, fontSize: 14, color: colors.textSecondary },
  btn: { marginTop: 8 },
});
