import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigationState } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from './BrandLogo';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { CustomerTabParamList } from '../navigation/types';

type TabRoute = keyof CustomerTabParamList;

interface NavItem {
  route: TabRoute;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const ITEMS: NavItem[] = [
  { route: 'Inicio', label: 'Inicio', icon: 'home' },
  { route: 'Pedidos', label: 'Mis pedidos', icon: 'receipt' },
  { route: 'Carrito', label: 'Mi carrito', icon: 'cart' },
  { route: 'Perfil', label: 'Mi perfil', icon: 'person' },
];

interface Props {
  navigation: BottomTabNavigationProp<CustomerTabParamList>;
  orderBadge?: number;
  cartBadge?: number;
}

/** Navegación lateral en web desktop (reemplaza tabs inferiores). */
export default function WebSidebar({ navigation, orderBadge = 0, cartBadge = 0 }: Props) {
  const activeRoute = useNavigationState((state) => {
    if (!state?.routes?.length) return 'Inicio' as TabRoute;
    return state.routes[state.index ?? 0]?.name as TabRoute;
  });

  const badgeFor = (route: TabRoute): number | undefined => {
    if (route === 'Pedidos' && orderBadge > 0) return orderBadge;
    if (route === 'Carrito' && cartBadge > 0) return cartBadge;
    return undefined;
  };

  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <BrandMark size={36} variant="dark" />
        <Text style={styles.brandText}>ZinApp</Text>
      </View>
      <Text style={styles.brandSub}>Zinapécuaro, Mich.</Text>

      <View style={styles.nav}>
        {ITEMS.map((item) => {
          const active = activeRoute === item.route;
          const badge = badgeFor(item.route);
          return (
            <Pressable
              key={item.route}
              onPress={() => navigation.navigate(item.route)}
              style={({ pressed }) => [
                styles.item,
                active && styles.itemActive,
                pressed && styles.itemPressed,
              ]}
            >
              <Ionicons
                name={item.icon}
                size={22}
                color={active ? colors.primary : colors.textSecondary}
              />
              <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>{item.label}</Text>
              {badge != null && badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    borderRightWidth: 1,
    borderRightColor: colors.borderLight,
    backgroundColor: colors.surface,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.sm,
  },
  brandText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
    fontWeight: '600',
  },
  nav: { gap: 6 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
  },
  itemActive: {
    backgroundColor: colors.primaryLight,
  },
  itemPressed: { opacity: 0.9 },
  itemLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  itemLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
});
