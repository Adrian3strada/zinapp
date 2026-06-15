import { useCustomerActiveDeliveries } from '../context/CustomerActiveDeliveriesContext';

/** Badge count for active shipments on home (pending + picked_up + on_the_way). */
export function useCustomerActiveShipments() {
  const { activeShipmentCount } = useCustomerActiveDeliveries();
  return activeShipmentCount;
}
