import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { appAlert } from '../../utils/appAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BrandLogo from '../../components/BrandLogo';
import Button from '../../components/Button';
import ContactWhatsAppButton from '../../components/ContactWhatsAppButton';
import FormField from '../../components/FormField';
import FormSection from '../../components/FormSection';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { ForgotPasswordScreenProps } from '../../navigation/types';
import { authApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { formatWhatsAppDisplay, passwordResetWhatsAppMessage } from '../../utils/supportContact';

export default function ForgotPasswordScreen({ navigation }: ForgotPasswordScreenProps) {
  const insets = useSafeAreaInsets();
  const { config, loading: configLoading } = useAppConfig();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const supportPhone = config.support_whatsapp?.trim();
  const showWhatsAppHelp = !__DEV__ && config.password_reset_via_whatsapp && Boolean(supportPhone);

  const handleSubmit = async () => {
    const user = username.trim().toLowerCase();
    if (!user) {
      appAlert('Usuario requerido', 'Ingresa tu nombre de usuario.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authApi.forgotPassword(user);
      if (data.reset_token) {
        navigation.navigate('ResetPassword', { token: data.reset_token });
        return;
      }
      setSubmitted(true);
      if (!showWhatsAppHelp) {
        appAlert('Solicitud recibida', data.detail);
      }
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo procesar la solicitud.'));
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
          <Text style={styles.title}>Recuperar contraseña</Text>
          <Text style={styles.heroSub}>
            {__DEV__
              ? 'En desarrollo recibirás un token para continuar.'
              : showWhatsAppHelp
                ? 'Te ayudamos por WhatsApp o correo.'
                : 'Te enviaremos instrucciones si tenemos tu correo.'}
          </Text>
        </LinearGradient>

        <View style={[styles.formWrap, cardShadow]}>
        <Text style={styles.subtitle}>
          {__DEV__
            ? 'Ingresa tu usuario para obtener el token de restablecimiento.'
            : showWhatsAppHelp
              ? `Confirma tu usuario${supportPhone ? ` — soporte al ${formatWhatsAppDisplay(supportPhone)}` : ''}.`
              : 'Ingresa el mismo usuario con el que inicias sesión.'}
        </Text>

        <FormSection title="Tu cuenta" variant="plain">
          <FormField
            label="Usuario"
            value={username}
            onChangeText={setUsername}
            icon="person-outline"
            placeholder="El mismo con el que inicias sesión"
            required
            autoCapitalize="none"
            autoCorrect={false}
            hint={__DEV__ ? 'En desarrollo recibirás un token para continuar.' : undefined}
          />
          {!submitted && (
            <Button
              title={loading ? 'Enviando…' : showWhatsAppHelp ? 'Continuar' : 'Solicitar ayuda'}
              onPress={handleSubmit}
              disabled={loading || configLoading}
              size="lg"
            />
          )}
        </FormSection>

        {submitted && showWhatsAppHelp && supportPhone && (
          <View style={styles.whatsAppBlock}>
            <Text style={styles.whatsAppHint}>
              Toca el botón para escribirnos por WhatsApp con tu usuario. Te respondemos lo antes posible.
            </Text>
            <ContactWhatsAppButton
              phone={supportPhone}
              message={passwordResetWhatsAppMessage(username.trim().toLowerCase())}
              label="Abrir WhatsApp con soporte"
            />
          </View>
        )}

        <Button title="Volver al login" variant="ghost" onPress={() => navigation.goBack()} />
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
  heroEmoji: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: -0.3, marginTop: 12 },
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
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 4, lineHeight: 20 },
  whatsAppBlock: { gap: 12, marginBottom: 8, marginTop: 8 },
  whatsAppHint: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
});
