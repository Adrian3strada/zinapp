import { Platform, type TextStyle, type ViewStyle } from 'react-native';

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

/** Tab bar fija solo en móvil web; en desktop usa sidebar. */
export function webTabBarStyle(isDesktopWeb = false): ViewStyle {
  if (!isWebPlatform() || isDesktopWeb) return { display: 'none' };
  return {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    width: '100%',
    maxWidth: WEB_MOBILE_FRAME_MAX,
    zIndex: 1000,
    // @ts-expect-error RN web transform
    transform: [{ translateX: '-50%' }],
  };
}

/** @deprecated usar webTabBarStyle(isDesktopWeb) */
export function webTabBarStyleLegacy(): ViewStyle {
  return webTabBarStyle(false);
}

/** Evita que capas decorativas (gradientes) intercepten clics en web. */
export function webPassThroughPointerEvents(): 'none' | undefined {
  return isWebPlatform() ? 'none' : undefined;
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
    // @ts-expect-error RN web
    boxShadow: 'none',
  };
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
    #root input:focus,
    #root input:focus-visible,
    #root textarea:focus,
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
