import { Platform, type ViewStyle } from 'react-native';

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
