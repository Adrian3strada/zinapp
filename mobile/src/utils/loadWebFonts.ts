import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform } from 'react-native';

import { injectWebInputStyles } from './webPlatform';

function webAssetBase(): string {
  const base =
    (Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl ?? '/app';
  if (base === '/') return '';
  return base.replace(/\/$/, '');
}

/** Precarga fuentes de iconos en web (Ionicons). */
export async function loadWebFonts(): Promise<void> {
  if (Platform.OS !== 'web') return;

  injectWebInputStyles();

  const ioniconsUrl = `${webAssetBase()}/fonts/ionicons.ttf`;

  try {
    await Ionicons.loadFont();
  } catch {
    // fallback: CSS @font-face en index.html
  }

  try {
    const { loadAsync, isLoaded } = await import('expo-font');
    if (!isLoaded('ionicons')) {
      await loadAsync({ ionicons: ioniconsUrl });
    }
  } catch {
    // CSS preload cubre el render inicial
  }
}
