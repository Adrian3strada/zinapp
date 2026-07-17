import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Almacenamiento seguro en móvil; almacenamiento por sesión en web.
 *
 * sessionStorage still cannot protect a bearer token from an XSS in the same
 * origin, but avoids persisting credentials after the browser closes. Moving
 * web auth to HttpOnly cookies requires a coordinated backend/API change.
 */
export async function getStorageItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return globalThis.sessionStorage?.getItem(key) ?? null;
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
      globalThis.sessionStorage?.setItem(key, value);
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
