import { CommonActions } from '@react-navigation/native';
import { createNavigationContainerRef } from '@react-navigation/native';

type RootParams = {
  OrderDetail: { orderId: number };
  ShipmentDetail: { shipmentId: number };
  Menu: { restaurantId: number; restaurantName: string };
};

export const navigationRef = createNavigationContainerRef<RootParams>();

export function navigateToOrder(orderId: number) {
  if (!navigationRef.isReady()) return;
  navigationRef.dispatch(
    CommonActions.navigate({
      name: 'OrderDetail',
      params: { orderId },
    }),
  );
}

export function navigateToShipment(shipmentId: number) {
  if (!navigationRef.isReady()) return;
  navigationRef.dispatch(
    CommonActions.navigate({
      name: 'ShipmentDetail',
      params: { shipmentId },
    }),
  );
}

export function navigateToMenu(restaurantId: number, restaurantName = 'Restaurante') {
  if (!navigationRef.isReady()) return;
  navigationRef.dispatch(
    CommonActions.navigate({
      name: 'Menu',
      params: { restaurantId, restaurantName },
    }),
  );
}

export function handleNotificationNavigation(data: Record<string, unknown> | undefined) {
  if (data?.type === 'restaurant_open') {
    const restaurantId = parseId(data.restaurantId);
    if (restaurantId != null) {
      const name = typeof data.restaurantName === 'string' ? data.restaurantName : 'Restaurante';
      navigateToMenu(restaurantId, name);
      return;
    }
  }

  const orderId = parseId(data?.orderId);
  const shipmentId = parseId(data?.shipmentId);

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
