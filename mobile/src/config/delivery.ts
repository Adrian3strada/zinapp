import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as {
  deliveryFee?: number;
  shipmentSizes?: { key: ShipmentSize; label: string; fee: number; hint: string }[];
} | undefined;

/** Tarifa de envío de comida (debe coincidir con el backend). */
export const DELIVERY_FEE = extra?.deliveryFee ?? 25;

export type ShipmentSize = 'small' | 'medium' | 'large';

export interface ShipmentSizeOption {
  key: ShipmentSize;
  label: string;
  fee: number;
  hint: string;
  emoji: string;
}

export const SHIPMENT_SIZES: ShipmentSizeOption[] = extra?.shipmentSizes?.map((s) => ({
  ...s,
  emoji: s.key === 'small' ? '📄' : s.key === 'medium' ? '📦' : '🧳',
})) ?? [
  {
    key: 'small',
    label: 'Chico',
    fee: 25,
    hint: 'Sobre, documentos o bolsa pequeña',
    emoji: '📄',
  },
  {
    key: 'medium',
    label: 'Mediano',
    fee: 45,
    hint: 'Caja mediana o varios artículos',
    emoji: '📦',
  },
  {
    key: 'large',
    label: 'Grande',
    fee: 70,
    hint: 'Caja grande o paquete pesado',
    emoji: '🧳',
  },
];

export function getShipmentFee(size: ShipmentSize): number {
  return SHIPMENT_SIZES.find((s) => s.key === size)?.fee ?? SHIPMENT_SIZES[0].fee;
}

export const MIN_SHIPMENT_FEE = Math.min(...SHIPMENT_SIZES.map((s) => s.fee));
