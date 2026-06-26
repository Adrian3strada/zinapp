/** Abre Instagram o Facebook desde usuario/enlace guardado en el panel. */
import { Linking } from 'react-native';

function normalizeInstagram(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const handle = trimmed.replace(/^@/, '');
  return `https://instagram.com/${handle}`;
}

function normalizeFacebook(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://facebook.com/${trimmed.replace(/^@/, '')}`;
}

export async function openSocialLink(platform: 'instagram' | 'facebook', value?: string | null): Promise<void> {
  const raw = value?.trim();
  if (!raw) {
    throw new Error('Enlace no disponible.');
  }
  const url = platform === 'instagram' ? normalizeInstagram(raw) : normalizeFacebook(raw);
  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    throw new Error('No se pudo abrir el enlace.');
  }
  await Linking.openURL(url);
}

export function serviceListingRequestMessage(businessName?: string): string {
  const nameLine = businessName?.trim()
    ? `Nombre del negocio: ${businessName.trim()}`
    : 'Nombre del negocio: (escribe aquí)';
  return (
    'Hola, me gustaría que mi negocio aparezca en la sección Servicios de ZinApp Zinapécuaro.\n\n'
    + `${nameLine}\n`
    + 'Giro: (ej. peluquería, taller…)\n'
    + 'Teléfono / WhatsApp:\n'
    + 'Horario:\n'
    + 'Dirección:'
  );
}
