import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import FormField from '../../components/FormField';
import FormSection from '../../components/FormSection';
import type { ResetPasswordScreenProps } from '../../navigation/types';
import { authApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { getApiErrorMessage } from '../../utils/apiErrors';

export default function ResetPasswordScreen({ navigation, route }: ResetPasswordScreenProps) {
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 6) {
      Alert.alert('Contraseña', 'Debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Contraseñas', 'Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(route.params.token, password);
      Alert.alert('Listo', 'Contraseña actualizada.', [
        { text: 'Iniciar sesión', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'Token inválido o expirado.'));
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
        <Text style={styles.title}>Nueva contraseña</Text>
        <Text style={styles.subtitle}>Elige una contraseña segura para tu cuenta.</Text>

        <FormSection title="Seguridad">
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
          <Button title={loading ? 'Guardando…' : 'Restablecer'} onPress={handleSubmit} disabled={loading} size="lg" />
        </FormSection>
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
