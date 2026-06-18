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

const APP_TRANSFER_FALLBACK: TransferInfo = extra?.transferInfo ?? {
  bank: 'BBVA',
  clabe: '',
  holder: 'ZinApp Delivery',
  whatsapp: '',
  note: 'Envía el comprobante por WhatsApp con tu número de pedido.',
};

/** Datos bancarios del local; si no hay CLABE, usa fallback de plataforma (app.json / API). */
export function resolveTransferInfo(
  restaurant?: Restaurant | null,
  platform?: Partial<TransferInfo>,
): TransferInfo {
  const fallback: TransferInfo = {
    ...APP_TRANSFER_FALLBACK,
    ...platform,
    whatsapp: platform?.whatsapp?.trim() || APP_TRANSFER_FALLBACK.whatsapp,
    clabe: platform?.clabe?.trim() || APP_TRANSFER_FALLBACK.clabe,
  };

  const clabe = restaurant?.clabe?.trim();
  if (clabe) {
    const whatsapp = restaurant?.whatsapp?.trim() || restaurant?.phone?.trim() || fallback.whatsapp;
    return {
      bank: restaurant?.bank_name?.trim() || '—',
      clabe,
      holder: restaurant?.account_holder?.trim() || restaurant?.name || '—',
      whatsapp,
      note: 'Transfiere al local y envía el comprobante por WhatsApp con tu número de pedido.',
    };
  }
  return fallback;
}

export function restaurantHasTransferInfo(restaurant?: Restaurant | null): boolean {
  return Boolean(restaurant?.clabe?.trim() || restaurant?.has_transfer_info);
}

/** @deprecated Usa resolveTransferInfo con platform desde useAppConfig */
export const TRANSFER_INFO = APP_TRANSFER_FALLBACK;
