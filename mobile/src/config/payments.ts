import Constants from 'expo-constants';

import type { Restaurant } from '../types';

export interface TransferInfo {
  bank: string;
  clabe: string;
  holder: string;
  whatsapp: string;
  note: string;
}

const extra = Constants.expoConfig?.extra as { transferInfo?: TransferInfo } | undefined;

export const TRANSFER_INFO: TransferInfo = extra?.transferInfo ?? {
  bank: 'BBVA',
  clabe: '012180001234567890',
  holder: 'ZinApp Delivery',
  whatsapp: '4431234567',
  note: 'Envía el comprobante por WhatsApp con tu número de pedido.',
};

/** Datos bancarios del local; si no hay CLABE, usa el fallback de la plataforma. */
export function resolveTransferInfo(restaurant?: Restaurant | null): TransferInfo {
  const clabe = restaurant?.clabe?.trim();
  if (clabe) {
    const whatsapp = restaurant?.whatsapp?.trim() || restaurant?.phone?.trim() || '';
    return {
      bank: restaurant?.bank_name?.trim() || '—',
      clabe,
      holder: restaurant?.account_holder?.trim() || restaurant?.name || '—',
      whatsapp,
      note: 'Transfiere al local y envía el comprobante por WhatsApp con tu número de pedido.',
    };
  }
  return TRANSFER_INFO;
}

export function restaurantHasTransferInfo(restaurant?: Restaurant | null): boolean {
  return Boolean(restaurant?.clabe?.trim() || restaurant?.has_transfer_info);
}
