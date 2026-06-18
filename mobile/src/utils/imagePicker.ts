import * as ImagePicker from 'expo-image-picker';
import { appAlert } from './appAlert';

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

export async function pickImageFromLibrary(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    appAlert('Permiso', 'Necesitamos acceso a tus fotos para subir la imagen.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

export function appendImage(formData: FormData, field: string, uri: string, filename = 'photo.jpg') {
  const type = mimeFromUri(uri);
  const name = filenameFromUri(uri, filename);
  formData.append(field, {
    uri,
    name,
    type,
  } as unknown as Blob);
}
