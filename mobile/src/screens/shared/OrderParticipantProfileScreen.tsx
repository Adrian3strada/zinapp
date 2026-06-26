import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ContactWhatsAppButton from '../../components/ContactWhatsAppButton';
import ProfileAvatarDisplay from '../../components/ProfileAvatarDisplay';
import ScreenContainer from '../../components/ScreenContainer';
import { VEHICLE_OPTIONS } from '../../constants/vehicleTypes';
import { useAuth } from '../../context/AuthContext';
import type { OrderParticipantProfileScreenProps } from '../../navigation/types';
import { orderApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { Order, User } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { formatOrderLabel, orderRef } from '../../utils/orderDisplay';
import {
  customerContactMessage,
  driverContactMessage,
} from '../../utils/whatsapp';

function displayName(user: User): string {
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ');
  return full || user.username;
}

function vehicleIcon(type?: string): keyof typeof Ionicons.glyphMap {
  const match = VEHICLE_OPTIONS.find((v) => v.value === type);
  return (match?.icon ?? 'bicycle-outline') as keyof typeof Ionicons.glyphMap;
}

export default function OrderParticipantProfileScreen({
  route,
}: OrderParticipantProfileScreenProps) {
  const { orderId, participant } = route.params;
  const { user: viewer } = useAuth();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await orderApi.get(orderId);
      setOrder(data);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo cargar el perfil'));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const participantUser =
    participant === 'driver' ? order?.driver_detail : order?.customer_detail;

  const canView =
    !!order
    && !!participantUser
    && order.status !== 'cancelled'
    && (
      (viewer?.role === 'customer' && participant === 'driver' && !!order.driver)
      || (viewer?.role === 'driver' && participant === 'customer')
      || viewer?.role === 'restaurant'
      || viewer?.role === 'admin'
    );

  const title = participant === 'driver' ? 'Repartidor' : 'Cliente';
  const orderLabel = order ? orderRef(order) : `#${orderId}`;

  const handleCall = async () => {
    const phone = participantUser?.phone?.trim();
    if (!phone) return;
    const url = `tel:${phone.replace(/\s/g, '')}`;
    try {
      await Linking.openURL(url);
    } catch {
      // noop
    }
  };

  return (
    <ScreenContainer loading={loading} error={error || (!canView && !loading ? 'Perfil no disponible.' : null)} onRetry={() => { setLoading(true); load(); }}>
      {canView && participantUser && order && (
        <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            style={[styles.header, { paddingTop: spacing.md }]}
          >
            <ProfileAvatarDisplay
              remoteUrl={participantUser.avatar_url}
              fallbackLetter={participantUser.first_name?.[0] ?? participantUser.username[0]}
              size={104}
              variant="hero"
            />
            <Text style={styles.name}>{displayName(participantUser)}</Text>
            <Text style={styles.username}>@{participantUser.username}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.role}>{title}</Text>
            </View>
            <Text style={styles.orderHint}>Pedido {orderLabel}</Text>
          </LinearGradient>

          <View style={[styles.card, styles.cardOverlap]}>
            <Text style={styles.section}>Contacto</Text>
            {participantUser.phone ? (
              <>
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Teléfono</Text>
                    <Pressable onPress={handleCall}>
                      <Text style={styles.linkValue}>{participantUser.phone}</Text>
                    </Pressable>
                  </View>
                </View>
                <ContactWhatsAppButton
                  phone={participantUser.phone}
                  message={
                    participant === 'driver'
                      ? driverContactMessage(orderLabel, order.restaurant_detail?.name ?? 'restaurante')
                      : customerContactMessage(orderLabel)
                  }
                  label={participant === 'driver' ? 'WhatsApp al repartidor' : 'WhatsApp al cliente'}
                />
              </>
            ) : (
              <Text style={styles.muted}>Sin teléfono registrado.</Text>
            )}
          </View>

          {participant === 'driver' && order.driver_delivery_profile && (
            <View style={styles.card}>
              <Text style={styles.section}>Vehículo</Text>
              <View style={styles.infoRow}>
                <Ionicons
                  name={vehicleIcon(order.driver_delivery_profile.vehicle_type)}
                  size={20}
                  color={colors.primary}
                />
                <View>
                  <Text style={styles.label}>Tipo</Text>
                  <Text style={styles.value}>
                    {order.driver_delivery_profile.vehicle_type_display ?? '—'}
                  </Text>
                </View>
              </View>
              {!!order.driver_delivery_profile.license_plate && (
                <View style={styles.infoRow}>
                  <Ionicons name="card-outline" size={18} color={colors.primary} />
                  <View>
                    <Text style={styles.label}>Placas</Text>
                    <Text style={styles.value}>{order.driver_delivery_profile.license_plate}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {participant === 'customer' && (
            <View style={styles.card}>
              <Text style={styles.section}>Entrega</Text>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Dirección del pedido</Text>
                  <Text style={styles.value}>{order.delivery_address}</Text>
                </View>
              </View>
              {!!order.delivery_notes && (
                <View style={styles.infoRow}>
                  <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Notas</Text>
                    <Text style={styles.value}>{order.delivery_notes}</Text>
                  </View>
                </View>
              )}
              {!!participantUser.address && (
                <View style={styles.infoRow}>
                  <Ionicons name="home-outline" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Dirección habitual</Text>
                    <Text style={styles.value}>{participantUser.address}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {participant === 'driver' && viewer?.role === 'customer' && (
            <Text style={styles.footerHint}>
              Tu repartidor de {formatOrderLabel(order)}. Usa WhatsApp para coordinar la entrega.
            </Text>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xxl },
  header: {
    alignItems: 'center',
    paddingBottom: spacing.xxl + 24,
    paddingHorizontal: spacing.screen,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  name: { fontSize: 22, fontWeight: '800', color: '#FFF', marginTop: spacing.md },
  username: { color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  roleBadge: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  role: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  orderHint: { marginTop: spacing.sm, fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: spacing.lg,
    marginHorizontal: spacing.screen,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  cardOverlap: { marginTop: -32, zIndex: 2 },
  section: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: -0.2,
  },
  infoRow: { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'flex-start' },
  label: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: { fontSize: 15, color: colors.text, fontWeight: '600', marginTop: 2 },
  linkValue: { fontSize: 15, color: colors.primary, fontWeight: '700', marginTop: 2 },
  muted: { fontSize: 14, color: colors.textSecondary },
  footerHint: {
    marginHorizontal: spacing.screen,
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
  },
});
