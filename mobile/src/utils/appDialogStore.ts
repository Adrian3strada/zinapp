import type { AppDialogButton } from './appAlert';

/** Espera a que termine la animación del modal antes de devolver el control a la pantalla. */
export const APP_DIALOG_CLOSE_MS = 360;

const callbacks = new Map<string, () => void>();
let seq = 0;

export type PendingDialogButton = {
  text: string;
  style?: AppDialogButton['style'];
};

export type PendingDialog = {
  dialogKey: string;
  title: string;
  message: string;
  buttons: PendingDialogButton[];
  cancelable: boolean;
};

const queue: PendingDialog[] = [];
let showing = false;

function storeCallbacks(dialogKey: string, buttons: AppDialogButton[]) {
  buttons.forEach((btn, index) => {
    if (btn.onPress) {
      callbacks.set(`${dialogKey}:${index}`, btn.onPress);
    }
  });
}

function clearCallbacks(dialogKey: string) {
  for (const key of [...callbacks.keys()]) {
    if (key.startsWith(`${dialogKey}:`)) {
      callbacks.delete(key);
    }
  }
}

export function runDialogCallback(dialogKey: string, index: number): void {
  const fn = callbacks.get(`${dialogKey}:${index}`);
  clearCallbacks(dialogKey);
  fn?.();
}

export function dismissDialogCallbacks(dialogKey: string): void {
  clearCallbacks(dialogKey);
}

export function markDialogClosed(): void {
  showing = false;
  const next = queue.shift();
  if (next) {
    setTimeout(() => {
      showing = true;
      navigateToDialog(next);
    }, APP_DIALOG_CLOSE_MS);
  }
}

/** Cierra el modal, espera la animación y luego ejecuta la acción del botón. */
export function finishDialogAction(
  dialogKey: string,
  buttonIndex: number | null,
  closeModal: () => void,
): void {
  closeModal();
  setTimeout(() => {
    markDialogClosed();
    if (buttonIndex == null) {
      dismissDialogCallbacks(dialogKey);
      return;
    }
    runDialogCallback(dialogKey, buttonIndex);
  }, APP_DIALOG_CLOSE_MS);
}

type NavigateFn = (dialog: PendingDialog) => void;
let navigateToDialog: NavigateFn = () => {};

export function registerDialogNavigator(fn: NavigateFn): void {
  navigateToDialog = fn;
}

export function enqueueAppDialog(
  title: string,
  message: string | undefined,
  buttons: AppDialogButton[],
  cancelable = true,
): PendingDialog {
  const dialogKey = `dlg-${++seq}`;
  const normalized = buttons.length ? buttons : [{ text: 'OK', style: 'default' as const }];
  storeCallbacks(dialogKey, normalized);

  const pending: PendingDialog = {
    dialogKey,
    title,
    message: message ?? '',
    buttons: normalized.map((b) => ({ text: b.text, style: b.style })),
    cancelable,
  };

  if (showing) {
    queue.push(pending);
    return pending;
  }

  showing = true;
  navigateToDialog(pending);
  return pending;
}
