import { CommonActions, StackActions } from '@react-navigation/native';
import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './types';
import type { PendingDialog } from '../utils/appDialogStore';
import { failOpenDialog } from '../utils/appDialogStore';
import { setPendingNavigation } from './pendingNavigation';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const NAV_RETRY_MS = 250;
const NAV_MAX_ATTEMPTS = 20;

/** Espera a que el contenedor de navegación esté listo (p. ej. app abierta desde push). */
export function navigateWhenReady(action: () => void, onFailure?: () => void): void {
  const attempt = (n: number) => {
    if (navigationRef.isReady()) {
      action();
      return;
    }
    if (n < NAV_MAX_ATTEMPTS) {
      setTimeout(() => attempt(n + 1), NAV_RETRY_MS);
    } else {
      onFailure?.();
    }
  };
  attempt(0);
}

function appDialogParams(dialog: PendingDialog) {
  return {
    dialogKey: dialog.dialogKey,
    title: dialog.title,
    message: dialog.message,
    buttons: dialog.buttons,
    cancelable: dialog.cancelable,
  };
}

export function openAppDialog(dialog: PendingDialog): void {
  navigateWhenReady(
    () => {
      const state = navigationRef.getRootState();
      const current = state.routes[state.index];
      const params = appDialogParams(dialog);

      if (current?.name === 'AppDialog') {
        navigationRef.dispatch(StackActions.replace('AppDialog', params));
        return;
      }

      navigationRef.navigate('AppDialog', params);
    },
    () => failOpenDialog(dialog),
  );
}

export function closeAppDialog(): void {
  navigateWhenReady(() => {
    const state = navigationRef.getRootState();
    const current = state.routes[state.index];
    if (current?.name === 'AppDialog') {
      navigationRef.dispatch(StackActions.pop());
    }
  });
}

export function navigateToOrder(orderId: number) {
  setPendingNavigation({ type: 'order', orderId });
  navigateWhenReady(() => {
    navigationRef.dispatch(
      CommonActions.navigate({
        name: 'Main',
      }),
    );
  });
}

export function navigateToShipment(shipmentId: number) {
  setPendingNavigation({ type: 'shipment', shipmentId });
  navigateWhenReady(() => {
    navigationRef.dispatch(
      CommonActions.navigate({
        name: 'Main',
      }),
    );
  });
}

export function navigateToMenu(restaurantId: number, restaurantName = 'Restaurante') {
  setPendingNavigation({ type: 'menu', restaurantId, restaurantName });
  navigateWhenReady(() => {
    navigationRef.dispatch(
      CommonActions.navigate({
        name: 'Main',
      }),
    );
  });
}

export function handleNotificationNavigation(data: Record<string, unknown> | undefined) {
  if (!data) return;

  if (data.type === 'restaurant_open') {
    const restaurantId = parseId(data.restaurantId);
    if (restaurantId != null) {
      const name = typeof data.restaurantName === 'string' ? data.restaurantName : 'Restaurante';
      navigateToMenu(restaurantId, name);
      return;
    }
  }

  const orderId = parseId(data.orderId);
  const shipmentId = parseId(data.shipmentId);

  if (orderId != null) {
    navigateToOrder(orderId);
    return;
  }
  if (shipmentId != null) {
    navigateToShipment(shipmentId);
  }
}

function parseId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
