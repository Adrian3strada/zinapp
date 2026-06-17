import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
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
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import FormSection from '../../components/FormSection';
import { useAuth } from '../../context/AuthContext';
import type { LoginScreenProps } from '../../navigation/types';
import { API_URL } from '../../config/api';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { colors } from '../../theme/colors';
import { contentWidth } from '../../utils/responsive';
import { cardShadow } from '../../theme/shadows';

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      appAlert('Datos incompletos', 'Ingresa usuario y contraseña.');
      return;
    }
    setLoading(true);
    try {
      await login({ username: username.trim(), password });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (!axiosErr.response) {
        appAlert(
          'Sin conexión al servidor',
          getApiErrorMessage(err, `No se pudo llegar a:\n${API_URL}`),
        );
      } else if (axiosErr.response.status === 401) {
        appAlert(
          'No se pudo entrar',
          __DEV__
            ? 'Usuario o contraseña incorrectos.\n\nPrueba demo:\nusuario: cliente1\ncontraseña: test1234'
            : 'Usuario o contraseña incorrectos. Verifica tus datos o usa «Recuperar contraseña».',
        );
      } else {
        appAlert('Error', getApiErrorMessage(err, 'No se pudo iniciar sesión'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={[styles.hero, { paddingTop: insets.top + 32 }]}
        >
          <BrandLogo width={Math.min(280, contentWidth())} />
          <Text style={styles.subtitle}>Delivery y servicios en Zinapécuaro</Text>
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
        </LinearGradient>

        <View style={[styles.formWrap, cardShadow]}>
          <FormSection title="Iniciar sesión" hint="Usa tu usuario y contraseña de ZinApp.">
            <FormField
              label="Usuario"
              value={username}
              onChangeText={setUsername}
              icon="person-outline"
              placeholder="ej. cliente1"
              required
              autoCapitalize="none"
              autoCorrect={false}
            />
            <FormField
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              icon="lock-closed-outline"
              required
              secureTextEntry={!showPassword}
              autoCorrect={false}
              rightElement={
                <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
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
          </FormSection>

          <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgot}>
            <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
          </Pressable>

          <Pressable onPress={() => navigation.navigate('Register')} style={styles.link}>
            <Text style={styles.linkText}>¿No tienes cuenta? </Text>
            <Text style={styles.linkBold}>Regístrate</Text>
          </Pressable>

          {__DEV__ && <Text style={styles.apiHint}>Servidor: {API_URL}</Text>}
          {__DEV__ && (
            <Text style={styles.demoHint}>
              Demo: cliente1 / test1234 · repartidor1 · rest_pizzas
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  hero: {
    alignItems: 'center',
    paddingBottom: 48,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 10, fontWeight: '500' },
  heroPills: { flexDirection: 'row', gap: 10, marginTop: 16 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pillText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  formWrap: {
    backgroundColor: colors.background,
    marginHorizontal: 20,
    marginTop: -28,
  },
  btn: { marginTop: 4 },
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
  demoHint: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },
});
