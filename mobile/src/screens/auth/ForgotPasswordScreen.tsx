import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import FormField from '../../components/FormField';
import FormSection from '../../components/FormSection';
import type { ForgotPasswordScreenProps } from '../../navigation/types';
import { authApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { getApiErrorMessage } from '../../utils/apiErrors';

export default function ForgotPasswordScreen({ navigation }: ForgotPasswordScreenProps) {
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const user = username.trim().toLowerCase();
    if (!user) {
      Alert.alert('Usuario requerido', 'Ingresa tu nombre de usuario.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authApi.forgotPassword(user);
      if (data.reset_token) {
        navigation.navigate('ResetPassword', { token: data.reset_token });
        return;
      }
      Alert.alert('Listo', data.detail);
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'No se pudo procesar la solicitud.'));
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
          Te enviaremos un enlace o token para restablecer tu acceso.
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
            hint="En desarrollo recibirás un token para continuar."
          />
          <Button title={loading ? 'Enviando…' : 'Continuar'} onPress={handleSubmit} disabled={loading} size="lg" />
        </FormSection>

        <Button title="Volver al login" variant="ghost" onPress={() => navigation.goBack()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: 24 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginVertical: 12, lineHeight: 20 },
});
