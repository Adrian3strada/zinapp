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

function mimeFromUri(uri: string): string {
  const path = uri.split('?')[0].toLowerCase();
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function filenameFromUri(uri: string, fallback: string): string {
  const segment = uri.split('?')[0].split('/').pop();
  if (segment && segment.includes('.')) return segment;
  const ext = mimeFromUri(uri) === 'image/png' ? 'png' : 'jpg';
  return fallback.replace(/\.\w+$/, `.${ext}`);
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
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

export async function pickProductImage(): Promise<string | null> {
  return pickImageFromLibrary({ aspect: ASPECT_SQUARE, quality: 0.85 });
}

export async function pickRestaurantCoverImage(): Promise<string | null> {
  return pickImageFromLibrary({ aspect: ASPECT_COVER, quality: 0.85 });
}

export async function appendImage(
  formData: FormData,
  field: string,
  uri: string,
  filename = 'photo.jpg',
): Promise<void> {
  const name = filenameFromUri(uri, filename);
  const type = mimeFromUri(uri);

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    formData.append(field, blob, name);
    return;
  }

  formData.append(field, {
    uri,
    name,
    type,
  } as unknown as Blob);
}
