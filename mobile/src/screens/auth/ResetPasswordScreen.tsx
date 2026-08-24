import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { appAlert } from '../../utils/appAlert';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BrandLogo from '../../components/BrandLogo';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import FormSection from '../../components/FormSection';
import KeyboardForm from '../../components/KeyboardForm';
import type { ResetPasswordScreenProps } from '../../navigation/types';
import { authApi } from '../../services/api';
import { wakeBackend } from '../../services/apiWake';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { clearWebResetTokenFromUrl } from '../../utils/webDeepLink';

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export default function ResetPasswordScreen({ navigation, route }: ResetPasswordScreenProps) {
  const insets = useSafeAreaInsets();
  const initialToken = normalizeCode(route.params?.token || '');
  const [code, setCode] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const handleSubmit = async () => {
    if (submittingRef.current) return;

    const token = normalizeCode(code);
    if (!token) {
      appAlert('Código requerido', 'Pega el código de 8 caracteres que recibiste por correo.');
      return;
    }
    if (token.length !== 8) {
      appAlert(
        'Código incompleto',
        `El código tiene 8 caracteres (llevas ${token.length}). Pégalo completo del correo más reciente.`,
      );
      return;
    }
    if (password.length < 6) {
      appAlert('Contraseña', 'Debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      appAlert('Contraseñas', 'Las contraseñas no coinciden.');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      await wakeBackend(true);
      const { data } = await authApi.resetPassword(token, password);
      clearWebResetTokenFromUrl();
      appAlert(
        'Listo',
        typeof data?.detail === 'string' && data.detail.trim()
          ? data.detail
          : 'Contraseña actualizada. Ya puedes iniciar sesión.',
        [{ text: 'Iniciar sesión', onPress: () => navigation.navigate('Login') }],
      );
    } catch (err) {
      appAlert(
        'No se pudo restablecer',
        getApiErrorMessage(
          err,
          'Revisa el código del correo más reciente o solicita uno nuevo. Si acaba de cambiar, prueba iniciar sesión.',
        ),
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <KeyboardForm bottomPadding={insets.bottom + 24} keyboardVerticalOffset={insets.top}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.hero, { paddingTop: insets.top + 28 }]}
      >
        <BrandLogo variant="light" width={200} compact showTagline={false} />
        <Text style={styles.title}>Nueva contraseña</Text>
        <Text style={styles.heroSub}>
          Ingresa el código del correo y elige una contraseña nueva.
        </Text>
      </LinearGradient>

      <View style={[styles.formWrap, cardShadow]}>
        <FormSection title="Seguridad" variant="plain">
          <FormField
            label="Código del correo"
            value={code}
            onChangeText={(v) => setCode(normalizeCode(v))}
            icon="key-outline"
            placeholder="Ej. A3F9K2M7"
            required
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            keyboardType="default"
            hint={`${code.length}/8 · Usa solo el código del correo más reciente (sin espacios).`}
          />
          <FormField
            label="Nueva contraseña"
            value={password}
            onChangeText={setPassword}
            icon="lock-closed-outline"
            placeholder="Mínimo 6 caracteres"
            required
            secureTextEntry={!showPassword}
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
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
          <FormField
            label="Confirmar contraseña"
            value={confirm}
            onChangeText={setConfirm}
            icon="lock-closed-outline"
            required
            secureTextEntry={!showPassword}
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <Button
            title={loading ? 'Guardando…' : 'Restablecer'}
            onPress={handleSubmit}
            disabled={loading || code.length !== 8 || password.length < 6}
            size="lg"
          />
        </FormSection>
        <Button title="Volver" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    </KeyboardForm>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: spacing.xl,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#FFF', marginTop: 12 },
  heroSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  formWrap: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginTop: -24,
    borderRadius: 24,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
});
