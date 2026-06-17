import * as ImagePicker from 'expo-image-picker';
import { appAlert } from './appAlert';

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
  formData.append(field, {
    uri,
    name: filename,
    type: 'image/jpeg',
  } as unknown as Blob);
}
