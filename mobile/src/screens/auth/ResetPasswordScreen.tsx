import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { appAlert } from '../../utils/appAlert';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BrandLogo from '../../components/BrandLogo';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import FormSection from '../../components/FormSection';
import type { ResetPasswordScreenProps } from '../../navigation/types';
import { authApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { clearWebResetTokenFromUrl } from '../../utils/webDeepLink';

export default function ResetPasswordScreen({ navigation, route }: ResetPasswordScreenProps) {
  const insets = useSafeAreaInsets();
  const normalizeCode = (value: string) =>
    value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const initialToken = normalizeCode(route.params?.token || '');
  const [code, setCode] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const token = normalizeCode(code);
    if (!token) {
      appAlert('Código requerido', 'Pega el código de 8 caracteres que recibiste por correo.');
      return;
    }
    if (token.length !== 8) {
      appAlert('Código incompleto', 'El código del correo tiene 8 caracteres. Pégalo completo.');
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
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      clearWebResetTokenFromUrl();
      appAlert('Listo', 'Contraseña actualizada.', [
        { text: 'Iniciar sesión', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      appAlert(
        'Error',
        getApiErrorMessage(
          err,
          'Código inválido o ya usado. Solicita uno nuevo y usa el correo más reciente.',
        ),
      );
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
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
              autoCapitalize="characters"
              autoCorrect={false}
              hint="8 caracteres del correo más reciente. Si falló, solicita un código nuevo."
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
            />
            <Button
              title={loading ? 'Guardando…' : 'Restablecer'}
              onPress={handleSubmit}
              disabled={loading}
              size="lg"
            />
          </FormSection>
          <Button title="Volver" variant="ghost" onPress={() => navigation.goBack()} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
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
    marginHorizontal: 20,
    marginTop: -24,
    borderRadius: 24,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
});
