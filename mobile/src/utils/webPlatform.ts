import { Linking, Platform, type TextStyle, type ViewStyle } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { WEB_BREAKPOINT_DESKTOP, WEB_MOBILE_FRAME_MAX } from './responsive';

export function isWebPlatform(): boolean {
  return Platform.OS === 'web';
}

/** En web el teclado no necesita KeyboardAvoidingView (rompe el layout). */
export function keyboardAvoidingBehavior(): 'padding' | 'height' | undefined {
  if (Platform.OS === 'ios') return 'padding';
  if (Platform.OS === 'android') return 'height';
  return undefined;
}

/** Estilos del contenedor de navegación en web (altura completa dentro del shell). */
export function webNavigationRootStyle(): ViewStyle | undefined {
  if (!isWebPlatform()) return undefined;
  return {
    flex: 1,
    height: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  };
}

/** Tab bar fija solo en móvil web; en desktop usa sidebar. En Android/iOS no aplica estilos web. */
export function webTabBarStyle(isDesktopWeb = false): ViewStyle {
  if (!isWebPlatform()) return {};
  if (isDesktopWeb) return { display: 'none' };
  return {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    width: '100%',
    maxWidth: WEB_MOBILE_FRAME_MAX,
    zIndex: 1000,
    transform: [{ translateX: '-50%' }],
  } as unknown as ViewStyle;
}

/** @deprecated usar webTabBarStyle(isDesktopWeb) */
export function webTabBarStyleLegacy(): ViewStyle {
  return webTabBarStyle(false);
}

/**
 * Evita que capas decorativas (gradientes) intercepten clics en web,
 * sin bloquear los toques de los hijos (botones, links).
 */
export function webPassThroughPointerEvents(): 'box-none' | undefined {
  return isWebPlatform() ? 'box-none' : undefined;
}

/** Quita bordes/outline del navegador en inputs nativos (RN Web). */
export function webTextInputStyle(): TextStyle {
  if (!isWebPlatform()) return {};
  return {
    outlineStyle: 'none',
    outlineWidth: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingVertical: 0,
    margin: 0,
    minWidth: 0,
    boxShadow: 'none',
  } as unknown as TextStyle;
}

/** CSS global para inputs dentro de la app web (login, formularios). */
export function injectWebInputStyles(): void {
  if (!isWebPlatform() || typeof document === 'undefined') return;
  const id = 'zinapp-input-reset';
  if (document.getElementById(id)) return;

  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    #root input,
    #root textarea {
      outline: none !important;
      border: none !important;
      box-shadow: none !important;
      background: transparent !important;
      appearance: none;
      -webkit-appearance: none;
    }
    #root [role="button"]:focus-visible,
    #root a:focus-visible,
    #root button:focus-visible {
      outline: 2px solid #1E5DB8 !important;
      outline-offset: 2px !important;
    }
    #root input:focus-visible,
    #root textarea:focus-visible {
      outline: none !important;
      box-shadow: none !important;
    }
    #root input:-webkit-autofill,
    #root input:-webkit-autofill:hover,
    #root input:-webkit-autofill:focus {
      -webkit-box-shadow: 0 0 0 1000px transparent inset !important;
      box-shadow: 0 0 0 1000px transparent inset !important;
      transition: background-color 5000s ease-in-out 0s;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Abre el checkout de pago.
 * En web: misma pestaña.
 * En iOS/Android: navegador in-app (evita crash al salir con Linking.openURL).
 */
export async function openPaymentCheckout(url: string): Promise<'redirected' | 'opened'> {
  const trimmed = (url || '').trim();
  if (!trimmed) {
    throw new Error('URL de pago vacía');
  }

  if (isWebPlatform() && typeof window !== 'undefined') {
    window.location.assign(trimmed);
    return 'redirected';
  }

  try {
    await WebBrowser.openBrowserAsync(trimmed, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      enableDefaultShareMenuItem: false,
      showTitle: true,
      controlsColor: '#1A56DB',
    });
    return 'opened';
  } catch {
    // Fallback si el navegador in-app no está disponible
    await Linking.openURL(trimmed);
    return 'opened';
  }
}
