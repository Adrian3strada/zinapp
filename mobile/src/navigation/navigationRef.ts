import { CommonActions } from '@react-navigation/native';
import { createNavigationContainerRef } from '@react-navigation/native';

type RootParams = {
  OrderDetail: { orderId: number };
  ShipmentDetail: { shipmentId: number };
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

export function handleNotificationNavigation(data: Record<string, unknown> | undefined) {
  const type = data?.type;
  const shipmentRaw = data?.shipmentId;
  if (type === 'shipment' || type === 'driver_nearby') {
    const shipmentId = parseId(shipmentRaw);
    if (shipmentId != null) {
      navigateToShipment(shipmentId);
      return;
    }
  }
  const orderId = parseId(data?.orderId);
  if (orderId != null) {
    navigateToOrder(orderId);
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
