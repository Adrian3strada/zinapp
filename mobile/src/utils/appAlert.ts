import { Alert } from 'react-native';

import { enqueueAppDialog } from './appDialogStore';

export type AppDialogButtonStyle = 'default' | 'cancel' | 'destructive';

export type AppDialogButton = {
  text: string;
  onPress?: () => void;
  style?: AppDialogButtonStyle;
};

type ShowDialogHandler = ((request: {
  title: string;
  message?: string;
  buttons: AppDialogButton[];
  cancelable?: boolean;
}) => void) | null;

let showDialogHandler: ShowDialogHandler = null;

/** @deprecated Usa enqueueAppDialog vía appAlert */
export function registerAppDialogHandler(handler: ShowDialogHandler): void {
  showDialogHandler = handler;
}

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

/** Diálogos ZinApp (pantalla modal de navegación). Fallback nativo si falla. */
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

/** Atajo para confirmaciones destructivas. */
export function appConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel = 'Confirmar',
): void {
  appAlert(title, message, [
    { text: 'No', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
