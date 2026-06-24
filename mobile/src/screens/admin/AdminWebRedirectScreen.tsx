import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import Button from '../../components/Button';
import ScreenContainer from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import { getPanelLoginUrl } from '../../utils/panelUrl';

export default function AdminWebRedirectScreen() {
  const { logout } = useAuth();
  const panelUrl = getPanelLoginUrl();

  const openPanel = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign(panelUrl);
      return;
    }
    void Linking.openURL(panelUrl);
  };

  return (
    <ScreenContainer>
      <View style={styles.wrap}>
        <View style={[styles.card, cardShadow]}>
          <View style={styles.iconWrap}>
            <Ionicons name="desktop-outline" size={40} color={colors.primary} />
          </View>
          <Text style={styles.title}>Panel de operaciones</Text>
          <Text style={styles.body}>
            La administración de ZinApp (activar locales, pedidos, usuarios) está en el panel web,
            no en esta app.
          </Text>
          <Text style={styles.url}>{panelUrl}</Text>
          <Button title="Ir al panel" onPress={openPanel} size="lg" />
          <Pressable
            onPress={() => {
              void logout();
            }}
            style={styles.logout}
          >
            <Text style={styles.logoutText}>Cerrar sesión en la app</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.screen,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  url: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  logout: { paddingVertical: spacing.sm },
  logoutText: { color: colors.textMuted, fontSize: 14 },
});
