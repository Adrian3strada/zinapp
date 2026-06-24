export type PendingNavigation =
  | { type: 'order'; orderId: number }
  | { type: 'shipment'; shipmentId: number }
  | { type: 'menu'; restaurantId: number; restaurantName: string };

let pending: PendingNavigation | null = null;
const listeners = new Set<(nav: PendingNavigation) => void>();

export function setPendingNavigation(nav: PendingNavigation): void {
  pending = nav;
  listeners.forEach((listener) => listener(nav));
}

export function consumePendingNavigation(): PendingNavigation | null {
  const current = pending;
  pending = null;
  return current;
}

export function subscribePendingNavigation(listener: (nav: PendingNavigation) => void): () => void {
  const wrapped = (nav: PendingNavigation) => {
    pending = null;
    listener(nav);
  };
  listeners.add(wrapped);
  if (pending) wrapped(pending);
  return () => listeners.delete(wrapped);
}
