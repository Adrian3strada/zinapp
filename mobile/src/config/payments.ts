import Constants from 'expo-constants';

export interface TransferInfo {
  bank: string;
  clabe: string;
  holder: string;
  whatsapp: string;
  note: string;
}

const extra = Constants.expoConfig?.extra as { transferInfo?: TransferInfo } | undefined;

const APP_TRANSFER_INFO: TransferInfo = extra?.transferInfo ?? {
  bank: 'BBVA',
  clabe: '',
  holder: 'ZinApp Delivery',
  whatsapp: '',
  note: 'Envía el comprobante por WhatsApp con tu número de pedido.',
};

/** Datos bancarios de ZinApp (plataforma). Los locales no reciben transferencias directas. */
export function resolveTransferInfo(platform?: Partial<TransferInfo>): TransferInfo {
  return {
    ...APP_TRANSFER_INFO,
    ...platform,
    whatsapp: platform?.whatsapp?.trim() || APP_TRANSFER_INFO.whatsapp,
    clabe: platform?.clabe?.trim() || APP_TRANSFER_INFO.clabe,
    bank: platform?.bank?.trim() || APP_TRANSFER_INFO.bank,
    holder: platform?.holder?.trim() || APP_TRANSFER_INFO.holder,
    note: platform?.note?.trim() || APP_TRANSFER_INFO.note,
  };
}

/** @deprecated Usa resolveTransferInfo */
export const TRANSFER_INFO = APP_TRANSFER_INFO;
