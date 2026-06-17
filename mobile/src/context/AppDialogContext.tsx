import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../components/Button';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export type AppDialogButtonStyle = 'default' | 'cancel' | 'destructive';

export type AppDialogButton = {
  text: string;
  onPress?: () => void;
  style?: AppDialogButtonStyle;
};

export type AppDialogConfig = {
  title: string;
  message: string;
  buttons: AppDialogButton[];
};

type ShowDialogFn = (config: Omit<AppDialogConfig, 'buttons'> & { buttons?: AppDialogButton[] }) => void;

const AppDialogContext = createContext<ShowDialogFn | null>(null);

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AppDialogConfig | null>(null);
  const pendingRef = useRef<AppDialogConfig | null>(null);

  const close = useCallback(() => {
    setVisible(false);
    setConfig(null);
  }, []);

  const showDialog = useCallback<ShowDialogFn>((next) => {
    const normalized: AppDialogConfig = {
      title: next.title,
      message: next.message,
      buttons: next.buttons?.length
        ? next.buttons
        : [{ text: 'OK', style: 'default' }],
    };
    pendingRef.current = normalized;
    setConfig(normalized);
    setVisible(true);
  }, []);

  const handlePress = useCallback(
    (button: AppDialogButton) => {
      close();
      button.onPress?.();
    },
    [close],
  );

  const value = useMemo(() => showDialog, [showDialog]);

  const buttons = config?.buttons ?? [];
  const primaryButtons = buttons.filter((b) => b.style !== 'cancel');
  const cancelButtons = buttons.filter((b) => b.style === 'cancel');

  return (
    <AppDialogContext.Provider value={value}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={close}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Cerrar" />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            {config ? (
              <>
                <View style={styles.handle} />
                <Text style={styles.title}>{config.title}</Text>
                {config.message ? (
                  <Text style={styles.message}>{config.message}</Text>
                ) : null}
                <View style={styles.actions}>
                  {cancelButtons.map((button) => (
                    <Button
                      key={`cancel-${button.text}`}
                      title={button.text}
                      variant="secondary"
                      onPress={() => handlePress(button)}
                      style={styles.actionBtn}
                    />
                  ))}
                  {primaryButtons.map((button) => (
                    <Button
                      key={button.text}
                      title={button.text}
                      variant={button.style === 'destructive' ? 'danger' : 'primary'}
                      onPress={() => handlePress(button)}
                      style={styles.actionBtn}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </AppDialogContext.Provider>
  );
}

export function useAppDialog(): ShowDialogFn {
  const ctx = useContext(AppDialogContext);
  if (!ctx) {
    throw new Error('useAppDialog debe usarse dentro de AppDialogProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionBtn: {
    flexGrow: 1,
    minWidth: 120,
  },
});
