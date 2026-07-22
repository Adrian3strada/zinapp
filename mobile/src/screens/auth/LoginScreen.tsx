import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { appAlert } from '../../utils/appAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BrandLogo from '../../components/BrandLogo';
import HeroBackground from '../../components/HeroBackground';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import FormSection from '../../components/FormSection';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import { useAuth } from '../../context/AuthContext';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import type { LoginScreenProps } from '../../navigation/types';
import { API_URL } from '../../config/api';
import { getPanelLoginUrl } from '../../utils/panelUrl';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { wakeBackend } from '../../services/apiWake';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { contentWidth } from '../../utils/responsive';
import { cardShadow } from '../../theme/shadows';
import { keyboardAvoidingBehavior } from '../../utils/webPlatform';

const PRIVACY_URL =
  (Constants.expoConfig?.extra as { privacyPolicyUrl?: string } | undefined)?.privacyPolicyUrl
  ?? 'https://zinapp.com.mx/privacidad/';

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const { login, loginWithGoogle, enterGuestMode } = useAuth();
  const insets = useSafeAreaInsets();
  const { isDesktopWeb } = useResponsiveLayout();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusHint, setStatusHint] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleGoogle = async (idToken: string) => {
    setLoading(true);
    setStatusHint('Verificando con Google…');
    try {
      await wakeBackend(true);
      await loginWithGoogle(idToken);
    } catch (err: unknown) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo iniciar sesión con Google'));
      throw err;
    } finally {
      setLoading(false);
      setStatusHint('');
    }
  };

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      appAlert('Datos incompletos', 'Ingresa usuario y contraseña.');
      return;
    }
    setLoading(true);
    setStatusHint('Conectando con el servidor…');
    try {
      await wakeBackend(true);
      setStatusHint('Verificando credenciales…');
      await login({ username: username.trim(), password });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { code?: string } } };
      if (!axiosErr.response) {
        appAlert(
          'Sin conexión al servidor',
          getApiErrorMessage(
            err,
            'El servidor puede estar despertando. Espera unos segundos e intenta de nuevo.',
          ),
        );
      } else if (axiosErr.response.status === 401) {
        const demoBlocked = axiosErr.response.data?.code === 'demo_disabled';
        appAlert(
          'No se pudo entrar',
          demoBlocked
            ? 'Las cuentas demo ya no están disponibles. Regístrate o contacta soporte.'
            : 'Usuario o contraseña incorrectos. Verifica tus datos o usa «Recuperar contraseña».',
        );
      } else {
        appAlert('Error', getApiErrorMessage(err, 'No se pudo iniciar sesión'));
      }
    } finally {
      setLoading(false);
      setStatusHint('');
    }
  };

  const formCard = (
    <View style={[styles.formWrap, isDesktopWeb && styles.formWrapDesktop, cardShadow]}>
      <FormSection title="Iniciar sesión" variant="plain" align="center">
        <FormField
          hideLabel
          label="Usuario"
          value={username}
          onChangeText={setUsername}
          icon="person-outline"
          placeholder="Usuario"
          required
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
        />
        <FormField
          hideLabel
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          icon="lock-closed-outline"
          placeholder="Contraseña"
          required
          secureTextEntry={!showPassword}
          autoCorrect={false}
          autoComplete="current-password"
          rightElement={
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={8}
              style={styles.passwordToggle}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          }
        />
        <Button
          title="Entrar"
          onPress={handleLogin}
          disabled={loading}
          loading={loading}
          size="lg"
          style={styles.btn}
        />
        <GoogleSignInButton onIdToken={handleGoogle} disabled={loading} />
        <Button
          title="Explorar sin cuenta"
          variant="ghost"
          onPress={enterGuestMode}
          disabled={loading}
          size="lg"
        />
        {loading && statusHint ? (
          <Text style={styles.statusHint}>{statusHint}</Text>
        ) : null}
      </FormSection>

      <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgot}>
        <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('Register')} style={styles.link}>
        <Text style={styles.linkText}>¿No tienes cuenta? </Text>
        <Text style={styles.linkBold}>Regístrate</Text>
      </Pressable>

      {__DEV__ && <Text style={styles.apiHint}>Servidor: {API_URL}</Text>}
      {Platform.OS === 'web' && (
        <Pressable
          onPress={() => {
            if (typeof window !== 'undefined') {
              window.location.assign(getPanelLoginUrl());
            } else {
              void Linking.openURL(getPanelLoginUrl());
            }
          }}
          style={styles.panelLink}
        >
          <Text style={styles.panelText}>¿Administras ZinApp? Panel de operaciones →</Text>
        </Pressable>
      )}
      {Platform.OS === 'web' && (
        <Pressable
          onPress={() => {
            void Linking.openURL(PRIVACY_URL);
          }}
          style={styles.privacyLink}
        >
          <Text style={styles.privacyText}>Política de privacidad</Text>
        </Pressable>
      )}
    </View>
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.desktopRoot}>
        <HeroBackground
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={styles.desktopHero}
        >
          <View style={styles.desktopHeroContent}>
            <BrandLogo variant="light" width={320} showTagline={false} />
            <Text style={styles.subtitle}>Zinapécuaro, Mich.</Text>
            <Text style={styles.desktopTagline}>
              Pedidos y comida local en tu ciudad.
            </Text>
            <View style={styles.heroPills}>
              <View style={styles.pill}>
                <Ionicons name="restaurant" size={14} color="#FFF" />
                <Text style={styles.pillText}>Restaurantes</Text>
              </View>
              <View style={styles.pill}>
                <Ionicons name="bicycle" size={14} color="#FFF" />
                <Text style={styles.pillText}>Reparto local</Text>
              </View>
            </View>
          </View>
        </HeroBackground>
        <ScrollView
          style={styles.desktopFormPane}
          contentContainerStyle={styles.desktopFormScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {formCard}
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={keyboardAvoidingBehavior()}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <HeroBackground
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={[styles.hero, { paddingTop: insets.top + 32 }]}
        >
          <BrandLogo variant="light" width={Math.min(260, contentWidth() - 48)} showTagline={false} />
          <Text style={styles.subtitle}>Zinapécuaro, Mich.</Text>
          <View style={styles.heroPills}>
            <View style={styles.pill}>
              <Ionicons name="restaurant" size={14} color="#FFF" />
              <Text style={styles.pillText}>Restaurantes</Text>
            </View>
            <View style={styles.pill}>
              <Ionicons name="bicycle" size={14} color="#FFF" />
              <Text style={styles.pillText}>Reparto local</Text>
            </View>
          </View>
        </HeroBackground>

        {formCard}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  desktopRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
    minHeight: '100%',
  },
  desktopHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
    paddingVertical: 40,
    minWidth: 320,
  },
  desktopHeroContent: {
    alignItems: 'center',
    gap: 14,
    maxWidth: 400,
    width: '100%',
  },
  desktopTagline: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 26,
    maxWidth: 360,
  },
  desktopFormPane: {
    flex: 1,
    maxWidth: 520,
    backgroundColor: colors.background,
  },
  desktopFormScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 40,
  },
  hero: {
    alignItems: 'center',
    paddingBottom: 48,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
  heroPills: { flexDirection: 'row', gap: 10, marginTop: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    minHeight: 34,
  },
  pillText: { color: '#FFF', fontSize: 12, fontWeight: '600', lineHeight: 16 },
  passwordToggle: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  formWrap: {
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    marginTop: -32,
    borderRadius: 24,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  formWrapDesktop: {
    marginHorizontal: 0,
    marginTop: 0,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  btn: { marginTop: 4 },
  statusHint: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 10,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  forgot: { alignItems: 'center', marginTop: 4 },
  forgotText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  link: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  linkText: { color: colors.textSecondary, fontSize: 15 },
  linkBold: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  apiHint: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 16,
  },
  privacyLink: { alignItems: 'center', marginTop: 14 },
  privacyText: { color: colors.textMuted, fontSize: 12, textDecorationLine: 'underline' },
  panelLink: { alignItems: 'center', marginTop: 16 },
  panelText: { color: colors.primary, fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
