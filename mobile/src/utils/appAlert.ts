import { Alert, Platform } from 'react-native';

import { enqueueAppDialog } from './appDialogStore';

function preferNativeDialog(): boolean {
  return Platform.OS !== 'web';
}

export type AppDialogButtonStyle = 'default' | 'cancel' | 'destructive';

export type AppDialogButton = {
  text: string;
  onPress?: () => void;
  style?: AppDialogButtonStyle;
};

function mapAlertButtons(buttons: AppDialogButton[]) {
  return buttons.map((btn) => ({
    text: btn.text,
    style:
      btn.style === 'destructive'
        ? ('destructive' as const)
        : btn.style === 'cancel'
          ? ('cancel' as const)
          : ('default' as const),
    onPress: btn.onPress,
  }));
}

function showNativeAlert(
  title: string,
  message: string | undefined,
  buttons: AppDialogButton[],
): void {
  Alert.alert(title, message ?? '', mapAlertButtons(buttons), { cancelable: true });
}

let useNavigationDialog = true;

/** Avisos informativos (modal ZinApp con fallback nativo). */
export function appAlert(
  title: string,
  message?: string,
  buttons?: AppDialogButton[],
): void {
  const normalized: AppDialogButton[] = buttons?.length
    ? buttons
    : [{ text: 'OK', style: 'default' }];

  if (preferNativeDialog()) {
    showNativeAlert(title, message, normalized);
    return;
  }

  if (useNavigationDialog) {
    try {
      enqueueAppDialog(title, message, normalized, true);
      return;
    } catch {
      useNavigationDialog = false;
    }
  }

  showNativeAlert(title, message, normalized);
}

/** Confirmaciones (mismo modal que appAlert; Alert nativo no funciona en web). */
export function appConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel = 'Confirmar',
): void {
  const buttons: AppDialogButton[] = [
    { text: 'No', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ];

  if (preferNativeDialog()) {
    showNativeAlert(title, message, buttons);
    return;
  }

  if (useNavigationDialog) {
    try {
      enqueueAppDialog(title, message, buttons, true);
      return;
    } catch {
      useNavigationDialog = false;
    }
  }

  showNativeAlert(title, message, buttons);
}
