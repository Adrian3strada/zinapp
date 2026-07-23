import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VEHICLE_OPTIONS } from '../../constants/vehicleTypes';
import { useAuth } from '../../context/AuthContext';
import { orderApi, settlementApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { HIT_SLOP } from '../../theme/spacing';
import type { DeliveryProfile, SettlementSummary as SettlementData, User } from '../../types';
import { formatCurrency } from '../../utils/format';
import { appConfirm } from '../../utils/appAlert';

const DRAWER_WIDTH = Math.min(320, Dimensions.get('window').width * 0.86);

type EarningsData = {
  week_deliveries: number;
  week_earnings: string;
  cash_deliveries: number;
  transfer_deliveries: number;
  daily_breakdown: { date: string; deliveries: number; earnings: string }[];
};

interface Props {
  visible: boolean;
  onClose: () => void;
  profile: DeliveryProfile | null;
  updating: boolean;
  onToggleAvailability: (value: boolean) => void;
  onNavigateInicio: () => void;
  onNavigateEntregas: () => void;
  onNavigatePerfil: () => void;
}

type MenuKey = 'inicio' | 'entregas' | 'perfil' | 'logout';

export default function DriverSideMenu({
  visible,
  onClose,
  profile,
  updating,
  onToggleAvailability,
  onNavigateInicio,
  onNavigateEntregas,
  onNavigatePerfil,
}: Props) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [settlement, setSettlement] = useState<SettlementData | null>(null);
  const [loadingMoney, setLoadingMoney] = useState(false);

  const isAvailable = profile?.is_available ?? false;
  const isApproved = profile?.verification_status === 'approved';

  useEffect(() => {
    if (visible) {
      slide.setValue(-DRAWER_WIDTH);
      fade.setValue(0);
      Animated.parallel([
        Animated.spring(slide, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 4,
          speed: 14,
        }),
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      setLoadingMoney(true);
      Promise.all([
        orderApi.driverEarnings().then((r) => r.data).catch(() => null),
        settlementApi.driver().then((r) => r.data).catch(() => null),
      ]).then(([earn, settle]) => {
        setEarnings(earn);
        setSettlement(settle);
      }).finally(() => setLoadingMoney(false));
    }
  }, [visible, slide, fade]);

  const requestClose = () => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: -DRAWER_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  const vehicleLabel = useMemo(() => {
    if (!profile?.vehicle_type) return 'Sin vehículo';
    return VEHICLE_OPTIONS.find((v) => v.value === profile.vehicle_type)?.label ?? profile.vehicle_type;
  }, [profile]);

  const closeThen = (fn: () => void) => {
    requestClose();
    setTimeout(fn, 200);
  };

  const handleMenu = (key: MenuKey) => {
    if (key === 'inicio') {
      closeThen(onNavigateInicio);
      return;
    }
    if (key === 'entregas') {
      closeThen(onNavigateEntregas);
      return;
    }
    if (key === 'perfil') {
      closeThen(onNavigatePerfil);
      return;
    }
    if (key === 'logout') {
      appConfirm('Cerrar sesión', '¿Salir de tu cuenta de repartidor?', () => {
        requestClose();
        void logout();
      }, 'Salir');
    }
  };

  const displayName = displayUserName(user);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={requestClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: fade }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityLabel="Cerrar menú" />
        </Animated.View>

        <Animated.View
          style={[
            styles.drawer,
            {
              width: DRAWER_WIDTH,
              paddingTop: insets.top + 12,
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateX: slide }],
            },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            <View style={styles.header}>
              <View style={styles.avatarWrap}>
                {user?.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Ionicons name="bicycle" size={28} color={colors.accentDark} />
                  </View>
                )}
              </View>
              <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {vehicleLabel}
                {profile?.license_plate ? ` · ${profile.license_plate}` : ''}
              </Text>

              <View style={styles.onlineRow}>
                <View style={styles.onlineTextWrap}>
                  <Text style={styles.onlineTitle}>
                    {!isApproved
                      ? 'Pendiente de aprobación'
                      : isAvailable
                        ? 'Conectado'
                        : 'Desconectado'}
                  </Text>
                  <Text style={styles.onlineSub}>
                    {isApproved
                      ? 'Recibe pedidos cuando estés en línea'
                      : 'Completa tu perfil para conectarte'}
                  </Text>
                </View>
                <Switch
                  value={isAvailable}
                  onValueChange={onToggleAvailability}
                  disabled={updating || !isApproved}
                  trackColor={{ false: colors.border, true: colors.accent + '66' }}
                  thumbColor={isAvailable ? colors.accent : colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.earnCard}>
              <Text style={styles.earnEyebrow}>Ganancias · 7 días</Text>
              {loadingMoney && !earnings ? (
                <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
              ) : (
                <>
                  <Text style={styles.earnValue}>
                    {formatCurrency(earnings?.week_earnings ?? '0')}
                  </Text>
                  <Text style={styles.earnHint}>
                    {earnings?.week_deliveries ?? 0} entrega
                    {(earnings?.week_deliveries ?? 0) === 1 ? '' : 's'}
                    {earnings
                      ? ` · Efectivo ${earnings.cash_deliveries} · Transfer ${earnings.transfer_deliveries}`
                      : ''}
                  </Text>
                  {earnings?.daily_breakdown?.slice(0, 3).map((day) => (
                    <View key={day.date} style={styles.dayRow}>
                      <Text style={styles.dayDate}>{day.date}</Text>
                      <Text style={styles.dayVal}>
                        {day.deliveries} · {formatCurrency(day.earnings)}
                      </Text>
                    </View>
                  ))}
                  {settlement ? (
                    <View style={styles.settleBox}>
                      <Text style={styles.settleTitle}>Liquidación estimada</Text>
                      <Text style={styles.settleRow}>
                        Envíos {formatCurrency(String(settlement.delivery_fees ?? 0))} · Propinas{' '}
                        {formatCurrency(String(settlement.tips ?? 0))}
                      </Text>
                      <Text style={styles.settleTotal}>
                        {formatCurrency(String(settlement.total_payout ?? 0))}
                      </Text>
                    </View>
                  ) : null}
                </>
              )}
              <Pressable
                style={styles.earnLink}
                onPress={() => handleMenu('perfil')}
                hitSlop={HIT_SLOP}
              >
                <Text style={styles.earnLinkText}>Ver detalle en Mi perfil</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.accentDark} />
              </Pressable>
            </View>

            <View style={styles.menuBlock}>
              <MenuItem
                icon="map-outline"
                label="Inicio"
                hint="Mapa y pedidos"
                onPress={() => handleMenu('inicio')}
              />
              <MenuItem
                icon="bicycle-outline"
                label="Mis entregas"
                hint="Activas e historial"
                onPress={() => handleMenu('entregas')}
              />
              <MenuItem
                icon="person-outline"
                label="Mi cuenta"
                hint="Datos, INE y vehículo"
                onPress={() => handleMenu('perfil')}
              />
              <MenuItem
                icon="log-out-outline"
                label="Cerrar sesión"
                hint="Salir de ZinApp"
                danger
                onPress={() => handleMenu('logout')}
              />
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function displayUserName(user: User | null | undefined): string {
  const first = user?.first_name?.trim();
  const last = user?.last_name?.trim();
  if (first || last) return [first, last].filter(Boolean).join(' ');
  return user?.username ?? 'Repartidor';
}

function MenuItem({
  icon,
  label,
  hint,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
      hitSlop={HIT_SLOP}
    >
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Ionicons
          name={icon}
          size={20}
          color={danger ? colors.error : colors.accentDark}
        />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
        <Text style={styles.menuHint}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  drawer: {
    backgroundColor: colors.surface,
    height: '100%',
    zIndex: 2,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 4, height: 0 },
  },
  scroll: { paddingHorizontal: 16, gap: 16, paddingBottom: 24 },
  header: { gap: 6 },
  avatarWrap: { marginBottom: 4 },
  avatarImg: { width: 64, height: 64, borderRadius: 20 },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 20, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
  meta: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  onlineRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 12,
  },
  onlineTextWrap: { flex: 1, gap: 2 },
  onlineTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  onlineSub: { fontSize: 11, color: colors.textSecondary, fontWeight: '500', lineHeight: 15 },
  earnCard: {
    backgroundColor: colors.accentLight,
    borderRadius: 20,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.accent + '33',
  },
  earnEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accentDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  earnValue: { fontSize: 32, fontWeight: '900', color: colors.accentDark, letterSpacing: -0.8 },
  earnHint: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.accent + '33',
  },
  dayDate: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  dayVal: { fontSize: 12, fontWeight: '800', color: colors.text },
  settleBox: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    gap: 2,
  },
  settleTitle: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  settleRow: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  settleTotal: { fontSize: 16, fontWeight: '900', color: colors.accentDark, marginTop: 2 },
  earnLink: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  earnLinkText: { fontSize: 13, fontWeight: '800', color: colors.accentDark },
  menuBlock: { gap: 4 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  menuItemPressed: { backgroundColor: colors.background },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconDanger: { backgroundColor: '#FEF2F2' },
  menuText: { flex: 1, gap: 1 },
  menuLabel: { fontSize: 15, fontWeight: '800', color: colors.text },
  menuLabelDanger: { color: colors.error },
  menuHint: { fontSize: 11, fontWeight: '500', color: colors.textMuted },
});
