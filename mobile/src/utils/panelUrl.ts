import Constants from 'expo-constants';

import { API_URL } from '../config/api';

/** URL base del sitio (sin /api). */
export function getSiteOrigin(): string {
  // En la app web, el panel debe conservar el dominio abierto por la persona.
  // Esto evita redirigir a Railway cuando la app se sirve desde zinapp.com.mx.
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }

  try {
    return new URL(API_URL).origin;
  } catch {
    const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
    const configured = extra?.apiUrl?.trim();
    if (configured) {
      try {
        return new URL(configured).origin;
      } catch {
        // fall through
      }
    }
    return 'https://zinapp.com.mx';
  }
}

export function getPanelLoginUrl(): string {
  return `${getSiteOrigin()}/panel/login/`;
}

export function getPanelHomeUrl(): string {
  return `${getSiteOrigin()}/panel/`;
}

export function redirectToPanelLogin(): void {
  if (typeof window !== 'undefined') {
    window.location.assign(getPanelLoginUrl());
  }
}
