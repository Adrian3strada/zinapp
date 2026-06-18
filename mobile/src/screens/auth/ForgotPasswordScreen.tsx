import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../utils/appAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import ContactWhatsAppButton from '../../components/ContactWhatsAppButton';
import FormField from '../../components/FormField';
import FormSection from '../../components/FormSection';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { ForgotPasswordScreenProps } from '../../navigation/types';
import { authApi } from '../../services/api';
import { colors } from '../../theme/colors';
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
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Recuperar contraseña</Text>
        <Text style={styles.subtitle}>
          {__DEV__
            ? 'En desarrollo recibirás un token para continuar en la siguiente pantalla.'
            : showWhatsAppHelp
              ? `Confirma tu usuario y te ayudamos por WhatsApp${supportPhone ? ` al ${formatWhatsAppDisplay(supportPhone)}` : ''}.`
              : 'Ingresa tu usuario. Si tenemos tu correo registrado, te enviaremos instrucciones.'}
        </Text>

        <FormSection title="Tu cuenta">
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: 24 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: 8, lineHeight: 22 },
  whatsAppBlock: { gap: 12, marginBottom: 8 },
  whatsAppHint: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
});
