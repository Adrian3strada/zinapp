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
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [viaWhatsApp, setViaWhatsApp] = useState(false);

  const supportPhone = config.support_whatsapp?.trim();
  const configWhatsAppHelp = !__DEV__ && config.password_reset_via_whatsapp && Boolean(supportPhone);
  const showWhatsAppHelp = viaWhatsApp || configWhatsAppHelp;

  const handleSubmit = async () => {
    const value = identifier.trim().toLowerCase();
    if (!value) {
      appAlert('Dato requerido', 'Ingresa tu usuario o correo.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authApi.forgotPassword(value);
      if (data.reset_token) {
        navigation.navigate('ResetPassword', { token: data.reset_token });
        return;
      }
      setViaWhatsApp(Boolean(data.password_reset_via_whatsapp) || configWhatsAppHelp);
      setSubmitted(true);
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
              ? 'En desarrollo puedes recibir el código al instante.'
              : showWhatsAppHelp && !submitted
                ? 'Te enviamos un código por correo si tu cuenta lo tiene; si no, WhatsApp.'
                : 'Te enviaremos un código a tu correo registrado.'}
          </Text>
        </LinearGradient>

        <View style={[styles.formWrap, cardShadow]}>
          {!submitted ? (
            <>
              <Text style={styles.subtitle}>
                {__DEV__
                  ? 'Ingresa tu usuario o correo para obtener el código.'
                  : showWhatsAppHelp
                    ? `Confirma tu usuario o correo${supportPhone ? ` — soporte al ${formatWhatsAppDisplay(supportPhone)}` : ''}.`
                    : 'Usa el mismo usuario o el correo con el que te registraste.'}
              </Text>

              <FormSection title="Tu cuenta" variant="plain">
                <FormField
                  label="Usuario o correo"
                  value={identifier}
                  onChangeText={setIdentifier}
                  icon="person-outline"
                  placeholder="usuario o nombre@correo.com"
                  required
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  hint={__DEV__ ? 'En desarrollo puedes recibir el código al instante.' : undefined}
                />
                <Button
                  title={loading ? 'Enviando…' : 'Enviar código'}
                  onPress={handleSubmit}
                  disabled={loading || configLoading}
                  size="lg"
                />
              </FormSection>
            </>
          ) : (
            <View style={styles.successBlock}>
              <Text style={styles.successTitle}>Revisa tu correo</Text>
              <Text style={styles.successBody}>
                Si la cuenta existe y tiene correo, te enviamos un código válido por 2 horas.
                Ábrelo y continúa con el botón de abajo.
              </Text>
              <Button
                title="Ya tengo el código"
                onPress={() => navigation.navigate('ResetPassword', {})}
                size="lg"
              />
              {showWhatsAppHelp && supportPhone ? (
                <View style={styles.whatsAppBlock}>
                  <Text style={styles.whatsAppHint}>
                    ¿Sin correo en la cuenta o no llegó el mensaje? Escríbenos por WhatsApp.
                  </Text>
                  <ContactWhatsAppButton
                    phone={supportPhone}
                    message={passwordResetWhatsAppMessage(identifier.trim().toLowerCase())}
                    label="Abrir WhatsApp con soporte"
                  />
                </View>
              ) : null}
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
  successBlock: { gap: 12, marginBottom: 8 },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  successBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  whatsAppBlock: { gap: 12, marginBottom: 8, marginTop: 8 },
  whatsAppHint: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
});
