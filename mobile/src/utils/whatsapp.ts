import { Linking, Platform } from 'react-native';

import { openExternalUrl } from './navigationLinks';

export type TransferKind = 'order' | 'shipment';

function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('52') ? digits : `52${digits}`;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const withCountry = normalizeWhatsAppPhone(phone);
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

function buildWhatsAppNativeUrl(phone: string, message: string): string {
  const withCountry = normalizeWhatsAppPhone(phone);
  return `whatsapp://send?phone=${withCountry}&text=${encodeURIComponent(message)}`;
}

export async function openWhatsApp(phone: string, message: string): Promise<void> {
  if (!phone?.trim()) {
    throw new Error('No hay número de contacto disponible.');
  }
  const httpsUrl = buildWhatsAppUrl(phone, message);
  if (Platform.OS === 'web') {
    if (!openExternalUrl(httpsUrl)) {
      throw new Error('No se pudo abrir WhatsApp en este dispositivo.');
    }
    return;
  }

  // Android 11+: canOpenURL(https://wa.me/…) suele fallar sin <queries>.
  // Intentamos abrir directo (scheme nativo y wa.me) en lugar de confiar solo en canOpenURL.
  const candidates = Platform.OS === 'android'
    ? [buildWhatsAppNativeUrl(phone, message), httpsUrl]
    : [httpsUrl, buildWhatsAppNativeUrl(phone, message)];

  let lastError: unknown;
  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('No se pudo abrir WhatsApp en este dispositivo. ¿Tienes WhatsApp instalado?');
}

export function transferReceiptMessage(
  ref: string,
  totalFormatted: string,
  kind: TransferKind = 'order',
): string {
  const label = kind === 'shipment' ? 'envío' : 'pedido';
  if (!ref) {
    return (
      `Hola, envío comprobante de transferencia de un ${label} ` +
      `por ${totalFormatted} en ZinApp Zinapécuaro.`
    );
  }
  return (
    `Hola, envío comprobante de transferencia del ${label} ${ref} ` +
    `por ${totalFormatted} en ZinApp Zinapécuaro.`
  );
}

export function driverContactMessage(orderRef: string, restaurantName: string): string {
  return (
    `Hola, soy el cliente del pedido ${orderRef} de ${restaurantName} en ZinApp. ` +
    '¿Me confirmas tu llegada?'
  );
}

export function customerContactMessage(orderRef: string): string {
  return (
    `Hola, soy tu repartidor del pedido ${orderRef} en ZinApp. ` +
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
