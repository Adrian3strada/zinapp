import { Alert } from 'react-native';

import { enqueueAppDialog } from './appDialogStore';

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

/** Confirmaciones — diálogo nativo (estable al cancelar pedidos/envíos). */
export function appConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel = 'Confirmar',
): void {
  Alert.alert(title, message, [
    { text: 'No', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
