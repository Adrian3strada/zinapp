import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BrandLogo from '../../components/BrandLogo';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import FormSection from '../../components/FormSection';
import { useAuth } from '../../context/AuthContext';
import type { LoginScreenProps } from '../../navigation/types';
import { API_URL } from '../../config/api';
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
      Alert.alert('Datos incompletos', 'Ingresa usuario y contraseña.');
      return;
    }
    setLoading(true);
    try {
      await login({ username: username.trim().toLowerCase(), password });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (!axiosErr.response) {
        Alert.alert(
          'Sin conexión al servidor',
          `No se pudo llegar a:\n${API_URL}\n\n` +
            '1. Arranca el backend:\n   python manage.py runserver\n\n' +
            '2. PC y teléfono en la misma Wi‑Fi\n\n' +
            '3. Revisa extra.apiUrl en mobile/app.json',
        );
      } else {
        Alert.alert('Error', 'Usuario o contraseña incorrectos');
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

          <Text style={styles.apiHint}>Servidor: {API_URL}</Text>
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
});
