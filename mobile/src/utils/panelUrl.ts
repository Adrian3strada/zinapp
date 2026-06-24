import Constants from 'expo-constants';

import { API_URL } from '../config/api';

/** URL base del sitio (sin /api). */
export function getSiteOrigin(): string {
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
    return 'https://zinapp-api-production.up.railway.app';
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
