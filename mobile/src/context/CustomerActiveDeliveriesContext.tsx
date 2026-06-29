import React, { createContext, useContext } from 'react';

import {
  useCustomerActiveDeliveriesState,
  type ActiveDeliveryItem,
} from '../hooks/useCustomerActiveDeliveries';

interface CustomerActiveDeliveriesValue {
  activeOrderCount: number;
  liveItems: ActiveDeliveryItem[];
  trackingItems: ActiveDeliveryItem[];
  refreshError: string | null;
  refresh: () => Promise<void>;
}

export type { ActiveDeliveryItem };

const CustomerActiveDeliveriesContext = createContext<CustomerActiveDeliveriesValue | null>(
  null,
);

export function CustomerActiveDeliveriesProvider({
  children,
  enabled = true,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  const value = useCustomerActiveDeliveriesState(enabled);
  return (
    <CustomerActiveDeliveriesContext.Provider value={value}>
      {children}
    </CustomerActiveDeliveriesContext.Provider>
  );
}

export function useCustomerActiveDeliveries(): CustomerActiveDeliveriesValue {
  const ctx = useContext(CustomerActiveDeliveriesContext);
  if (!ctx) {
    throw new Error('useCustomerActiveDeliveries must be used within CustomerActiveDeliveriesProvider');
  }
  return ctx;
}

/** Para pantallas compartidas (detalle pedido) cuando el provider puede no existir. */
export function useOptionalCustomerActiveDeliveries(): CustomerActiveDeliveriesValue | null {
  return useContext(CustomerActiveDeliveriesContext);
}
