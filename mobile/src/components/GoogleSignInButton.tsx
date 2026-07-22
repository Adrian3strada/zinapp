import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { appAlert } from '../utils/appAlert';
import {
  extractGoogleIdToken,
  isGoogleSignInConfigured,
  useGoogleIdTokenRequest,
} from '../utils/googleAuth';

interface Props {
  onIdToken: (idToken: string) => Promise<void>;
  disabled?: boolean;
  label?: string;
}

export default function GoogleSignInButton({
  onIdToken,
  disabled,
  label = 'Continuar con Google',
}: Props) {
  const [busy, setBusy] = useState(false);
  const handledRef = useRef<string | null>(null);
  const [request, response, promptAsync] = useGoogleIdTokenRequest();

  useEffect(() => {
    if (!response || response.type !== 'success') {
      if (response?.type === 'error') {
        appAlert('Google', 'No se pudo completar el inicio con Google.');
        setBusy(false);
      } else if (response?.type === 'dismiss' || response?.type === 'cancel') {
        setBusy(false);
      }
      return;
    }

    const idToken = extractGoogleIdToken(response);
    if (!idToken) {
      appAlert('Google', 'No se recibió el token de Google. Intenta de nuevo.');
      setBusy(false);
      return;
    }
    if (handledRef.current === idToken) return;
    handledRef.current = idToken;

    (async () => {
      try {
        await onIdToken(idToken);
      } catch {
        // El caller muestra el error.
      } finally {
        setBusy(false);
      }
    })();
  }, [onIdToken, response]);

  if (!isGoogleSignInConfigured()) {
    return null;
  }

  const handlePress = async () => {
    if (disabled || busy || !request) return;
    setBusy(true);
    handledRef.current = null;
    try {
      await promptAsync();
    } catch {
      setBusy(false);
      appAlert('Google', 'No se pudo abrir el inicio con Google.');
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.dividerRow}>
        <View style={styles.line} />
        <Text style={styles.or}>o</Text>
        <View style={styles.line} />
      </View>
      <Pressable
        style={[styles.btn, (disabled || busy || !request) && styles.btnDisabled]}
        onPress={handlePress}
        disabled={disabled || busy || !request}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {busy ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <Ionicons name="logo-google" size={20} color="#EA4335" />
            <Text style={styles.btnText}>{label}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: spacing.sm },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  line: { flex: 1, height: 1, backgroundColor: colors.borderLight },
  or: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { fontSize: 15, fontWeight: '700', color: colors.text },
});
