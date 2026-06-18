import { Alert } from 'react-native';

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

/** Diálogos nativos — fiables en Expo Go y APK (sin Modal bloqueado). */
export function appAlert(
  title: string,
  message?: string,
  buttons?: AppDialogButton[],
): void {
  const normalized: AppDialogButton[] = buttons?.length
    ? buttons
    : [{ text: 'OK', style: 'default' }];

  Alert.alert(title, message ?? '', mapAlertButtons(normalized), { cancelable: true });
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
