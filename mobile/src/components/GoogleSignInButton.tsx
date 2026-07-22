import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { appAlert } from '../utils/appAlert';
import {
  consumeGoogleWebRedirect,
  extractGoogleIdToken,
  isGoogleSignInConfigured,
  startGoogleWebRedirect,
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
  const webReturnHandled = useRef(false);
  const [request, response, promptAsync] = useGoogleIdTokenRequest();

  useEffect(() => {
    if (Platform.OS !== 'web' || webReturnHandled.current) return;
    const result = consumeGoogleWebRedirect();
    if (!result) return;
    webReturnHandled.current = true;

    if (result.type === 'error') {
      appAlert('Google', result.message);
      return;
    }
    if (handledRef.current === result.idToken) return;
    handledRef.current = result.idToken;
    setBusy(true);
    (async () => {
      try {
        await onIdToken(result.idToken);
      } catch {
        // El caller muestra el error.
      } finally {
        setBusy(false);
      }
    })();
  }, [onIdToken]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
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
      if (Platform.OS === 'web') {
        startGoogleWebRedirect(request);
        return;
      }
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
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { fontSize: 15, fontWeight: '700', color: colors.text, letterSpacing: -0.1 },
});
