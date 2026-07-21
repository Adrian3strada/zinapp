import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { appAlert } from './appAlert';

export type ImageAspect = [number, number];

/** Cuadrado: avatar, logo, platillos (FoodImage). */
export const ASPECT_SQUARE: ImageAspect = [1, 1];
/** Portada de local en menú / listados. */
export const ASPECT_COVER: ImageAspect = [4, 3];
/** Documento (INE): un poco más ancho. */
export const ASPECT_DOCUMENT: ImageAspect = [3, 2];

export interface PickImageOptions {
  aspect?: ImageAspect;
  quality?: number;
  /** Si false, no muestra UI de recorte (solo en plataformas que lo soporten). */
  allowsEditing?: boolean;
}

export interface PickedImage {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}

async function ensureLibraryPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    appAlert('Permiso', 'Necesitamos acceso a tus fotos para subir la imagen.');
    return false;
  }
  return true;
}

/**
 * Abre la galería y, si la plataforma lo permite, la UI de recorte
 * (Android/iOS: editor nativo; web: recorte básico de Expo).
 */
export async function pickImageFromLibrary(
  options: PickImageOptions = {},
): Promise<string | null> {
  const picked = await pickImageAsset(options);
  return picked?.uri ?? null;
}

export async function pickImageAsset(
  options: PickImageOptions = {},
): Promise<PickedImage | null> {
  const {
    aspect = ASPECT_SQUARE,
    quality = 0.85,
    allowsEditing = true,
  } = options;

  if (!(await ensureLibraryPermission())) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing,
    aspect: allowsEditing ? aspect : undefined,
    quality,
    exif: false,
  });

  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType,
    fileName: asset.fileName,
  };
}

export async function pickProductImage(): Promise<string | null> {
  return pickImageFromLibrary({ aspect: ASPECT_SQUARE, quality: 0.85 });
}

export async function pickRestaurantCoverImage(): Promise<string | null> {
  return pickImageFromLibrary({ aspect: ASPECT_COVER, quality: 0.85 });
}

function safeJpegName(fallback: string): string {
  const base = fallback.replace(/\.\w+$/, '') || 'photo';
  return `${base}.jpg`;
}

/** Re-encodea a JPEG para que Django/Pillow siempre reciba una imagen válida. */
async function blobToJpegFile(sourceUri: string, filename: string): Promise<File> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    el.crossOrigin = 'anonymous';
    el.src = sourceUri;
  });

  const canvas = document.createElement('canvas');
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
  canvas.width = Math.max(1, Math.round((img.width || 1) * scale));
  canvas.height = Math.max(1, Math.round((img.height || 1) * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const jpegBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se pudo convertir la imagen a JPEG.'))),
      'image/jpeg',
      0.85,
    );
  });

  if (jpegBlob.size < 32) {
    throw new Error('La imagen quedó vacía. Vuelve a elegirla y recórtala.');
  }

  return new File([jpegBlob], safeJpegName(filename), { type: 'image/jpeg' });
}

export async function appendImage(
  formData: FormData,
  field: string,
  uri: string,
  filename = 'photo.jpg',
): Promise<void> {
  const name = safeJpegName(filename);

  if (Platform.OS === 'web') {
    // El recorte de Expo en web a veces entrega blob sin tipo o formato raro;
    // Pillow lo rechaza. Re-encodeamos siempre a JPEG desde la URI.
    const file = await blobToJpegFile(uri, name);
    formData.append(field, file);
    return;
  }

  formData.append(field, {
    uri,
    name,
    type: 'image/jpeg',
  } as unknown as Blob);
}
