import type { AppDialogButton } from '../context/AppDialogContext';

type DialogBridge = (
  config: { title: string; message: string; buttons?: AppDialogButton[] },
) => void;

let bridge: DialogBridge | null = null;

export function registerAppAlert(show: DialogBridge): void {
  bridge = show;
}

/** Sustituto de Alert.alert con modal inferior nativo de la app. */
export function appAlert(
  title: string,
  message?: string,
  buttons?: AppDialogButton[],
): void {
  if (!bridge) {
    console.warn('[appAlert]', title, message);
    return;
  }
  bridge({
    title,
    message: message ?? '',
    buttons,
  });
}
