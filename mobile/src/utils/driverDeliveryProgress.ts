/** Progreso local de entrega (el API de comida no tiene mark-picked-up). */

const pickedUpOrderIds = new Set<number>();

export function markOrderPickedUpLocally(orderId: number): void {
  pickedUpOrderIds.add(orderId);
}

export function clearOrderPickedUpLocally(orderId: number): void {
  pickedUpOrderIds.delete(orderId);
}

export function isOrderPickedUpLocally(orderId: number): boolean {
  return pickedUpOrderIds.has(orderId);
}

export type ActiveDeliveryStep = 'pickup' | 'dropoff';

export function getActiveDeliveryStep(orderId: number): ActiveDeliveryStep {
  return isOrderPickedUpLocally(orderId) ? 'dropoff' : 'pickup';
}
