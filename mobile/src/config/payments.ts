import Constants from 'expo-constants';

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
