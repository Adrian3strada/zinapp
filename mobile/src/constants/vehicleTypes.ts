import type { DeliveryProfile } from '../types';

export const VEHICLE_OPTIONS: {
  value: DeliveryProfile['vehicle_type'];
  label: string;
  icon: string;
  needsPlate: boolean;
}[] = [
  { value: 'bicycle', label: 'Bicicleta', icon: 'bicycle-outline', needsPlate: false },
  { value: 'motorcycle', label: 'Moto', icon: 'navigate-outline', needsPlate: true },
  { value: 'car', label: 'Auto', icon: 'car-outline', needsPlate: true },
];

export function vehicleNeedsPlate(type?: DeliveryProfile['vehicle_type']): boolean {
  return VEHICLE_OPTIONS.find((v) => v.value === type)?.needsPlate ?? false;
}
