import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Almacenamiento seguro en móvil (SecureStore); persistente en web (localStorage).
 *
 * En web usamos localStorage para que la sesión sobreviva al cerrar la pestaña,
 * abrir Maps/WhatsApp o volver desde otra app. Logout explícito sigue borrando
 * las claves. Migración: si hay valor viejo en sessionStorage, se copia una vez.
 */
function migrateFromSessionStorage(key: string): string | null {
  try {
    const legacy = globalThis.sessionStorage?.getItem(key);
    if (!legacy) return null;
    globalThis.localStorage?.setItem(key, legacy);
    globalThis.sessionStorage?.removeItem(key);
    return legacy;
  } catch {
    return null;
  }
}

export async function getStorageItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      const value = globalThis.localStorage?.getItem(key);
      if (value != null) return value;
      return migrateFromSessionStorage(key);
    } catch {
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setStorageItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(key, value);
      try {
        globalThis.sessionStorage?.removeItem(key);
      } catch {
        // ignore
      }
    } catch {
      // ignore quota / private mode
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // ignore
  }
}

export async function deleteStorageItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.removeItem(key);
      globalThis.sessionStorage?.removeItem(key);
    } catch {
      // ignore
    }
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
}
