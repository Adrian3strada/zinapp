import { Linking } from 'react-native';

export type TransferKind = 'order' | 'shipment';

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  const withCountry = digits.startsWith('52') ? digits : `52${digits}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

export async function openWhatsApp(phone: string, message: string): Promise<void> {
  if (!phone?.trim()) {
    throw new Error('No hay número de contacto disponible.');
  }
  const url = buildWhatsAppUrl(phone, message);
  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    throw new Error('No se pudo abrir WhatsApp en este dispositivo.');
  }
  await Linking.openURL(url);
}

export function transferReceiptMessage(
  id: number,
  totalFormatted: string,
  kind: TransferKind = 'order',
): string {
  const label = kind === 'shipment' ? 'envío' : 'pedido';
  if (id <= 0) {
    return (
      `Hola, envío comprobante de transferencia de un ${label} ` +
      `por ${totalFormatted} en ZinApp Zinapécuaro.`
    );
  }
  return (
    `Hola, envío comprobante de transferencia del ${label} #${id} ` +
    `por ${totalFormatted} en ZinApp Zinapécuaro.`
  );
}

export function driverContactMessage(orderId: number, restaurantName: string): string {
  return (
    `Hola, soy el cliente del pedido #${orderId} de ${restaurantName} en ZinApp. ` +
    '¿Me confirmas tu llegada?'
  );
}

export function customerContactMessage(orderId: number): string {
  return (
    `Hola, soy tu repartidor del pedido #${orderId} en ZinApp. ` +
    'Voy en camino a tu domicilio.'
  );
}

export function shipmentDriverContactMessage(shipmentId: number): string {
  return (
    `Hola, soy el cliente del envío #${shipmentId} en ZinApp. ` +
    '¿Me confirmas el estado de mi paquete?'
  );
}

export function shipmentCustomerContactMessage(shipmentId: number): string {
  return (
    `Hola, soy tu repartidor del envío #${shipmentId} en ZinApp. ` +
    'Voy en camino.'
  );
}
