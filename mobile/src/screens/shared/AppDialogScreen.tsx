import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { closeAppDialog } from '../../navigation/navigationRef';
import type { RootStackParamList } from '../../navigation/types';
import type { AppDialogButtonStyle } from '../../utils/appAlert';
import {
  dismissDialogCallbacks,
  finishDialogAction,
  markDialogClosed,
} from '../../utils/appDialogStore';
import { colors } from '../../theme/colors';
import { elevatedShadow } from '../../theme/shadows';
import { spacing } from '../../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'AppDialog'>;

function buttonVariant(style: AppDialogButtonStyle | undefined): 'primary' | 'secondary' | 'danger' {
  if (style === 'destructive') return 'danger';
  if (style === 'cancel') return 'secondary';
  return 'primary';
}

export default function AppDialogScreen({ route, navigation }: Props) {
  const { dialogKey, title, message, buttons, cancelable = true } = route.params;
  const horizontal = buttons.length === 2;
  const closingRef = useRef(false);
  const closedProperlyRef = useRef(false);
  const [isClosing, setIsClosing] = useState(false);

  const closeModal = useCallback(() => {
    closeAppDialog();
  }, []);

  const beginClose = useCallback(() => {
    if (closingRef.current) return false;
    closingRef.current = true;
    closedProperlyRef.current = true;
    setIsClosing(true);
    return true;
  }, []);

  const closeWith = useCallback(
    (index: number) => {
      if (!beginClose()) return;
      finishDialogAction(dialogKey, index, closeModal);
    },
    [beginClose, closeModal, dialogKey],
  );

  const closeDismiss = useCallback(() => {
    if (!beginClose()) return;
    finishDialogAction(dialogKey, null, closeModal);
  }, [beginClose, closeModal, dialogKey]);

  const onBackdrop = useCallback(() => {
    if (!cancelable || isClosing) return;
    const cancelIndex = buttons.findIndex((b) => b.style === 'cancel');
    if (cancelIndex >= 0) {
      closeWith(cancelIndex);
    } else {
      closeDismiss();
    }
  }, [buttons, cancelable, closeDismiss, closeWith, isClosing]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', () => {
      if (closedProperlyRef.current) return;
      closedProperlyRef.current = true;
      markDialogClosed();
      dismissDialogCallbacks(dialogKey);
    });
    return unsub;
  }, [dialogKey, navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isClosing) return true;
      onBackdrop();
      return true;
    });
    return () => sub.remove();
  }, [isClosing, onBackdrop]);

  return (
    <View style={styles.root} pointerEvents={isClosing ? 'none' : 'auto'}>
      <Pressable style={styles.backdrop} onPress={onBackdrop} accessibilityLabel="Cerrar diálogo" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={[styles.card, elevatedShadow]}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={[styles.actions, horizontal && styles.actionsRow]}>
            {buttons.map((btn, index) => {
              const variant = buttonVariant(btn.style);
              return (
                <Pressable
                  key={`${btn.text}-${index}`}
                  disabled={isClosing}
                  onPress={() => closeWith(index)}
                  style={({ pressed }) => [
                    styles.btn,
                    horizontal && styles.btnCompact,
                    variant === 'primary' && styles.btnPrimary,
                    variant === 'secondary' && styles.btnSecondary,
                    variant === 'danger' && styles.btnDanger,
                    pressed && !isClosing && styles.btnPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.btnText,
                      variant === 'primary' && styles.btnTextPrimary,
                      variant === 'secondary' && styles.btnTextSecondary,
                      variant === 'danger' && styles.btnTextDanger,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  center: {
    width: '100%',
    maxWidth: 360,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  btn: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  btnCompact: {
    flex: 1,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  btnDanger: {
    backgroundColor: colors.error,
  },
  btnPressed: {
    opacity: 0.88,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  btnTextPrimary: {
    color: '#FFF',
  },
  btnTextSecondary: {
    color: colors.textSecondary,
  },
  btnTextDanger: {
    color: '#FFF',
  },
});
